// src/services/broker/BrokerService.ts

import { NewFuturesOrderParams, USDMClient } from "binance";
import { config } from "../../config";
import { AnalysisResult } from "../../types/indicators";
import { DashboardContext, Trade } from "../../types/dashboard";
import { Kline } from "../../types/kline";
import { TradeHistoryService } from "../history/TradeHistoryService";
import { SlackNotificationService } from "../notification/SlackNotificationService";

/**
 * Service to calculate and execute trades with the broker (Binance).
 */
export class BrokerService {
  private client: USDMClient;
  private tradeHistoryService: TradeHistoryService;
  private slackService: SlackNotificationService;

  constructor() {
    this.client = new USDMClient({
      api_key: config.API_KEY,
      api_secret: config.API_SECRET,
    });
    this.tradeHistoryService = new TradeHistoryService();
    this.slackService = new SlackNotificationService();
  }

  /**
   * Calculates order parameters and executes the trade.
   */
  public async executeTrade(
    decision: "BUY" | "SELL",
    analysis: AnalysisResult,
    context: DashboardContext,
    lastKline: Kline
  ): Promise<void> {
    const { orderParams, stopLossPrice, takeProfitPrice } =
      this.calculateOrderParams(decision, analysis, context, lastKline);

    if (orderParams.quantity! <= 0) {
      console.log("[BROKER] Calculated quantity is too small. Skipping order.");
      return;
    }

    console.log(
      `[BROKER] Calculated Order Params:`,
      JSON.stringify(orderParams, null, 2)
    );

    let mainOrder;

    try {
      // Étape 1: Exécuter l'ordre principal (MARKET)
      mainOrder = await this.client.submitNewOrder(orderParams);
      console.log("[BROKER] Main order successfully placed:", mainOrder);

      // Enregistrer le trade immédiatement
      const trade: Trade = {
        id: mainOrder.orderId.toString(),
        symbol: mainOrder.symbol,
        side: decision,
        entryPrice: parseFloat(String(mainOrder.avgPrice)),
        exitPrice: 0,
        size: parseFloat(String(mainOrder.origQty)),
        pnl: 0,
        timestamp: mainOrder.updateTime,
      };
      await this.tradeHistoryService.addTrade(trade);
    } catch (error) {
      console.error("[BROKER] CRITICAL: Failed to place main order:", error);
      await this.slackService.sendError(
        error as Error,
        "CRITICAL: Main Order Failed"
      );
      return;
    }

    try {
      // Étape 2: Placer les ordres Take Profit et Stop Loss
      const oppositeSide = decision === "BUY" ? "SELL" : "BUY";
      const quantity = parseFloat(String(mainOrder.origQty));

      const takeProfitParams: NewFuturesOrderParams = {
        symbol: config.SYMBOL,
        side: oppositeSide,
        type: "LIMIT",
        price: parseFloat(takeProfitPrice.toFixed(4)), // Précision à ajuster selon le symbole
        quantity: quantity,
        reduceOnly: "true",
        timeInForce: "GTC",
      };

      const stopLossParams: NewFuturesOrderParams = {
        symbol: config.SYMBOL,
        side: oppositeSide,
        type: "STOP_MARKET",
        stopPrice: parseFloat(stopLossPrice.toFixed(4)), // Précision à ajuster
        quantity: quantity,
        reduceOnly: "true",
      };

      // Utiliser Promise.all pour les envoyer en parallèle
      await Promise.all([
        this.client.submitNewOrder(takeProfitParams),
        this.client.submitNewOrder(stopLossParams),
      ]);

      console.log(
        `[BROKER] Successfully placed TP and SL orders for order ${mainOrder.orderId}.`
      );
    } catch (error) {
      console.error(
        `[BROKER] CRITICAL: Failed to place SL/TP for order ${mainOrder.orderId}. Initiating emergency close!`,
        error
      );
      // await this.slackService.sendError(error as Error, `CRITICAL: SL/TP Failed for order ${mainOrder.orderId}. EMERGENCY CLOSE!`); // Décommenter

      // Étape 3: "Rollback" - Fermeture d'urgence de la position
      await this.emergencyClosePosition(
        mainOrder.symbol,
        parseFloat(String(mainOrder.origQty)),
        decision
      );
    }
  }

  private async emergencyClosePosition(
    symbol: string,
    quantity: number,
    originalSide: "BUY" | "SELL"
  ): Promise<void> {
    try {
      const closeSide = originalSide === "BUY" ? "SELL" : "BUY";
      const closeOrder: NewFuturesOrderParams = {
        symbol,
        side: closeSide,
        type: "MARKET",
        quantity,
        reduceOnly: "true",
      };
      const closedOrderResult = await this.client.submitNewOrder(closeOrder);
      console.log(
        `[BROKER] EMERGENCY CLOSE executed successfully for ${symbol}.`,
        closedOrderResult
      );
      await this.slackService.sendError(
        new Error("Position closed due to SL/TP failure."),
        "EMERGENCY CLOSE SUCCESS"
      );
    } catch (closeError) {
      console.error(
        `[BROKER] CATASTROPHIC: FAILED TO EXECUTE EMERGENCY CLOSE for ${symbol}. MANUAL INTERVENTION REQUIRED!`,
        closeError
      );
      await this.slackService.sendError(
        closeError as Error,
        "CATASTROPHIC: FAILED EMERGENCY CLOSE. MANUAL INTERVENTION REQUIRED!"
      );
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

    const quantityInXrp = positionSizeUSD / entryPrice;

    const orderParams: NewFuturesOrderParams = {
      symbol: config.SYMBOL,
      side: decision,
      type: "MARKET",
      quantity: parseFloat(quantityInXrp.toFixed(1)), // Quantity precision for XRP is 1
    };

    return { orderParams, stopLossPrice, takeProfitPrice };
  }
}
