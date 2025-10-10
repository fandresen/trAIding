// src/types/broker.ts

export interface OrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type:
    | "LIMIT"
    | "MARKET"
    | "STOP"
    | "STOP_MARKET"
    | "TAKE_PROFIT"
    | "TAKE_PROFIT_MARKET"
    | "TRAILING_STOP_MARKET";
  quantity: number; // Changed from string to number
  price?: number; // Changed from string to number
  timeInForce?: "GTC" | "IOC" | "FOK" | "GTX";
  reduceOnly?: boolean; // Changed to boolean for consistency
  newClientOrderId?: string;
  stopPrice?: number; // Changed from string to number
  workingType?: "MARK_PRICE" | "CONTRACT_PRICE";
  priceProtect?: boolean; // Changed to boolean
  newOrderRespType?: "ACK" | "RESULT";
  positionSide?: "BOTH" | "LONG" | "SHORT";
}
