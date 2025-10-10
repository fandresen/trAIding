// src/services/broker/BrokerService.ts

import { USDMClient } from "binance";
import { config } from "../../config";
import { AnalysisResult } from "../../types/indicators";
import { DashboardContext } from "../../types/dashboard";
import { OrderParams } from "../../types/broker";
import { Kline } from "../../types/kline";

/**
 * Service to calculate and execute trades with the broker (Binance).
 */
export class BrokerService {
  private client: USDMClient;

  constructor() {
    this.client = new USDMClient({
      api_key: config.API_KEY,
      api_secret: config.API_SECRET,
    });
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
    // 2. Calcul des paramètres de l'ordre
    const orderParams = this.calculateOrderParams(
      decision,
      analysis,
      context,
      lastKline
    );
    console.log(
      `[BROKER] Calculated Order Params:`,
      JSON.stringify(orderParams, null, 2)
    );

    // 3. Exécution de l'ordre
    try {
      // Note : La méthode exacte peut varier. .submitNewOrder() est un exemple.
      // Consultez la documentation 'binance' pour la création d'ordres Futures (limit, SL, TP).
      // Souvent, il faut créer l'ordre 'LIMIT' puis deux ordres 'STOP_MARKET' séparés pour le SL/TP.
      // Pour la simplicité de l'exemple, nous simulons l'envoi.

      console.log(
        `[BROKER] Executing ${orderParams.side} order for ${orderParams.quantity} ${orderParams.symbol}.`
      );

      // const result = await this.client.submitNewOrder(orderParams);
      // console.log('[BROKER] Order successfully placed:', result);

      // Ici, vous ajouteriez aussi la logique pour enregistrer le trade dans l'historique
      // via le TradeHistoryService.
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
  ): OrderParams {
    const { RISK_MANAGEMENT: rules } = config;

    const positionSizeUSD =
      context.activeContext.riskRules.calculatedPositionSizeUsd;
    const entryPrice = parseFloat(lastKline.close);
    const atrValue = analysis.atr.value_14;

    // Calcul dynamique du Stop Loss basé sur l'ATR
    // Le multiplicateur (ex: 1.5) peut être ajusté ou mis dans la config
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

    // Conversion de la taille en USD vers l'unité de l'actif (BTC)
    const quantityInBtc = positionSizeUSD / entryPrice;

    return {
      symbol: config.SYMBOL,
      side: decision,
      type: "LIMIT", // ou "MARKET" selon la stratégie
      quantity: quantityInBtc.toFixed(4), // Adaptez la précision à BTC
      price: entryPrice.toFixed(2),
      stopLoss: stopLossPrice.toFixed(2),
      takeProfit: takeProfitPrice.toFixed(2),
    };
  }
}
