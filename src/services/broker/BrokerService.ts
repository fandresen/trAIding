// src/services/broker/BrokerService.ts

import { NewFuturesOrderParams, USDMClient } from "binance";
import { config } from "../../config";
import { AnalysisResult } from "../../types/indicators";
import { DashboardContext, Trade } from "../../types/dashboard";
import { Kline } from "../../types/kline";
import { TradeHistoryService } from "../history/TradeHistoryService";

/**
 * Service to calculate and execute trades with the broker (Binance).
 */
export class BrokerService {
  private client: USDMClient;
  private tradeHistoryService: TradeHistoryService;

  constructor() {
    this.client = new USDMClient({
      api_key: config.API_KEY,
      api_secret: config.API_SECRET,
    });
    this.tradeHistoryService = new TradeHistoryService();
  }

  /**
   * Calculates order parameters and executes the trade.
   * @param decision The strategic decision from the AI ("BUY" or "SELL").
   * @param analysis The technical analysis result.
   * @param context The current dashboard context.
   * @param lastKline The last kline for entry price.
   */
  public async executeTrade(
    decision: "BUY" | "SELL",
    analysis: AnalysisResult,
    context: DashboardContext,
    lastKline: Kline
  ): Promise<void> {
    const { orderParams, stopLossPrice, takeProfitPrice } =
      this.calculateOrderParams(decision, analysis, context, lastKline);

    console.log(
      `[BROKER] Calculated Order Params:`,
      JSON.stringify(orderParams, null, 2)
    );

    try {
      // Execute Main Order
      const mainOrder = await this.client.submitNewOrder(orderParams);
      console.log("[BROKER] Main order successfully placed:", mainOrder);

      const trade: Trade = {
        id: mainOrder.orderId.toString(),
        symbol: mainOrder.symbol,
        side: decision,
        entryPrice: parseFloat(String(mainOrder.avgPrice)),
        exitPrice: 0, // Not yet exited
        size: parseFloat(String(mainOrder.origQty)),
        pnl: 0, // Not yet realized
        timestamp: mainOrder.updateTime,
      };
      await this.tradeHistoryService.addTrade(trade);

      const oppositeSide = decision === "BUY" ? "SELL" : "BUY";

      // Place Take Profit Order
      const takeProfitParams: NewFuturesOrderParams = {
        symbol: config.SYMBOL,
        side: oppositeSide,
        type: "TAKE_PROFIT_MARKET",
        stopPrice: takeProfitPrice,
        quantity: orderParams.quantity!,
        reduceOnly: "true",
      };
      const takeProfitOrder = await this.client.submitNewOrder(
        takeProfitParams
      );
      console.log("[BROKER] Take Profit order placed:", takeProfitOrder);

      // Place Stop Loss Order
      const stopLossParams: NewFuturesOrderParams = {
        symbol: config.SYMBOL,
        side: oppositeSide,
        type: "STOP_MARKET",
        stopPrice: stopLossPrice,
        quantity: orderParams.quantity!,
        reduceOnly: "false",
      };
      const stopLossOrder = await this.client.submitNewOrder(stopLossParams);
      console.log("[BROKER] Stop Loss order placed:", stopLossOrder);
    } catch (error) {
      console.error("[BROKER] Error placing order:", error);
    }
  }

  /**
   * Calculates the precise parameters for the order.
   */
  private calculateOrderParams(
    decision: "BUY" | "SELL",
    analysis: AnalysisResult,
    context: DashboardContext,
    lastKline: Kline
  ): {
    orderParams: NewFuturesOrderParams;
    stopLossPrice: number;
    takeProfitPrice: number;
  } {
    const { RISK_MANAGEMENT: rules } = config;

    const positionSizeUSD =
      context.activeContext.riskRules.calculatedPositionSizeUsd;
    const entryPrice = parseFloat(lastKline.close);
    const atrValue = analysis.atr.value_14;

    const stopLossDistance = atrValue * 1.5;

    let stopLossPrice: number;
    let takeProfitPrice: number;

    if (decision === "BUY") {
      stopLossPrice = entryPrice - stopLossDistance;
      takeProfitPrice = entryPrice + stopLossDistance * rules.RISK_REWARD_RATIO;
    } else {
      // SELL
      stopLossPrice = entryPrice + stopLossDistance;
      takeProfitPrice = entryPrice - stopLossDistance * rules.RISK_REWARD_RATIO;
    }

    const quantityInBtc = positionSizeUSD / entryPrice;

    const orderParams: NewFuturesOrderParams = {
      symbol: config.SYMBOL,
      side: decision,
      type: "MARKET",
      quantity: parseFloat(quantityInBtc.toFixed(4)), // Keep precision but convert back to number
    };

    return { orderParams, stopLossPrice, takeProfitPrice };
  }
}
