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
      // Ensure that if the file is empty, we don't crash on JSON.parse
      return fileContent ? (JSON.parse(fileContent) as Trade[]) : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Writes the entire trade history to the file.
   * @param trades The array of trades to write.
   */
  private async writeHistory(trades: Trade[]): Promise<void> {
    await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(trades, null, 2), 'utf-8');
  }

  /**
   * Writes a new trade to the history file.
   * @param trade The new trade to add.
   */
  public async addTrade(trade: Trade): Promise<void> {
    const history = await this.readHistory();
    history.push(trade);
    await this.writeHistory(history);
  }

  /**
   * Finds a trade by its ID, updates it, and saves the history.
   * @param updatedTrade The trade object containing the updated data.
   */
  public async updateTrade(updatedTrade: Trade): Promise<void> {
    const history = await this.readHistory();
    const tradeIndex = history.findIndex(t => t.id === updatedTrade.id);

    if (tradeIndex !== -1) {
      console.log(`[HISTORY] Updating trade ${updatedTrade.id}...`);
      history[tradeIndex] = updatedTrade;
      await this.writeHistory(history);
    } else {
      console.warn(`[HISTORY] Could not find trade with ID ${updatedTrade.id} to update.`);
    }
  }

  /**
   * Gets all trades that occurred today.
   * @returns A promise that resolves to an array of today's trades.
   */
  public async getTodaysTrades(): Promise<Trade[]> {
    const history = await this.readHistory();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return history.filter(trade => new Date(trade.timestamp) >= today);
  }
}