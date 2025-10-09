// src/services/BinanceWebSocketService.ts
import { WebsocketStream } from '@binance/connector';
import type { Kline } from '../types/kline';
import { config } from '../config/index';
import EventEmitter from 'events';

/**
 * A service that connects to the Binance WebSocket stream for Kline (candlestick) data
 * using the official Binance Connector.
 *
 * @extends EventEmitter
 */
export class BinanceWebSocketService extends EventEmitter {
  private ws: WebsocketStream | null = null;
  private readonly symbol: string;
  private readonly interval: string;

  constructor() {
    super();
    this.symbol = config.SYMBOL;
    this.interval = config.INTERVAL;
    this.connect();
  }

  private connect(): void {
    console.log(`Attempting to connect to Binance WebSocket for ${this.symbol}...`);

    this.ws = new WebsocketStream({
        callbacks: {
            open: () => console.log(`Binance WebSocket connection established for ${this.symbol}.`),
            close: () => console.log('Binance WebSocket connection closed.'),
            message: this.onMessage.bind(this)
        }
    });

    this.ws.kline(this.symbol.toLowerCase(), this.interval);
  }

  private onMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // We are only interested in 'kline' events where the kline is closed.
      if (message.e === 'kline' && message.k.x === true) {
        const klineData = message.k;

        // Map the raw data to our clean 'Kline' interface.
        const closedKline: Kline = {
          openTime: klineData.t,
          open: klineData.o,
          high: klineData.h,
          low: klineData.l,
          close: klineData.c,
          volume: klineData.v,
        };

        this.emit('kline:closed', closedKline);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  public close(): void {
    if (this.ws) {
      console.log('Closing Binance WebSocket connection permanently.');
      this.ws.disconnect();
      this.ws = null;
    }
  }
}