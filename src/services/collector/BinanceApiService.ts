// src/services/collector/BinanceApiService.ts
import { USDMClient, Kline as BinanceKline, KlineInterval } from "binance";
import { config } from "../../config";
import { Kline } from "../../types/kline";

/**
 * Service to interact with the Binance REST API.
 */
export class BinanceApiService {
  private client: USDMClient;

  constructor() {
    // Les clés API ne sont pas nécessaires pour l'endpoint klines public.
    this.client = new USDMClient({
      // api_key: config.API_KEY,  // Décommenter si des appels privés sont nécessaires
      // api_secret: config.API_SECRET, // Décommenter si des appels privés sont nécessaires
    });
  }

  /**
   * Fetches historical kline data from Binance.
   * @param symbol The trading symbol (e.g., 'BTCUSDT').
   * @param interval The kline interval (e.g., '1m', '15m').
   * @param limit The number of klines to retrieve.
   * @returns A promise that resolves to an array of Kline objects.
   */
  public async getHistoricalKlines(
    symbol: string,
    interval: KlineInterval,
    limit: number
  ): Promise<Kline[]> {
    console.log(
      `Fetching historical ${limit} klines for ${symbol} on ${interval} interval...`
    );
    try {
      const klinesData: BinanceKline[] = await this.client.getKlines({
        symbol,
        interval,
        limit,
      });

      // Map the API response to our clean Kline interface
      const klines: Kline[] = klinesData.map((k: any[]) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
      }));

      console.log(`Successfully fetched ${klines.length} historical klines.`);
      return klines;
    } catch (error) {
      console.error("Error fetching historical klines:", error);
      throw error;
    }
  }
}
