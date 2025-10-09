import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { Kline } from '../types/kline';
import { config } from '../config/index';

/**
 * Interface for the raw Kline data received from the Binance WebSocket API.
 * This represents the 'k' object in the WebSocket message.
 */
interface BinanceKline {
  t: number; // Kline start time
  T: number; // Kline close time
  s: string; // Symbol
  i: string; // Interval
  f: number; // First trade ID
  L: number; // Last trade ID
  o: string; // Open price
  c: string; // Close price
  h: string; // High price
  l: string; // Low price
  v: string; // Base asset volume
  n: number; // Number of trades
  x: boolean; // Is this kline closed?
  q: string; // Quote asset volume
  V: string; // Taker buy base asset volume
  Q: string; // Taker buy quote asset volume
  B: string; // Ignore
}

/**
 * Interface for the full WebSocket message payload from Binance.
 */
interface BinanceWebSocketMessage {
  e: string; // Event type (e.g., 'kline')
  E: number; // Event time
  s: string; // Symbol
  k: BinanceKline; // The kline data
}

/**
 * A service that connects to the Binance WebSocket stream for Kline (candlestick) data.
 * It handles connection, automatic reconnection with exponential backoff, and message parsing.
 * When a kline is closed, it emits a 'kline:closed' event with the structured data.
 *
 * @extends EventEmitter
 */
export class BinanceWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectDelay: number = config.RECONNECT_CONFIG.initialDelay;
  private isClosing: boolean = false;
  private readonly streamUrl: string;

  /**
   * Constructs the service and initiates the WebSocket connection.
   */
  constructor() {
    super();
    // e.g., 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m'
    this.streamUrl = `${config.WEBSOCKET_URL}/${config.SYMBOL.toLowerCase()}@kline_${config.INTERVAL}`;
    this.connect();
  }

  /**
   * Establishes a connection to the Binance WebSocket stream.
   * It sets up all the necessary event listeners for the WebSocket instance.
   */
  private connect(): void {
    if (this.isClosing) {
      return; // Do not attempt to connect if the service is closing.
    }

    console.log(`Attempting to connect to ${this.streamUrl}...`);
    this.ws = new WebSocket(this.streamUrl);

    this.ws.on('open', this.onOpen.bind(this));
    this.ws.on('message', this.onMessage.bind(this));
    this.ws.on('close', this.onClose.bind(this));
    this.ws.on('error', this.onError.bind(this));
  }

  /**
   * Called when the WebSocket connection is successfully opened.
   * Resets the reconnection delay.
   */
  private onOpen(): void {
    console.log('Binance WebSocket connection established.');
    // On a successful connection, reset the reconnect delay to its initial value.
    this.reconnectDelay = config.RECONNECT_CONFIG.initialDelay;
  }

  /**
   * Called when a message is received from the WebSocket.
   * It parses the message, and if it's a closed kline, emits the 'kline:closed' event.
   * @param data The raw data received from the WebSocket.
   */
  private onMessage(data: WebSocket.Data): void {
    try {
      const message: BinanceWebSocketMessage = JSON.parse(data.toString());

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

  /**
   * Called when the WebSocket connection is closed.
   * If the closure was not intentional, it schedules a reconnection attempt.
   */
  private onClose(): void {
    console.log('Binance WebSocket connection closed.');
    // If the connection was not closed by a call to `close()`, try to reconnect.
    if (!this.isClosing) {
      this.scheduleReconnect();
    }
  }

  /**
   * Called when a WebSocket error occurs.
   * The 'close' event will usually follow, which handles the reconnection logic.
   * @param error The error object.
   */
  private onError(error: Error): void {
    console.error('Binance WebSocket error:', error.message);
  }

  /**
   * Schedules a reconnection attempt using an exponential backoff strategy.
   * This prevents overwhelming the server with connection requests.
   */
  private scheduleReconnect(): void {
    console.log(`Scheduling reconnect in ${this.reconnectDelay}ms...`);
    setTimeout(() => this.connect(), this.reconnectDelay);

    // Increase the delay for the next attempt, up to a maximum.
    this.reconnectDelay = Math.min(
      this.reconnectDelay * config.RECONNECT_CONFIG.factor,
      config.RECONNECT_CONFIG.maxDelay
    );
  }

  /**
   * Gracefully closes the WebSocket connection and prevents reconnection.
   */
  public close(): void {
    if (this.ws) {
      console.log('Closing Binance WebSocket connection permanently.');
      this.isClosing = true;
      this.ws.close();
      this.ws = null;
    }
  }
}
