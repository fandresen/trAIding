// src/services/dashboard/DashboardService.ts

import {
  USDMClient,
  FuturesAccountAsset,
  FuturesPositionV3, // Import the specific type for clarity
} from "binance";
import { config } from "../../config";
import {
  DashboardContext,
  OpenPosition,
  RiskRules,
} from "../../types/dashboard";
import { TradeHistoryService } from "../history/TradeHistoryService";
import { CapitalHistoryService } from "../history/CapitalHistoryService";

/**
 * Service to retrieve account information.
 */
export class DashboardService {
  private client: USDMClient;
  private tradeHistoryService: TradeHistoryService;
  private capitalHistoryService: CapitalHistoryService;

  constructor() {
    this.client = new USDMClient({
      api_key: config.API_KEY,
      api_secret: config.API_SECRET,
    });
    this.tradeHistoryService = new TradeHistoryService();
    this.capitalHistoryService = new CapitalHistoryService();
  }

  public async getTradingContext(): Promise<DashboardContext> {
    try {
      // Correctly define the variable 'rules' by destructuring it from config
      const { RISK_MANAGEMENT: rules } = config;

      const [accountInfo, positionRisk] = await Promise.all([
        this.client.getAccountInformationV3(),
        this.client.getPositionsV3({ symbol: config.SYMBOL }),
      ]);

      const usdtAsset = accountInfo.assets.find(
        (a: FuturesAccountAsset) => a.asset === "USDT"
      );

      const equity = parseFloat(String(usdtAsset?.walletBalance || "0"));
      const availableBalance = parseFloat(
        String(usdtAsset?.availableBalance || "0")
      );
      const unrealizedPnl = parseFloat(
        String(usdtAsset?.unrealizedProfit || "0")
      );

      // Correctly map the position data, ensuring all types match
      const openPositions: OpenPosition[] = positionRisk
        .filter(
          (p: FuturesPositionV3) => parseFloat(String(p.positionAmt)) !== 0
        )
        .map((p: FuturesPositionV3) => ({
          symbol: p.symbol,
          positionAmt: p.positionAmt, // FIX: Explicitly convert to string
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unRealizedProfit: p.unRealizedProfit,
          liquidationPrice: p.liquidationPrice,
        }));

      const todaysTrades = await this.tradeHistoryService.getTodaysTrades();
      const realizedPnlDaily = todaysTrades.reduce(
        (sum, trade) => sum + trade.pnl,
        0
      );
      const tradeCountDaily = todaysTrades.length;

      const stopLossPercent =
        rules.MAX_RISK_PER_TRADE_PERCENT / rules.RISK_REWARD_RATIO;
      const calculatedPositionSizeUsd =
        (equity * (rules.MAX_RISK_PER_TRADE_PERCENT / 100)) /
        (stopLossPercent / 100);

      // This object now correctly matches the updated RiskRules interface
      const riskRules: RiskRules = {
        calculatedPositionSizeUsd,
        dailyLossLimit: rules.DAILY_LOSS_LIMIT_PERCENT,
        dailyProfitTarget: rules.DAILY_PROFIT_TARGET_PERCENT,
      };

      const context: DashboardContext = {
        accountState: { equity, availableBalance, unrealizedPnl },
        performanceMetrics: { realizedPnlDaily, tradeCountDaily },
        activeContext: {
          openPositions,
          riskRules,
        },
      };

      await this.capitalHistoryService.addEntry({
        timestamp: Date.now(),
        equity: context.accountState.equity,
        unrealizedPnl: context.accountState.unrealizedPnl,
        realizedPnlDaily: context.performanceMetrics.realizedPnlDaily,
      });

      return context;
    } catch (error) {
      console.error("Error retrieving dashboard context:", error);
      throw error;
    }
  }
}
