/**
 * Represents a single Kline (candlestick) data point.
 */
export interface Kline {
  /**
   * The opening time of the kline, as a Unix timestamp.
   */
  openTime: number;
  /**
   * The opening price.
   */
  open: string;
  /**
   * The highest price during the kline.
   */
  high: string;
  /**
   * The lowest price during the kline.
   */
  low: string;
  /**
   * The closing price.
   */
  close: string;
  /**
   * The volume of trades during the kline.
   */
  volume: string;
}
