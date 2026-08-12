import { createSeed, SEED_VERSION } from "../seed";
import type { Database } from "../types";

/**
 * Couche d'accès aux données.
 *
 * L'interface `DataRepository` isole complètement l'application du support
 * de stockage. Aujourd'hui : `LocalStorageRepository` (démonstration).
 * Demain : un `SupabaseRepository` implémentera la même interface sans
 * toucher aux composants d'interface.
 *
 * Règle : aucun composant métier ne lit `localStorage` directement —
 * tout passe par le repository via le DataProvider.
 */
export interface DataRepository {
  /** Charge la base (ou l'initialise depuis le seed si absente/obsolète). */
  load(): Database;
  /** Persiste l'état complet de la base. */
  save(db: Database): void;
  /** Réinitialise les données de démonstration. */
  reset(): Database;
}

const STORAGE_KEY = "trust-ai:db";

export class LocalStorageRepository implements DataRepository {
  load(): Database {
    if (typeof window === "undefined") {
      // Rendu serveur : on renvoie le seed, le client rechargera depuis
      // localStorage après hydratation (géré par le DataProvider).
      return createSeed();
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.reset();
      const parsed = JSON.parse(raw) as Database;
      // Versionnage : un changement de schéma force le rechargement du seed.
      if (!parsed || parsed.version !== SEED_VERSION) {
        return this.reset();
      }
      return parsed;
    } catch {
      return this.reset();
    }
  }

  save(db: Database): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Stockage plein ou indisponible : la démo continue en mémoire.
    }
  }

  reset(): Database {
    const seed = createSeed();
    this.save(seed);
    return seed;
  }
}

export const repository: DataRepository = new LocalStorageRepository();
