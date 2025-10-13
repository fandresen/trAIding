// src/services/history/CapitalHistoryService.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { CapitalEntry } from '../../types/capital';

const CAPITAL_HISTORY_FILE_PATH = path.join(process.cwd(), 'capital-history.json');

export class CapitalHistoryService {
  private async readHistory(): Promise<CapitalEntry[]> {
    try {
      await fs.access(CAPITAL_HISTORY_FILE_PATH);
      const fileContent = await fs.readFile(CAPITAL_HISTORY_FILE_PATH, 'utf-8');
      return JSON.parse(fileContent) as CapitalEntry[];
    } catch (error) {
      return [];
    }
  }

  public async addEntry(entry: CapitalEntry): Promise<void> {
    const history = await this.readHistory();
    history.push(entry);
    await fs.writeFile(CAPITAL_HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
  }
}