// src/services/backtest/SimulatedBrokerService.ts
import { BollingerBands } from "technicalindicators";
import { AnalysisResult } from "../../types/indicators";
import { DashboardContext, Trade } from "../../types/dashboard";
import { config } from "../../config";
import { Kline } from "../../types/kline";

let tradeIdCounter = 0;
const MAKER_TAKER_FEE = 0.0005; // 0.05%

export class SimulatedBrokerService {
  public executeTrade(
    decision: "BUY" | "SELL",
    analysis: AnalysisResult,
    context: DashboardContext,
    entryPrice: number,
    entryTimestamp: number,
    dataFeed: { price: number; timestamp: number }[],
    klines1m: Kline[]
  ): Trade | null {
    const { RISK_MANAGEMENT: rules } = config;
    const positionSizeUSD =
      context.activeContext.riskRules.calculatedPositionSizeUsd;
    const quantity = positionSizeUSD / entryPrice;

    const closePrices1m = klines1m.map((k) => parseFloat(k.close));
    const bbInput = { period: 20, values: closePrices1m, stdDev: 2 };
    const lastBB = BollingerBands.calculate(bbInput).pop();

    if (!lastBB) {
      console.warn("[SIMULATOR] Could not calculate Bollinger Bands for SL.");
      return null;
    }

    let stopLossPrice: number;
    if (decision === "BUY") {
      stopLossPrice = lastBB.lower;
    } else {
      stopLossPrice = lastBB.upper;
    }

    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    const takeProfitPrice =
      decision === "BUY"
        ? entryPrice + stopLossDistance * rules.RISK_REWARD_RATIO
        : entryPrice - stopLossDistance * rules.RISK_REWARD_RATIO;

    for (const tick of dataFeed) {
      if (decision === "BUY") {
        if (tick.price <= stopLossPrice) {
          return this.createClosedTrade("BUY", entryPrice, stopLossPrice, quantity, entryTimestamp);
        }
        if (tick.price >= takeProfitPrice) {
          return this.createClosedTrade("BUY", entryPrice, takeProfitPrice, quantity, entryTimestamp);
        }
      } else { // SELL
        if (tick.price >= stopLossPrice) {
          return this.createClosedTrade("SELL", entryPrice, stopLossPrice, quantity, entryTimestamp);
        }
        if (tick.price <= takeProfitPrice) {
          return this.createClosedTrade("SELL", entryPrice, takeProfitPrice, quantity, entryTimestamp);
        }
      }
    }

    // --- ✅ CORRECTION LOGIQUE ---
    // Si la boucle se termine sans que SL/TP soit touché,
    // on clôture le trade au dernier prix disponible dans le flux de données.
    const lastTick = dataFeed[dataFeed.length - 1];
    if (lastTick) {
      return this.createClosedTrade(decision, entryPrice, lastTick.price, quantity, entryTimestamp);
    }
    
    // Un trade n'est ignoré que s'il n'y a plus aucune donnée.
    return null;
  }

  private createClosedTrade(
    side: "BUY" | "SELL",
    entryPrice: number,
    exitPrice: number,
    size: number,
    timestamp: number
  ): Trade {
    const grossPnl =
      side === "BUY"
        ? (exitPrice - entryPrice) * size
        : (entryPrice - exitPrice) * size;
    const entryFee = entryPrice * size * MAKER_TAKER_FEE;
    const exitFee = exitPrice * size * MAKER_TAKER_FEE;
    const totalFees = entryFee + exitFee;
    const netPnl = grossPnl - totalFees;

    return {
      id: `sim-${tradeIdCounter++}`,
      symbol: config.SYMBOL,
      side,
      entryPrice,
      exitPrice,
      size,
      pnl: netPnl,
      timestamp,
    };
  }
}