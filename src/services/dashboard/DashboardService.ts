// src/services/dashboard/DashboardService.ts

import {
  USDMClient,
  FuturesAccountAsset,
  FuturesAccountPosition,
} from 'binance';
import { config } from "../../config";
import { DashboardContext, OpenPosition } from "../../types/dashboard";
import { TradeHistoryService } from "../history/TradeHistoryService";

/**
 * Service pour récupérer les informations du compte et appliquer les règles de gestion des risques.
 */
export class DashboardService {
  private client: USDMClient;
  private tradeHistoryService: TradeHistoryService;

  constructor() {
    this.client = new USDMClient({
        api_key: config.API_KEY,
        api_secret: config.API_SECRET,
    });
    this.tradeHistoryService = new TradeHistoryService();
  }

  public async getTradingContext(): Promise<DashboardContext> {
    try {
      // 1. Récupérer les informations du compte et le risque des positions en parallèle
      const [accountInfo, positionRisk] = await Promise.all([
        this.client.getAccountInformationV3(),
        this.client.getPositionsV3({ symbol: config.SYMBOL }), 
      ]);

      // 2. Extraire l'asset USDT pour le solde
      const usdtAsset = accountInfo.assets.find(
        (a: FuturesAccountAsset) => a.asset === 'USDT'
      );

      // Correction de type : s'assurer que les valeurs sont des chaînes avant parseFloat
      const equity = parseFloat(String(usdtAsset?.walletBalance || '0'));
      const availableBalance = parseFloat(String(usdtAsset?.availableBalance || '0'));
      const unrealizedPnl = parseFloat(String(usdtAsset?.unrealizedProfit || '0'));

      // 3. Filtrer et mapper les positions ouvertes
      // On utilise les données de 'positionRisk' qui sont plus complètes
      const openPositions: OpenPosition[] = positionRisk
        .filter((p:any) => parseFloat(p.positionAmt) !== 0)
        .map((p:any) => ({
            symbol: p.symbol,
            positionAmt: p.positionAmt, // C'est déjà une string
            entryPrice: p.entryPrice,
            markPrice: p.markPrice,
            unRealizedProfit: p.unRealizedProfit,
            liquidationPrice: p.liquidationPrice,
        }));

      // 4. Récupérer l'historique des trades du jour
      const todaysTrades = await this.tradeHistoryService.getTodaysTrades();

      // 5. Calculer les performances
      const realizedPnlDaily = todaysTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      const tradeCountDaily = todaysTrades.length;

      // 6. Appliquer les règles de risque
      let isTradingAllowed = true;
      const { RISK_MANAGEMENT: rules } = config;

      if (realizedPnlDaily < -(equity * (rules.DAILY_LOSS_LIMIT_PERCENT / 100))) {
        isTradingAllowed = false;
        console.warn(`[RISK] Limite de perte journalière atteinte. Trading désactivé.`);
      }
      if (realizedPnlDaily > equity * (rules.DAILY_PROFIT_TARGET_PERCENT / 100)) {
        isTradingAllowed = false;
        console.log(`[RISK] Objectif de profit journalier atteint. Trading désactivé.`);
      }

      // 7. Calculer la taille de la position
      const stopLossPercent = rules.MAX_RISK_PER_TRADE_PERCENT / rules.RISK_REWARD_RATIO;
      let calculatedPositionSizeUsd = 0;
      if (isTradingAllowed) {
        calculatedPositionSizeUsd = (equity * (rules.MAX_RISK_PER_TRADE_PERCENT / 100)) / (stopLossPercent / 100);
      }

      // 8. Construire l'objet de contexte final
      const context: DashboardContext = {
        accountState: { equity, availableBalance, unrealizedPnl },
        performanceMetrics: { realizedPnlDaily, tradeCountDaily },
        activeContext: {
          openPositions,
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
      console.error("Erreur lors de la récupération du contexte du dashboard:", error);
      throw error;
    }
  }
}