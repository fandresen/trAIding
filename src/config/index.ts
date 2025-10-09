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
} = {
  API_URL: "https://api.binance.com",
  WEBSOCKET_URL: "wss://stream.binance.com:9443/ws",
  SYMBOL: "BTCUSDT",
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
};
