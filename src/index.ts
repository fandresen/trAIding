// src/index.ts
import { config } from "./config";
import { AnalyzerService } from "./services/analyzer/AnalyzerService";
import { CacheService } from "./services/CacheService";
import { BinanceApiService } from "./services/collector/BinanceApiService";
import { BinanceWebSocketService } from "./services/collector/BinanceWebSocketService";
import { DashboardService } from "./services/dashboard/DashboardService";
import { BrokerService } from "./services/broker/BrokerService";
import { RiskManagementService } from "./services/risk/RiskManagementService";
import { TradeHistoryService } from "./services/history/TradeHistoryService";
import { SlackNotificationService } from "./services/notification/SlackNotificationService";
import { PositionManagerService } from "./services/manager/PositionManagerService";
import { BrainService } from "./services/brain/BrainService";
import { Kline } from "./types/kline";

// --- Variables d'état ---
const klineBuilders: { [key: string]: Kline } = {};
let lastTradePrice: number | null = null;
let isProcessingTick = false; // Verrou pour éviter le traitement concurrent

// --- Initialisation des services ---
const cacheService = new CacheService();
const apiService = new BinanceApiService();
const webSocketService = new BinanceWebSocketService();
const analyzerService = new AnalyzerService();
const dashboardService = new DashboardService();
const brokerService = new BrokerService();
const riskService = new RiskManagementService();
const tradeHistoryService = new TradeHistoryService();
const slackService = new SlackNotificationService();
const brainService = new BrainService();
const positionManagerService = new PositionManagerService(
  brokerService,
  tradeHistoryService
);

/**
 * Met à jour les constructeurs de klines en temps réel avec un nouveau trade.
 */
function updateKlineFromTrade(
  interval: "1m" | "5m",
  trade: { price: number; quantity: number; timestamp: number }
) {
  const intervalMillis = (interval === "1m" ? 1 : 5) * 60 * 1000;
  const openTime =
    Math.floor(trade.timestamp / intervalMillis) * intervalMillis;

  let kline = klineBuilders[interval];

  if (!kline || kline.openTime !== openTime) {
    klineBuilders[interval] = {
      openTime: openTime,
      open: String(trade.price),
      high: String(trade.price),
      low: String(trade.price),
      close: String(trade.price),
      volume: String(trade.quantity),
    };
  } else {
    kline.high = String(Math.max(parseFloat(kline.high), trade.price));
    kline.low = String(Math.min(parseFloat(kline.low), trade.price));
    kline.close = String(trade.price);
    kline.volume = String(parseFloat(kline.volume) + trade.quantity);
  }
}

/**
 * La boucle logique principale qui s'exécute à un intervalle défini pour prendre des décisions de trading.
 */
async function processTick() {
  if (isProcessingTick || !lastTradePrice) {
    return;
  }
  isProcessingTick = true;

  try {
    const historicalKlines1m =
      cacheService.getCache(config.INTERVALS.ONE_MINUTE!) || [];
    const liveKlines1m = [
      ...historicalKlines1m,
      klineBuilders[config.INTERVALS.ONE_MINUTE!]!,
    ];

    const historicalKlines5m =
      cacheService.getCache(config.INTERVALS.FIVE_MINUTES!) || [];
    const liveKlines5m = [
      ...historicalKlines5m,
      klineBuilders[config.INTERVALS.FIVE_MINUTES!]!,
    ];

    if (liveKlines1m.length < 250 || liveKlines5m.length < 100) {
        isProcessingTick = false;
        return;
    };

    const analysis = analyzerService.analyze(liveKlines1m);
    if (!analysis) {
        isProcessingTick = false;
        return;
    };

    // --- Section maintenant à fréquence contrôlée ---
    const dashboardContext = await dashboardService.getTradingContext();
    if (dashboardContext.activeContext.openPositions.length > 0) {
      isProcessingTick = false;
      return;
    }

    const todaysTrades = await tradeHistoryService.getTodaysTrades();
    const riskCheck = riskService.check(
      dashboardContext,
      analysis,
      todaysTrades
    );
    if (!riskCheck.isTradingAllowed) {
      console.warn(`[RISK] Trading stopped. Reason: ${riskCheck.reason}`);
      isProcessingTick = false;
      return;
    }
    // --- Fin de la section ---

    const decision = brainService.getDecision(liveKlines1m, liveKlines5m);

    if (decision === "BUY" || decision === "SELL") {
      console.log(`[BRAIN] Decision: ${decision}. Executing trade.`);
      const newTrade = await brokerService.executeTrade(
        decision,
        analysis,
        dashboardContext,
        lastTradePrice,
        liveKlines1m
      );
      if (newTrade) {
        positionManagerService.manageTrade(newTrade);
      }
    }
  } catch (error) {
    console.error("Error during the tick decision cycle:", error);
    if ((error as any)?.code !== -1003) {
      await slackService.sendError(error as Error, "Tick Cycle Failed");
    }
  } finally {
    isProcessingTick = false;
  }
}

/**
 * Point d'entrée principal de l'application.
 */
async function main() {
  console.log("Starting the trading application...");

  try {
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
    await slackService.sendError(error as Error, "Kline Initialization Failed");
    return;
  }

  webSocketService.connectToTrades();
  webSocketService.on(
    "trade",
    (trade: { price: number; quantity: number; timestamp: number }) => {
      lastTradePrice = trade.price;
      updateKlineFromTrade(config.INTERVALS.ONE_MINUTE!, trade);
      updateKlineFromTrade(config.INTERVALS.FIVE_MINUTES!, trade);
    }
  );

  setInterval(processTick, 2000); // Exécute la logique de décision toutes les 2 secondes

  console.log("Application is running. Listening for trades...");

  process.on("SIGINT", () => {
    console.log("\nGracefully shutting down...");
    webSocketService.closeAll();
    process.exit(0);
  });
}

main().catch(async (error) => {
  console.error("Unhandled error in main function:", error);
  const slackService = new SlackNotificationService();
  await slackService.sendError(error as Error, "Critical Application Failure");
  process.exit(1);
});