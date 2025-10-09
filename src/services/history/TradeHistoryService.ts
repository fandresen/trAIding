// src/services/history/TradeHistoryService.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { Trade } from '../../types/dashboard';

const HISTORY_FILE_PATH = path.join(process.cwd(), 'trade-history.json');

/**
 * Manages reading from and writing to the trade history JSON file.
 */
export class TradeHistoryService {

  /**
   * Reads all trades from the history file.
   * @returns A promise that resolves to an array of Trade objects.
   */
  private async readHistory(): Promise<Trade[]> {
    try {
      await fs.access(HISTORY_FILE_PATH);
      const fileContent = await fs.readFile(HISTORY_FILE_PATH, 'utf-8');
      return JSON.parse(fileContent) as Trade[];
    } catch (error) {
      // If the file doesn't exist, return an empty array.
      return [];
    }
  }

  /**
   * Writes a new trade to the history file.
   * @param trade The new trade to add.
   */
  public async addTrade(trade: Trade): Promise<void> {
    const history = await this.readHistory();
    history.push(trade);
    await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
  }

  /**
   * Gets all trades that occurred today.
   * @returns A promise that resolves to an array of today's trades.
   */
  public async getTodaysTrades(): Promise<Trade[]> {
    const history = await this.readHistory();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to the beginning of the day

    return history.filter(trade => new Date(trade.timestamp) >= today);
  }
}