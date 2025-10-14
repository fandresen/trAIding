// src/services/manager/PositionManagerService.ts

import { WebsocketClient } from "binance";
import { config } from "../../config";
import { Trade } from "../../types/dashboard";
import { BrokerService } from "../broker/BrokerService";
import { TradeHistoryService } from "../history/TradeHistoryService";

/**
 * Service to actively manage a single open trade.
 */
export class PositionManagerService {
  private wsClient: WebsocketClient;
  private brokerService: BrokerService;
  private tradeHistoryService: TradeHistoryService;
  private openTrade: Trade | null = null;

  constructor(
    brokerService: BrokerService,
    tradeHistoryService: TradeHistoryService
  ) {
    this.brokerService = brokerService;
    this.tradeHistoryService = tradeHistoryService;
    this.wsClient = new WebsocketClient({ beautify: true });
    this.setupListeners();
  }

  private setupListeners(): void {
    // This listener will fire on every single price change
    this.wsClient.on("formattedMessage", (data: any) => {
      if (data.eventType === "markPriceUpdate" && this.openTrade) {
        const currentPrice = parseFloat(data.markPrice);
        this.checkTradeStatus(currentPrice);
      }
    });
  }

  /**
   * Starts managing a newly opened trade.
   */
  public manageTrade(trade: Trade): void {
    if (this.openTrade) {
      console.warn("[MANAGER] Already managing a trade. Ignoring new request.");
      return;
    }
    this.openTrade = trade;
    this.wsClient.subscribeMarkPrice(config.SYMBOL, "usdm");
    console.log(
      `[MANAGER] Started managing trade ${trade.id}. Watching for activation price.`
    );
  }

  /**
   * Stops managing the current trade (e.g., when it's closed or switched to trailing).
   */
  public stopManaging(): void {
    if (this.openTrade) {
      const topic = `${config.SYMBOL.toLowerCase()}@markPrice@1s`;
      this.wsClient.unsubscribe(topic, "usdm");

      this.openTrade = null;
      console.log("[MANAGER] Stopped managing trade.");
    }
  }

  private async checkTradeStatus(currentPrice: number): Promise<void> {
    if (!this.openTrade || this.openTrade.isTrailingActive) {
      return;
    }

    const { entryPrice, takeProfitPrice, side } = this.openTrade;
    const activationPrice =
      entryPrice! + (takeProfitPrice! - entryPrice!) * 0.5;

    let shouldActivate = false;
    if (side === "BUY" && currentPrice >= activationPrice) {
      shouldActivate = true;
    } else if (side === "SELL" && currentPrice <= activationPrice) {
      shouldActivate = true;
    }

    if (shouldActivate) {
      console.log(
        `[MANAGER] Activation price ${activationPrice.toFixed(
          4
        )} reached! Switching to trailing stop.`
      );
      await this.brokerService.switchToTrailingStop(this.openTrade);

      // Update the trade in history and stop managing it
      this.openTrade.isTrailingActive = true;
      await this.tradeHistoryService.updateTrade(this.openTrade);
      this.stopManaging();
    }
  }
}
