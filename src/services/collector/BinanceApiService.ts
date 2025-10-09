// src/services/BinanceApiService.ts
import { UMFutures } from '@binance/connector';
import { config } from '../../config';
import { Kline } from '../../types/kline';

/**
 * Service to interact with the Binance REST API.
 */
export class BinanceApiService {
  private client: UMFutures;

  constructor() {
    // No API keys are needed for the klines endpoint.
    this.client = new UMFutures('', '', { baseURL: config.API_URL });
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
    interval: string,
    limit: number
  ): Promise<Kline[]> {
    console.log(
      `Fetching historical ${limit} klines for ${symbol} on ${interval} interval...`
    );
    try {
      const { data } = await this.client.klines(symbol, interval, { limit });

      // Map the API response to our clean Kline interface
      const klines: Kline[] = data.map((k: any[]) => ({
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