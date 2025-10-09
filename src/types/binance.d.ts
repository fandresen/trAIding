declare module '@binance/connector' {
  export class WebsocketStream {
    constructor(options: any);
    kline(symbol: string, interval: string): void;
    disconnect(): void;
  }
}
