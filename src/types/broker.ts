// src/types/broker.ts

export interface OrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: string;
  price?: string; // Le prix d'entrée, optionnel pour un ordre MARKET
  takeProfit?: string;
  stopLoss?: string;
}