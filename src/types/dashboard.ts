// src/types/dashboard.ts

export interface AccountState {
  equity: number; // Valeur totale du compte
  availableBalance: number; // Solde disponible pour trader
  unrealizedPnl: number; // Profit ou perte non réalisé des positions ouvertes
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

export interface PerformanceMetrics {
  realizedPnlDaily: number; // Profit ou perte réalisé aujourd'hui
  tradeCountDaily: number; // Nombre de trades aujourd'hui
}

export interface RiskRules {
  isTradingAllowed: boolean; // Le cerveau a-t-il le droit de trader ?
  calculatedPositionSizeUsd: number; // Taille de la position en USD à ouvrir
  // ... autres règles pour information
  dailyProfitTarget: number;
  dailyLossLimit: number;
}

export interface OpenPosition {
  symbol: string;
  positionAmt: string; // Doit être une chaîne de caractères
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
}

export interface Trade {
  id: string; // ex: orderId de Binance
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  size: number; // en USD
  pnl: number; // Profit ou perte du trade
  timestamp: number;
}

// L'objet final que le Dashboard envoie au Cerveau
export interface DashboardContext {
  accountState: AccountState;
  performanceMetrics: PerformanceMetrics;
  activeContext: {
    // Pour l'instant, nous laissons les positions ouvertes vides,
    // car le suivi spot est plus complexe que sur les futures.
    // On se concentre d'abord sur l'état global.
    openPositions: any[];
    riskRules: RiskRules;
  };
}
