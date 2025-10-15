// src/services/collector/BinanceWebSocketService.ts
import { WebsocketClient, WsFormattedMessage } from "binance";
import EventEmitter from "events";
import { config } from "../../config/index";

/**
 * Interface décrivant la structure d'un message de trade agrégé formaté
 * que nous attendons du WebSocket avec l'option `beautify: true`.
 */
interface FormattedAggTrade {
  eventType: "aggTrade";
  eventTime: number;
  symbol: string;
  aggTradeId: number;
  price: string;
  quantity: string;
  firstTradeId: number;
  lastTradeId: number;
  tradeTime: number;
  isBuyerMaker: boolean;
}

/**
 * Un "Type Guard" pour vérifier si le message reçu est bien un message de trade.
 * Il vérifie la présence et la valeur de la propriété `eventType`.
 * @param data Le message reçu du WebSocket.
 * @returns `true` si le message est un trade agrégé, sinon `false`.
 */
function isFormattedAggTrade(data: any): data is FormattedAggTrade {
  return data && data.eventType === "aggTrade";
}

/**
 * Connects to Binance WebSocket streams.
 */
export class BinanceWebSocketService extends EventEmitter {
  private wsClient: WebsocketClient;
  private readonly symbol: string;

  constructor() {
    super();
    this.symbol = config.SYMBOL;
    this.wsClient = new WebsocketClient({ beautify: true });
    this.setupListeners();
  }

  private setupListeners(): void {
    this.wsClient.on("open", (data) => {
      console.log(`WebSocket connection opened for wsKey: ${data.wsKey}`);
    });

    // Utilise le type guard pour identifier le bon message
    this.wsClient.on("formattedMessage", (data: WsFormattedMessage) => {
      if (isFormattedAggTrade(data)) {
        // A l'intérieur de ce bloc, TypeScript sait que `data` est de type `FormattedAggTrade`
        this.emit("trade", {
          price: parseFloat(data.price),
          quantity: parseFloat(data.quantity),
          timestamp: data.tradeTime,
        });
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
   * Connects to the aggregate trade stream.
   */
  public connectToTrades(): void {
    console.log(`Subscribing to aggregate trade stream for ${this.symbol}...`);
    this.wsClient.subscribeAggregateTrades(this.symbol, "usdm");
  }

  /**
   * Closes all active WebSocket connections.
   */
  public closeAll(): void {
    console.log("Closing all Binance WebSocket connections.");
    this.wsClient.closeAll();
  }
}