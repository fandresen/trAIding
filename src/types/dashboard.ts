// src/types/dashboard.ts

import { numberInString } from "binance";

export interface AccountState {
  equity: number;
  availableBalance: number;
  unrealizedPnl: number;
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

export interface PerformanceMetrics {
  realizedPnlDaily: number;
  tradeCountDaily: number;
}

export interface RiskRules {
  // isTradingAllowed: boolean; // <-- FIX: This property is now removed
  calculatedPositionSizeUsd: number;
  dailyProfitTarget: number;
  dailyLossLimit: number;
}

export interface OpenPosition {
  symbol: string;
  positionAmt: numberInString; // Must be a string
  entryPrice: numberInString;
  markPrice: numberInString;
  unRealizedProfit: numberInString;
  liquidationPrice: numberInString;
}

export interface Trade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  timestamp: number;
}

export interface DashboardContext {
  accountState: AccountState;
  performanceMetrics: PerformanceMetrics;
  activeContext: {
    openPositions: OpenPosition[];
    riskRules: RiskRules;
  };
}