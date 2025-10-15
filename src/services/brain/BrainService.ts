// src/services/brain/BrainService.ts
import { EMA, MACD, BollingerBands } from "technicalindicators";
import { Kline } from "../../types/kline";

export class BrainService {
  public getDecision(
    klines1m: Kline[],
    klines5m: Kline[]
  ): "BUY" | "SELL" | "WAIT" {
    
    // --- [1] Vérifications ---
    if (klines1m.length < 26 || klines5m.length < 50) return "WAIT"; // 26 est pour le MACD

    // --- [2] Tendance de Fond (M5) ---
    const closePrices5m = klines5m.map((k) => parseFloat(k.close));
    const ema20_5m = EMA.calculate({ period: 20, values: closePrices5m }).pop();
    const ema50_5m = EMA.calculate({ period: 50, values: closePrices5m }).pop();
    if (!ema20_5m || !ema50_5m) return "WAIT";
    const isUptrend = ema20_5m > ema50_5m;
    const isDowntrend = ema20_5m < ema50_5m;

    // --- [3] Confirmation Momentum & Point d'Entrée (M1) ---
    const closePrices1m = klines1m.map((k) => parseFloat(k.close));
    
    // a) MACD pour le momentum
    const macdInput = { values: closePrices1m, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false };
    const macdValues = MACD.calculate(macdInput);
    const lastMacd = macdValues[macdValues.length - 1];
    if (!lastMacd) return "WAIT";
    const isMacdBullish = lastMacd.MACD! > lastMacd.signal!;
    const isMacdBearish = lastMacd.MACD! < lastMacd.signal!;

    // b) Bandes de Bollinger pour le point d'entrée
    const bbInput = { period: 20, values: closePrices1m, stdDev: 2 };
    const bbValues = BollingerBands.calculate(bbInput);
    if (bbValues.length < 2) return "WAIT";
    const lastBB = bbValues[bbValues.length - 1]!;
    
    const lastClose = closePrices1m[closePrices1m.length - 1]!;
    const prevClose = closePrices1m[closePrices1m.length - 2]!;

    // --- [4] Logique de Décision Combinée ---

    // Signal d'ACHAT : Tendance haussière + Momentum haussier + Rebond sur la BB du milieu
    if (isUptrend && isMacdBullish && prevClose < lastBB.middle && lastClose > lastBB.middle) {
      return "BUY";
    }

    // Signal de VENTE : Tendance baissière + Momentum baissier + Rejet de la BB du milieu
    if (isDowntrend && isMacdBearish && prevClose > lastBB.middle && lastClose < lastBB.middle) {
      return "SELL";
    }

    return "WAIT";
  }
}