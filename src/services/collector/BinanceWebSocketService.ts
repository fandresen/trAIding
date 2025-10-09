// src/services/collector/BinanceWebSocketService.ts
import { KlineInterval, WebsocketClient, isWsFormattedKline } from "binance";
import type { Kline } from "../../types/kline";
import { config } from "../../config/index";
import EventEmitter from "events";
import { CacheService } from "../CacheService";

/**
 * Connects to Binance WebSocket streams and updates a CacheService with new kline data.
 */
export class BinanceWebSocketService extends EventEmitter {
  private wsClient: WebsocketClient;
  private readonly symbol: string;
  private cacheService: CacheService;

  constructor(cacheService: CacheService) {
    super();
    this.symbol = config.SYMBOL;
    this.cacheService = cacheService;

    this.wsClient = new WebsocketClient({
      // api_key: config.API_KEY, // Non requis pour les streams publics
      // api_secret: config.API_SECRET,
      beautify: true, // Formate les messages pour une lecture facile
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.wsClient.on("open", (data) => {
      console.log(`WebSocket connection opened for wsKey: ${data.wsKey}`);
    });

    this.wsClient.on("formattedMessage", (data) => {
      if (isWsFormattedKline(data) && data.kline.final) {
        const { kline, streamName } = data;
        const interval = streamName.split("@")[1]!.replace("kline_", "");

        const closedKline: Kline = {
          openTime: kline.startTime,
          open: String(kline.open),
          high: String(kline.high),
          low: String(kline.low),
          close: String(kline.close),
          volume: String(kline.volume),
        };

        this.cacheService.addKline(interval, closedKline);
        this.emit(`kline:updated`, { interval, kline: closedKline });
      }
    });

    this.wsClient.on("reconnecting", (data) => {
      console.log(`WebSocket automatically reconnecting.... ${data.wsKey}`);
    });

    this.wsClient.on("reconnected", (data) => {
      console.log(`WebSocket has reconnected. ${data.wsKey}`);
    });
  }

  /**
   * Connects to the kline stream for a specific interval.
   * @param interval The interval to connect to (e.g., '1m', '15m').
   */
  public connect(interval: KlineInterval): void {
    console.log(
      `Subscribing to kline stream for ${this.symbol} on ${interval}...`
    );
    this.wsClient.subscribeKlines(this.symbol, interval, "usdm");
  }

  /**
   * Closes all active WebSocket connections.
   */
  public closeAll(): void {
    console.log("Closing all Binance WebSocket connections.");
    this.wsClient.closeAll();
  }
}
