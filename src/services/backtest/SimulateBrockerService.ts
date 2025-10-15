// src/services/backtest/SimulatedBrokerService.ts
import { BollingerBands } from "technicalindicators";
import { AnalysisResult } from "../../types/indicators";
import { DashboardContext, Trade } from "../../types/dashboard";
import { config } from "../../config";
import { Kline } from "../../types/kline";

let tradeIdCounter = 0;
const MAKER_TAKER_FEE = 0.0005; // 0.05%

export class SimulatedBrokerService {
  /**
   * Simule l'exécution d'un trade et retourne le trade complété avec son PnL.
   */
  public executeTrade(
    decision: "BUY" | "SELL",
    analysis: AnalysisResult,
    context: DashboardContext,
    entryPrice: number,
    entryTimestamp: number,
    dataFeed: { price: number; timestamp: number }[],
    klines1m: Kline[] // Paramètre ajouté pour le calcul
  ): Trade | null {
    const { RISK_MANAGEMENT: rules } = config;
    const positionSizeUSD =
      context.activeContext.riskRules.calculatedPositionSizeUsd;
    const quantity = positionSizeUSD / entryPrice;

    // --- ✅ NOUVELLE LOGIQUE: Stop-loss dynamique avec les Bandes de Bollinger ---
    const closePrices1m = klines1m.map((k) => parseFloat(k.close));
    const bbInput = { period: 20, values: closePrices1m, stdDev: 2 };
    const lastBB = BollingerBands.calculate(bbInput).pop();

    if (!lastBB) {
      console.warn("[SIMULATOR] Could not calculate Bollinger Bands for SL.");
      return null; // Impossible de définir un SL, on annule le trade
    }

    let stopLossPrice: number;

    if (decision === "BUY") {
      stopLossPrice = lastBB.lower; // Stop-loss sur la bande inférieure
    } else {
      stopLossPrice = lastBB.upper; // Stop-loss sur la bande supérieure
    }

    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);

    // Le Take Profit est calculé à partir de la distance du stop dynamique
    const takeProfitPrice =
      decision === "BUY"
        ? entryPrice + stopLossDistance * rules.RISK_REWARD_RATIO
        : entryPrice - stopLossDistance * rules.RISK_REWARD_RATIO;
    // --- Fin de la nouvelle logique ---

    // Parcourir les données futures pour voir si SL ou TP est touché
    for (const tick of dataFeed) {
      if (decision === "BUY") {
        if (tick.price <= stopLossPrice) {
          return this.createClosedTrade(
            "BUY",
            entryPrice,
            stopLossPrice,
            quantity,
            entryTimestamp
          );
        }
        if (tick.price >= takeProfitPrice) {
          return this.createClosedTrade(
            "BUY",
            entryPrice,
            takeProfitPrice,
            quantity,
            entryTimestamp
          );
        }
      } else {
        // SELL
        if (tick.price >= stopLossPrice) {
          return this.createClosedTrade(
            "SELL",
            entryPrice,
            stopLossPrice,
            quantity,
            entryTimestamp
          );
        }
        if (tick.price <= takeProfitPrice) {
          return this.createClosedTrade(
            "SELL",
            entryPrice,
            takeProfitPrice,
            quantity,
            entryTimestamp
          );
        }
      }
    }
    // Si ni SL ni TP n'est touché à la fin des données, on ignore le trade
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