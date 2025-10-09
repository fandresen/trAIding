// src/types/indicators.ts

export interface EmaResult {
  fast_8: number;
  slow_21: number;
}

export interface RsiResult {
  value_14: number;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdResult {
  macd_line: number;
  signal_line: number;
  histogram: number;
}

export interface AtrResult {
  value_14: number;
}

export interface AnalysisResult {
  ema: EmaResult;
  rsi: RsiResult;
  bollingerBands: BollingerBandsResult;
  macd: MacdResult; 
  obv: number;      
  atr: AtrResult;   
}