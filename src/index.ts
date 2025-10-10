// src/index.ts
import axios from "axios";
import { config } from "./config";
import { AnalyzerService } from "./services/analyzer/AnalyzerService";
import { CacheService } from "./services/CacheService";
import { BinanceApiService } from "./services/collector/BinanceApiService";
import { BinanceWebSocketService } from "./services/collector/BinanceWebSocketService";
import { DashboardService } from "./services/dashboard/DashboardService";

async function main() {
  console.log("Starting the trading application...");

  // 1. Initialisation des services
  const cacheService = new CacheService();
  const apiService = new BinanceApiService();
  const webSocketService = new BinanceWebSocketService(cacheService);
  const analyzerService = new AnalyzerService();
  const dashboardService = new DashboardService();

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
    console.log(
      `Cache updated for ${interval}. New kline close price: ${kline.close}`
    );
    // Ici, vous pouvez déclencher votre logique de trading, etc.
    if (interval === config.INTERVALS.ONE_MINUTE) {
      const klines1m = cacheService.getCache(config.INTERVALS.ONE_MINUTE!);
      const klines15m = cacheService.getCache(
        config.INTERVALS.FIFTEEN_MINUTES!
      );

      if (klines1m) {
        const analysis = analyzerService.analyze(klines1m);

        if (analysis) {
          try {
            // 4. Récupérer le contexte du dashboard AVANT de décider
            const dashboardContext = await dashboardService.getTradingContext();

            axios.post(
              "http://localhost:5678/webhook-test/ffa7477e-64fb-487c-b35b-414a207db077",
              {
                data: {
                  "1m": klines1m,
                  "15m": klines15m,
                  indicator: analysis,
                  acount_data_trading_rule: dashboardContext,
                },
              }
            );

            // C'EST ICI QUE VOUS ENVERREZ `analysis` ET `dashboardContext` AU MODULE `CERVEAU`
          } catch (error) {
            console.error(
              "Could not get dashboard context. Skipping decision cycle.",
              error
            );
          }
        }
      }
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
