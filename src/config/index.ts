// src/config/index.ts
import dotenv from "dotenv";

dotenv.config();

type Interval = "1m" | "15m";

export const config: {
  API_URL: string;
  WEBSOCKET_URL: string;
  SYMBOL: string;
  INTERVALS: { [key: string]: Interval };
  CACHE_LIMITS: { [key in Interval]: number };
  API_KEY: string;
  API_SECRET: string;
  BRAIN_URL: string;
  SLACK_WEBHOOK_URL: string;
  PUSHOVER_USER_KEY: string;
  PUSHOVER_API_TOKEN: string;
  RISK_MANAGEMENT: {
    MAX_RISK_PER_TRADE_PERCENT: number;
    DAILY_PROFIT_TARGET_PERCENT: number;
    DAILY_LOSS_LIMIT_PERCENT: number;
    MAX_DRAWDOWN_PERCENT: number;
    RISK_REWARD_RATIO: number;
    MAX_TRADES_PER_DAY: number;
    ATR_VOLATILITY_THRESHOLD_MULTIPLIER: number;
  };
} = {
  API_URL: "https://fapi.binance.com",
  WEBSOCKET_URL: "wss://fstream.binance.com/ws",
  SYMBOL: "XRPUSDT",
  INTERVALS: {
    ONE_MINUTE: "1m",
    FIFTEEN_MINUTES: "15m",
  },
  CACHE_LIMITS: {
    "1m": 150,
    "15m": 50,
  },
  API_KEY: process.env.API_KEY!,
  API_SECRET: process.env.API_SECRET_KEY!,
  RISK_MANAGEMENT: {
    MAX_RISK_PER_TRADE_PERCENT: 2.0, // Risquer au maximum 5% du capital par trade
    DAILY_PROFIT_TARGET_PERCENT: 10.0, // Objectif de gain journalier de 10%
    DAILY_LOSS_LIMIT_PERCENT: 7.0, // Perte maximale journalière de 3%
    MAX_DRAWDOWN_PERCENT: 15.0, // Drawdown maximal du compte de 15%
    RISK_REWARD_RATIO: 2.0, // Viser un gain 2x plus grand que la perte (ex: TP à 1%, SL à 0.5%)
    MAX_TRADES_PER_DAY: 50,
    ATR_VOLATILITY_THRESHOLD_MULTIPLIER: 4.0,
  },
  BRAIN_URL: process.env.BRAIN_URL!,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL!,
  PUSHOVER_USER_KEY: process.env.PUSHOVER_USER_KEY!,
  PUSHOVER_API_TOKEN: process.env.PUSHOVER_API_TOKEN!,
};
