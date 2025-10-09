// src/services/dashboard/DashboardService.ts
import BinanceConnector = require('@binance/connector');
import { config } from "../../config";
import { Balance, DashboardContext } from "../../types/dashboard";
import { TradeHistoryService } from "../history/TradeHistoryService"; // Import

/**
 * Service to fetch account information and apply risk management rules.
 */
export class DashboardService {
  private client: any;
  private tradeHistoryService: TradeHistoryService; // Injection de dépendance

  constructor() {
    const options = { baseURL: config.API_URL, timestamp: Date.now() };

    this.client = new BinanceConnector.UMFutures(config.API_KEY, config.API_SECRET, options);
    this.tradeHistoryService = new TradeHistoryService();
  }

  public async getTradingContext(): Promise<DashboardContext> {
    try {
      // 1. Récupérer les informations du compte
      const accountInfo = await this.client.getAccountInformation();
      const usdtAsset = accountInfo.data.assets.find((a: any) => a.asset === 'USDT');
      const equity = parseFloat(usdtAsset?.walletBalance || '0');
      const availableBalance = parseFloat(usdtAsset?.availableBalance || '0');

      // 2. Récupérer les trades du jour depuis le fichier JSON
      const todaysTrades = await this.tradeHistoryService.getTodaysTrades();

      // 3. Calculer les performances à partir de l'historique
      const realizedPnlDaily = todaysTrades.reduce(
        (sum, trade) => sum + trade.pnl,
        0
      );
      const tradeCountDaily = todaysTrades.length;

      // 4. Appliquer les règles de risque
      let isTradingAllowed = true;
      const { RISK_MANAGEMENT: rules } = config;

      // Règle 1: Limite de perte journalière (basée sur le PnL, pas sur l'equity)
      if (
        realizedPnlDaily < -(equity * (rules.DAILY_LOSS_LIMIT_PERCENT / 100))
      ) {
        isTradingAllowed = false;
        console.warn(
          `[RISK] Daily loss limit reached. PnL: ${realizedPnlDaily.toFixed(
            2
          )} USD. Trading disabled.`
        );
      }

      // Règle 2: Objectif de gain journalier
      if (
        realizedPnlDaily >
        equity * (rules.DAILY_PROFIT_TARGET_PERCENT / 100)
      ) {
        isTradingAllowed = false;
        console.log(
          `[RISK] Daily profit target reached. PnL: ${realizedPnlDaily.toFixed(
            2
          )} USD. Trading disabled.`
        );
      }

      // 5. Calculer la taille de la position
      const stopLossPercent =
        rules.MAX_RISK_PER_TRADE_PERCENT / rules.RISK_REWARD_RATIO;
      let calculatedPositionSizeUsd = 0;
      if (isTradingAllowed) {
        calculatedPositionSizeUsd =
          (equity * (rules.MAX_RISK_PER_TRADE_PERCENT / 100)) /
          (stopLossPercent / 100);
      }

      // 6. Construire l'objet de contexte
      const context: DashboardContext = {
        accountState: { equity, availableBalance, unrealizedPnl: 0 },
        performanceMetrics: { realizedPnlDaily, tradeCountDaily },
        activeContext: {
          openPositions: [],
          riskRules: {
            isTradingAllowed,
            calculatedPositionSizeUsd,
            dailyLossLimit: rules.DAILY_LOSS_LIMIT_PERCENT,
            dailyProfitTarget: rules.DAILY_PROFIT_TARGET_PERCENT,
          },
        },
      };

      return context;
    } catch (error) {
      console.error("Error fetching dashboard context:", error);
      throw error;
    }
  }
}
