// src/types/risk.ts

/**
 * Le résultat d'une vérification par le RiskManagementService.
 */
export interface RiskCheckResult {
  isTradingAllowed: boolean;
  reason: string | null; // La raison pour laquelle le trading est arrêté
}
