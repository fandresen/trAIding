// src/backtest/SimulatedAccountService.ts
import { Trade } from "../../types/dashboard";

export class SimulatedAccountService {
  public equity: number;
  private initialEquity: number;
  public openPositions: any[] = []; // Positions simulées
  public tradeHistory: Trade[] = [];

  constructor(startingCapital: number) {
    this.initialEquity = startingCapital;
    this.equity = startingCapital;
  }

  get realizedPnlDaily(): number {
    return this.tradeHistory.reduce((sum, trade) => sum + trade.pnl, 0);
  }

  get tradeCountDaily(): number {
    return this.tradeHistory.length;
  }

  addTrade(trade: Trade) {
    this.tradeHistory.push(trade);
    this.equity += trade.pnl; // Mettre à jour le solde avec le PnL du trade
  }

  printSummary() {
    const totalTrades = this.tradeHistory.length;
    const winningTrades = this.tradeHistory.filter((t) => t.pnl > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalPnl = this.equity - this.initialEquity;

    // Calculer les moyennes avant de les afficher
    const totalWinPnl = this.tradeHistory
      .filter((t) => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = this.tradeHistory
      .filter((t) => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0);

    const averageWin = winningTrades > 0 ? totalWinPnl / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLossPnl / losingTrades : 0;

    // ✅ AMÉLIORATION: Utiliser .toFixed(4) pour plus de précision
    console.log("\n--- Résumé du Backtest ---");
    console.log(`Capital Initial:     ${this.initialEquity.toFixed(2)} USD`);
    console.log(`Capital Final:       ${this.equity.toFixed(2)} USD`);
    console.log(`PnL Total:           ${totalPnl.toFixed(2)} USD`);
    console.log(`Nombre total de trades: ${totalTrades}`);
    console.log(`Trades gagnants:     ${winningTrades}`);
    console.log(`Trades perdants:     ${losingTrades}`);
    console.log(`Taux de réussite:    ${winRate.toFixed(2)}%`);
    console.log(`Gain moyen:          ${averageWin.toFixed(4)} USD`);
    console.log(`Perte moyenne:       ${averageLoss.toFixed(4)} USD`);
    console.log("-------------------------\n");
  }
}
