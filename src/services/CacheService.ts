// src/services/CacheService.ts
import { Kline } from '../types/kline';

/**
 * Manages in-memory caches for Kline data with a FIFO (First-In, First-Out) strategy.
 */
export class CacheService {
  // Utilisation de Map pour un accès et une gestion plus simples par intervalle
  private klineCaches: Map<string, Kline[]> = new Map();
  private cacheLimits: Map<string, number> = new Map();

  /**
   * Initializes the cache for a specific interval with historical data.
   * @param interval The interval to initialize (e.g., '1m').
   * @param initialData The historical klines to populate the cache with.
   * @param limit The maximum number of klines to store for this interval.
   */
  public initialize(interval: string, initialData: Kline[], limit: number): void {
    this.klineCaches.set(interval, initialData);
    this.cacheLimits.set(interval, limit);
    console.log(`Cache for ${interval} initialized with ${initialData.length} klines.`);
  }

  /**
   * Adds a new kline to the specified cache, removing the oldest if the limit is exceeded.
   * @param interval The interval of the cache to update.
   * @param kline The new kline to add.
   */
  public addKline(interval: string, kline: Kline): void {
    const cache = this.klineCaches.get(interval);
    const limit = this.cacheLimits.get(interval);

    if (!cache || !limit) {
      console.warn(`Cache for interval ${interval} is not initialized. Ignoring kline.`);
      return;
    }

    // Ajoute la nouvelle bougie à la fin du tableau
    cache.push(kline);

    // Si le cache dépasse la limite, retire l'élément le plus ancien (le premier)
    if (cache.length > limit) {
      cache.shift();
    }
    
    // Pour débugger, on peut afficher la taille du cache
    // console.log(`New kline added to ${interval} cache. Size: ${cache.length}`);
  }

  /**
   * Retrieves the entire cache for a given interval.
   * @param interval The interval of the cache to retrieve.
   * @returns An array of Klines or undefined if the cache doesn't exist.
   */
  public getCache(interval: string): Kline[] | undefined {
    return this.klineCaches.get(interval);
  }
}
