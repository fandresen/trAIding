// src/services/risk/RiskManagementService.ts

import { config } from "../../config";
import { DashboardContext } from "../../types/dashboard";
import { RiskCheckResult } from "../../types/risk";
import { AnalysisResult } from "../../types/indicators";
import { Trade } from "../../types/dashboard";
import { PushoverNotificationService } from "../notification/PushOverNotificationService";

/**
 * Service to centralize all risk management rules.
 * Determines if the bot is allowed to trade.
 */
export class RiskManagementService {
  private pushoverService: PushoverNotificationService;
  private profitTargetNotified = false;
  private lossLimitNotified = false;
  private maxTradesNotified = false;
  /**
   * The main method to check all risk rules.
   * @param context The current state of the account and performance.
   * @param analysis The latest technical analysis (for volatility checks).
   * @param tradeHistory The complete list of today's trades.
   * @returns A RiskCheckResult object.
   */
  constructor() {
    this.pushoverService = new PushoverNotificationService();
  }

  public check(
    context: DashboardContext,
    analysis: AnalysisResult,
    todaysTrades: Trade[]
  ): RiskCheckResult {
    const { accountState, performanceMetrics } = context;
    const { equity } = accountState;
    const { realizedPnlDaily, tradeCountDaily } = performanceMetrics;
    const { RISK_MANAGEMENT: rules } = config;

    // Règle 1: Limite de Perte Journalière
    const dailyLossLimit = -(equity * (rules.DAILY_LOSS_LIMIT_PERCENT / 100));
    if (realizedPnlDaily < dailyLossLimit) {
      if (!this.lossLimitNotified) {
        this.pushoverService.sendNotification(
          `Limite de perte de ${dailyLossLimit.toFixed(
            2
          )} USD atteinte. PnL réalisé: ${realizedPnlDaily.toFixed(2)} USD.`,
          "Daily Loss Limit Reached",
          1
        );
        this.lossLimitNotified = true;
      }
      return {
        isTradingAllowed: false,
        reason: `Daily loss limit reached (${realizedPnlDaily.toFixed(
          2
        )} USD).`,
      };
    }

    // Règle 2: Objectif de Gain Journalier
    const dailyProfitTarget =
      equity * (rules.DAILY_PROFIT_TARGET_PERCENT / 100);
    if (realizedPnlDaily >= dailyProfitTarget) {
      if (!this.profitTargetNotified) {
        this.pushoverService.sendNotification(
          `Objectif de gain de ${dailyProfitTarget.toFixed(
            2
          )} USD atteint. PnL réalisé: ${realizedPnlDaily.toFixed(2)} USD.`,
          "Daily Profit Target Reached",
          1 // High Priority
        );
        this.profitTargetNotified = true;
      }
      return {
        isTradingAllowed: false,
        reason: `Daily profit target reached (${realizedPnlDaily.toFixed(
          2
        )} USD).`,
      };
    }

    // Règle 3: Drawdown Maximum (simplifié sans persistance du pic)
    // Pour une version complète, il faudrait stocker la plus haute valeur de `equity`.
    // Ici, nous simulons avec une règle simple sur le capital initial (ex: 1000)
    // const initialCapital = 1000; // Doit être stocké quelque part
    // const maxDrawdownValue = initialCapital * (1 - rules.MAX_DRAWDOWN_PERCENT / 100);
    // if (equity < maxDrawdownValue) {
    //   return { isTradingAllowed: false, reason: "Max drawdown reached." };
    // }

    // Règle 4: Fréquence de Trading Anormale
    if (tradeCountDaily > rules.MAX_TRADES_PER_DAY) {
      return {
        isTradingAllowed: false,
        reason: `Maximum daily trade count exceeded (${rules.MAX_TRADES_PER_DAY}).`,
      };
    }

    // Règle 5: Volatilité Anormale (ATR check)
    // Cette règle nécessite une moyenne de l'ATR pour la comparaison.
    // Pour l'instant, nous laissons le placeholder, car nous n'avons pas l'historique de l'ATR.
    // const averageAtr = ...; // à calculer sur une plus longue période
    // if (analysis.atr.value_14 > averageAtr * rules.ATR_VOLATILITY_THRESHOLD_MULTIPLIER) {
    //    return { isTradingAllowed: false, reason: "Anomalous market volatility detected." };
    // }

    // Si toutes les règles sont passées
    return {
      isTradingAllowed: true,
      reason: null,
    };
  }
}
