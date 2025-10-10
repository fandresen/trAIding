// src/index.ts
import axios from "axios";
import { config } from "./config";
import { AnalyzerService } from "./services/analyzer/AnalyzerService";
import { CacheService } from "./services/CacheService";
import { BinanceApiService } from "./services/collector/BinanceApiService";
import { BinanceWebSocketService } from "./services/collector/BinanceWebSocketService";
import { DashboardService } from "./services/dashboard/DashboardService";
import { BrokerService } from "./services/broker/BrokerService";
import { RiskManagementService } from "./services/risk/RiskManagementService";
import { TradeHistoryService } from "./services/history/TradeHistoryService";

async function main() {
  console.log("Starting the trading application...");

  // 1. Initialisation des services
  const cacheService = new CacheService();
  const apiService = new BinanceApiService();
  const webSocketService = new BinanceWebSocketService(cacheService);
  const analyzerService = new AnalyzerService();
  const dashboardService = new DashboardService();
  const brokerService = new BrokerService();
  const riskService = new RiskManagementService();
  const tradeHistoryService = new TradeHistoryService();

  // 2. Récupération des données historiques et initialisation du cache
  try {
    // On récupère les données pour chaque intervalle défini dans la config
    for (const interval of Object.values(config.INTERVALS)) {
      const limit = config.CACHE_LIMITS[interval];
      const historicalKlines = await apiService.getHistoricalKlines(
        config.SYMBOL,
        interval,
        limit
      );
      cacheService.initialize(interval, historicalKlines, limit);
    }
  } catch (error) {
    console.error("Failed to initialize klines from API:", error);
    return; // Arrêter l'application si l'initialisation échoue
  }

  // 3. Connexion aux WebSockets pour les données en temps réel
  Object.values(config.INTERVALS).forEach((interval) => {
    webSocketService.connect(interval);
  });

  // 4. Écoute des mises à jour du cache
  webSocketService.on("kline:updated", async ({ interval, kline }) => {
    if (interval !== config.INTERVALS.ONE_MINUTE) return;

    const klines1m = cacheService.getCache(config.INTERVALS.ONE_MINUTE!);
    const klines15m = cacheService.getCache(config.INTERVALS.FIFTEEN_MINUTES!);
    if (!klines1m || klines1m.length < 50) return;

    const analysis = analyzerService.analyze(klines1m);
    if (!analysis) return;

    try {
      // Étape A: Obtenir l'état actuel
      const dashboardContext = await dashboardService.getTradingContext();
      const todaysTrades = await tradeHistoryService.getTodaysTrades();

      // Étape B: Vérifier les règles de risque AVANT TOUT
      const riskCheck = riskService.check(
        dashboardContext,
        analysis,
        todaysTrades
      );
      if (!riskCheck.isTradingAllowed) {
        console.warn(`[RISK] Trading stopped. Reason: ${riskCheck.reason}`);
        // Ici, on pourrait ajouter une logique pour fermer les positions ouvertes si nécessaire
        return;
      }

      console.log(
        "[RISK] All risk checks passed. Proceeding to strategy analysis."
      );

      // Étape C: Consulter le 'Cerveau' pour une décision stratégique
      const brainResponse = await axios.post(config.BRAIN_URL, {
        data: {
          "1m": klines1m,
          "15m": klines15m,
          indicator: analysis,
          acount_data_trading_rule: dashboardContext,
        },
      });
      const decision: { decision: "BUY" | "SELL" | "WAIT" } =
        brainResponse.data;

      // Étape D: Exécuter la décision si elle est validée
      if (decision.decision === "BUY" || decision.decision === "SELL") {
        await brokerService.executeTrade(
          decision.decision,
          analysis,
          dashboardContext,
          kline
        );
      } else {
        console.log("[BRAIN] Decision: WAIT. No trade executed.");
      }
    } catch (error) {
      console.error("Error during the decision cycle:", error);
    }
  });

  console.log("Application is running. Listening for kline updates...");

  // 5. Gestion de l'arrêt propre
  process.on("SIGINT", () => {
    console.log("\nGracefully shutting down...");
    webSocketService.closeAll();
    console.log("WebSocket connections closed.");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Unhandled error in main function:", error);
  process.exit(1);
});
