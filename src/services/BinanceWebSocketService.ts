// src/services/BinanceWebSocketService.ts
// import { WebsocketStream } from ' @binance/connector';
import type { Kline } from '../types/kline';
import { config } from '../config/index';
import EventEmitter from 'events';
import { CacheService } from './CacheService'; // Import du CacheService
import { WebsocketStream } from '@binance/connector';

/**
 * Connects to Binance WebSocket streams and updates a CacheService with new kline data.
 */
export class BinanceWebSocketService extends EventEmitter {
  private connections: Map<string, WebsocketStream> = new Map();
  private readonly symbol: string;
  // Le service dépend maintenant du CacheService
  private cacheService: CacheService;

  constructor(cacheService: CacheService) {
    super();
    this.symbol = config.SYMBOL;
    this.cacheService = cacheService;
  }

  /**
   * Connects to the kline stream for a specific interval.
   * @param interval The interval to connect to (e.g., '1m', '15m').
   */
  public connect(interval: string): void {
    if (this.connections.has(interval)) {
      console.log(`Connection for ${interval} already exists.`);
      return;
    }

    console.log(`Attempting to connect to Binance WebSocket for ${this.symbol} on ${interval}...`);
    
    const ws = new WebsocketStream({
      callbacks: {
        open: () => console.log(`WebSocket connection established for ${interval}.`),
        close: () => console.log(`WebSocket connection closed for ${interval}.`),
        message: (data: string) => this.onMessage(data, interval),
      },
    });

    ws.kline(this.symbol.toLowerCase(), interval);
    this.connections.set(interval, ws);
  }

  private onMessage(data: string, interval: string): void {
    try {
      const message = JSON.parse(data);

      if (message.e === 'kline' && message.k.x === true) {
        const klineData = message.k;

        const closedKline: Kline = {
          openTime: klineData.t,
          open: klineData.o,
          high: klineData.h,
          low: klineData.l,
          close: klineData.c,
          volume: klineData.v,
        };
        
        // Mettre à jour le cache au lieu d'émettre directement la bougie
        this.cacheService.addKline(interval, closedKline);

        // Émettre un événement pour signaler que le cache a été mis à jour
        this.emit(`kline:updated`, { interval, kline: closedKline });
      }
    } catch (error) {
      console.error(`Error parsing WebSocket message for ${interval}:`, error);
    }
  }

  /**
   * Closes all active WebSocket connections.
   */
  public closeAll(): void {
    console.log('Closing all Binance WebSocket connections.');
    this.connections.forEach((ws, interval) => {
      ws.disconnect();
      console.log(`Connection for ${interval} closed.`);
    });
    this.connections.clear();
  }
}