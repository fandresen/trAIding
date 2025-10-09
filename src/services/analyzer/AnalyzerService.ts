// src/services/analyzer/AnalyzerService.ts
import { EMA, RSI, BollingerBands, MACD, OBV, ATR } from "technicalindicators";
import { Kline } from "../../types/kline";
import { AnalysisResult } from "../../types/indicators";

/**
 * Service to calculate technical indicators from kline data.
 */
export class AnalyzerService {
  public analyze(klines: Kline[]): AnalysisResult | null {
    // Le MACD (26) est maintenant notre plus grande période requise
    if (klines.length < 26) {
      console.warn("Not enough kline data for a full analysis.");
      return null;
    }

    // Préparation des données pour les indicateurs
    const closePrices = klines.map((k) => parseFloat(k.close));
    const highPrices = klines.map((k) => parseFloat(k.high));
    const lowPrices = klines.map((k) => parseFloat(k.low));
    const volumes = klines.map((k) => parseFloat(k.volume));

    const emaFast = EMA.calculate({ period: 8, values: closePrices });
    const emaSlow = EMA.calculate({ period: 21, values: closePrices });
    const rsi = RSI.calculate({ period: 14, values: closePrices });
    const bb = BollingerBands.calculate({
      period: 20,
      values: closePrices,
      stdDev: 2,
    });

    const macdInput = {
      values: closePrices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    };
    const macd = MACD.calculate(macdInput);

    const obvInput = {
      close: closePrices,
      volume: volumes,
    };
    const obv = OBV.calculate(obvInput);

    const atrInput = {
      high: highPrices,
      low: lowPrices,
      close: closePrices,
      period: 14,
    };
    const atr = ATR.calculate(atrInput);

    // --- Assemblage du résultat final ---
    const result: AnalysisResult = {
      ema: {
        fast_8: emaFast[emaFast.length - 1]!,
        slow_21: emaSlow[emaSlow.length - 1]!,
      },
      rsi: {
        value_14: rsi[rsi.length - 1]!,
      },
      bollingerBands: bb[bb.length - 1]!,
      macd: {
        // Le résultat du MACD est un objet, on prend la dernière valeur
        macd_line: macd[macd.length - 1]!.MACD!,
        signal_line: macd[macd.length - 1]!.signal!,
        histogram: macd[macd.length - 1]!.histogram!,
      },
      obv: obv[obv.length - 1]!, // OBV est une valeur unique
      atr: {
        value_14: atr[atr.length - 1]!,
      },
    };

    return result;
  }
}
