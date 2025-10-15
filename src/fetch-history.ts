// src/fetch-history.ts
import * as fs from "fs/promises";
import * as path from "path";
import { numberInString, USDMClient } from "binance";
import { config } from "./config";

// Interface pour les trades agrégés que nous allons récupérer
interface AggTrade {
  a: number; // ID du trade agrégé
  p: numberInString; // Prix
  q: numberInString; // Quantité
  f: number; // ID du premier trade
  l: number; // ID du dernier trade
  T: number; // Timestamp
  m: boolean; // Le vendeur est-il le maker ?
}

const client = new USDMClient();
const aMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

/**
 * Récupère les trades agrégés de Binance par lots de 1000.
 */
async function fetchTrades(startTime: number): Promise<AggTrade[]> {
  try {
    const trades = await client.getAggregateTrades({
      symbol: config.SYMBOL,
      startTime: startTime,
      limit: 1000, // Limite maximale par requête
    });
    return trades;
  } catch (error) {
    console.error("Erreur lors de la récupération des trades :", error);
    return [];
  }
}

/**
 * Script principal pour récupérer et sauvegarder 1 mois de données.
 */
async function main() {
  console.log(
    "Début de la récupération des données historiques pour 1 mois..."
  );
  const allTrades: AggTrade[] = [];
  let currentStartTime = aMonthAgo;
  let lastTradeTime = 0;

  while (currentStartTime < Date.now()) {
    const trades = await fetchTrades(currentStartTime);
    if (trades.length === 0) {
      console.log("Aucun trade supplémentaire trouvé, fin de la récupération.");
      break;
    }

    allTrades.push(...trades);
    lastTradeTime = trades[trades.length - 1]!.T;

    // Pour éviter de boucler sur les mêmes trades, on avance le temps de départ
    currentStartTime = lastTradeTime + 1;

    console.log(
      `Récupéré ${
        allTrades.length
      } trades. Dernier timestamp : ${new Date(
        lastTradeTime
      ).toISOString()}`
    );
  }

  // Sauvegarder les données dans un fichier JSON
  const filePath = path.join(process.cwd(), "historical-trades.json");
  await fs.writeFile(filePath, JSON.stringify(allTrades, null, 2));

  console.log(
    `\nOpération terminée. ${allTrades.length} trades ont été sauvegardés dans ${filePath}.`
  );
}

main().catch(console.error);