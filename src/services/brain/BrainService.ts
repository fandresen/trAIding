// src/services/brain/BrainService.ts
import { EMA } from "technicalindicators";
import { AnalysisResult } from "../../types/indicators";
import { Kline } from "../../types/kline";

export class BrainService {
  /**
   * Analyse les données du marché et retourne une décision de trading.
   * @param klines1m Données des bougies sur 1 minute.
   * @param klines15m Données des bougies sur 15 minutes.
   * @param indicator Les indicateurs techniques calculés sur 1m.
   * @returns "BUY", "SELL", or "WAIT"
   */
  public getDecision(
    klines1m: Kline[],
    klines15m: Kline[],
    indicator: AnalysisResult
  ): "BUY" | "SELL" | "WAIT" {
    // --- 1. Tendance sur M15 : EMA 20 ---
    const closePrices15m = klines15m.map((k) => parseFloat(k.close));
    const ema20_15m = EMA.calculate({
      period: 20,
      values: closePrices15m,
    }).pop(); // Récupérer la dernière valeur

    if (!ema20_15m) {
      console.warn(
        "[BRAIN] Not enough data to calculate 15m EMA. Decision: WAIT."
      );
      return "WAIT";
    }

    const lastClose15m = parseFloat(klines15m[klines15m.length - 1]!.close);
    const uptrend = lastClose15m > ema20_15m;

    // --- 2. RSI sur M1 (dernières valeurs pour comparer) ---
    // L'AnalyzerService nous donne déjà la dernière valeur du RSI
    const rsi_current = indicator.rsi.value_14;

    // Pour obtenir la valeur précédente, nous devons la recalculer ici
    const closePrices1m = klines1m.map((k) => parseFloat(k.close));
    const rsiValues = EMA.calculate({ period: 14, values: closePrices1m });
    if (rsiValues.length < 2) {
      console.warn(
        "[BRAIN] Not enough data for previous RSI. Decision: WAIT."
      );
      return "WAIT";
    }
    const rsi_prev = rsiValues[rsiValues.length - 2]!;

    // --- 3. Logique de trading ---

    // ACHAT : tendance haussière + RSI qui monte (momentum)
    if (uptrend && rsi_prev < 55 && rsi_current > rsi_prev) {
      console.log("[BRAIN] Decision: BUY (Uptrend + RSI Momentum)");
      return "BUY";
    }
    // VENTE : tendance baissière + RSI qui descend (momentum)
    else if (!uptrend && rsi_prev > 45 && rsi_current < rsi_prev) {
      console.log("[BRAIN] Decision: SELL (Downtrend + RSI Momentum)");
      return "SELL";
    }

    return "WAIT";
  }
}