// src/backtest.ts
import * as fs from "fs/promises";
import { config } from "./config";
import { AnalyzerService } from "./services/analyzer/AnalyzerService";
import { BrainService } from "./services/brain/BrainService";
import { Kline } from "./types/kline";
// ✅ CORRECTION: Chemins d'importation corrigés
import { SimulatedAccountService } from "./services/backtest/SimulatedAccounService";
import { SimulatedBrokerService } from "./services/backtest/SimulateBrockerService";
import { DashboardContext } from "./types/dashboard";

// --- Helpers pour la construction de bougies ---
const klineBuilders: { [key: string]: Kline } = {};

function updateKlineFromTrade(
  interval: "1m" | "5m",
  trade: { p: string; q: string; T: number }
) {
  const price = parseFloat(trade.p);
  const quantity = parseFloat(trade.q);
  const timestamp = trade.T;
  const intervalMillis = (interval === "1m" ? 1 : 5) * 60 * 1000;
  const openTime = Math.floor(timestamp / intervalMillis) * intervalMillis;
  let kline = klineBuilders[interval];

  if (!kline || kline.openTime !== openTime) {
    klineBuilders[interval] = {
      openTime,
      open: String(price),
      high: String(price),
      low: String(price),
      close: String(price),
      volume: String(quantity),
    };
  } else {
    kline.high = String(Math.max(parseFloat(kline.high), price));
    kline.low = String(Math.min(parseFloat(kline.low), price));
    kline.close = String(price);
    kline.volume = String(parseFloat(kline.volume) + quantity);
  }
}
// --- Fin des helpers ---

async function main() {
  console.log("Démarrage du backtest...");

  // 1. Charger les données historiques
  const tradeData = JSON.parse(
    await fs.readFile("historical-trades.json", "utf-8")
  );

  // 2. Initialiser les services de simulation
  const account = new SimulatedAccountService(100);
  const broker = new SimulatedBrokerService();
  const analyzer = new AnalyzerService();
  const brain = new BrainService();

  const klines1m: Kline[] = [];
  const klines5m: Kline[] = [];
  let last1mOpenTime = 0;
  let last5mOpenTime = 0;

  // 3. Boucle principale de la simulation
  for (let i = 0; i < tradeData.length; i++) {
    const tick = tradeData[i];
    const currentPrice = parseFloat(tick.p);

    updateKlineFromTrade(config.INTERVALS.ONE_MINUTE!, tick);
    updateKlineFromTrade(config.INTERVALS.FIVE_MINUTES!, tick);

    const builder1m = klineBuilders[config.INTERVALS.ONE_MINUTE!];
    if (builder1m && builder1m.openTime > last1mOpenTime) {
      klines1m.push(builder1m);
      last1mOpenTime = builder1m.openTime;
      if (klines1m.length > config.CACHE_LIMITS["1m"]) klines1m.shift();
    }
    
    // ✅ CORRECTION: Erreur de frappe "FIVE_MINUTES" corrigée
    const builder5m = klineBuilders[config.INTERVALS.FIVE_MINUTES!];
    if (builder5m && builder5m.openTime > last5mOpenTime) {
      klines5m.push(builder5m);
      last5mOpenTime = builder5m.openTime;
      if (klines5m.length > config.CACHE_LIMITS["5m"]) klines5m.shift();
    }
    
    // ✅ CORRECTION: Mise à jour des longueurs requises
    if (klines1m.length < 250 || klines5m.length < 100) continue;

    const analysis = analyzer.analyze(klines1m);
    if (!analysis) continue;

    const context: DashboardContext = {
      accountState: {
        equity: account.equity,
        availableBalance: account.equity,
        unrealizedPnl: 0,
      },
      performanceMetrics: {
        realizedPnlDaily: account.realizedPnlDaily,
        tradeCountDaily: account.tradeCountDaily,
      },
      activeContext: {
        openPositions: [],
        riskRules: {
            calculatedPositionSizeUsd: account.equity * (config.RISK_MANAGEMENT.MAX_RISK_PER_TRADE_PERCENT / 100),
             dailyProfitTarget: config.RISK_MANAGEMENT.DAILY_PROFIT_TARGET_PERCENT,
             dailyLossLimit: config.RISK_MANAGEMENT.DAILY_LOSS_LIMIT_PERCENT,
        },
      },
    };

    const decision = brain.getDecision(klines1m, klines5m);

    if (decision === "BUY" || decision === "SELL") {
      const dataFeedForTrade = tradeData
        .slice(i + 1)
        .map((t: any) => ({ price: parseFloat(t.p), timestamp: t.T }));

      const closedTrade = broker.executeTrade(
        decision,
        analysis,
        context,
        currentPrice,
        tick.T,
        dataFeedForTrade,
        klines1m
      );

      if (closedTrade) {
        account.addTrade(closedTrade);
        console.log(
          `[${new Date(tick.T).toISOString()}] Trade ${closedTrade.side} fermé. PnL: ${closedTrade.pnl.toFixed(4)} USD. Equity: ${account.equity.toFixed(2)} USD`
        );
      }
    }
  }

  // 4. Afficher les résultats
  account.printSummary();
}

main().catch(console.error);