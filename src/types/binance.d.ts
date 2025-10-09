// src/types/binance.d.ts

declare module '@binance/connector' {
  import { EventEmitter } from 'events';

  // Define the structure for the constructor options, based on your code
  interface WebsocketStreamOptions {
    callbacks?: {
      open?: () => void;
      close?: () => void;
      message?: (data: string) => void;
    };
  }
  
  interface SpotOptions {
    baseURL?: string;
  }

  // Declare the classes you are actually using
  export class Spot {
    constructor(apiKey?: string, apiSecret?: string, options?: SpotOptions);
    klines(symbol: string, interval: string, options?: { limit?: number }): Promise<{ data: any[] }>;
  }

  export class WebsocketStream extends EventEmitter {
    constructor(options?: WebsocketStreamOptions);
    kline(symbol: string, interval: string): void;
    disconnect(): void;
  }
}