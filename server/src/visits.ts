/**
 * Historique des connexions (DEC-022), lu seulement par le responsable du site.
 * Une ligne par visite : pseudo, compte ou visiteur, heures d'arrivée et de départ. Rien d'autre
 * (ni position, ni messages). Effacé au bout de 90 jours.
 *
 * Logique pure : le stockage est fourni de l'extérieur (SQLite du Durable Object en production,
 * mémoire dans les tests : tests/visits.test.ts).
 */

export interface VisitRow {
  id: number;
  /** Identifiant réseau du joueur (compte : UUID sans tirets ; visiteur : propre à l'onglet). */
  player: string;
  name: string;
  account: boolean;
  arrived: number;
  left: number | null;
}

export interface VisitStore {
  /** Dernière visite de ce joueur. */
  last(player: string): VisitRow | null;
  insert(row: Omit<VisitRow, 'id'>): void;
  /** Visite reprise après une courte coupure : on rouvre la ligne. */
  reopen(id: number, name: string): void;
  /** Départ : ferme les visites ouvertes de ce joueur. */
  close(player: string, at: number): void;
  /** Supprime les visites arrivées avant `before`. */
  prune(before: number): void;
  /** Visites arrivées depuis `since`, les plus récentes d'abord. */
  list(since: number, limit: number): VisitRow[];
}

export const RETENTION_MS = 90 * 24 * 3600 * 1000;
/** Une reconnexion dans ce délai (onglet revenu, réseau coupé) continue la même visite. */
export const RESUME_MS = 2 * 60 * 1000;
const PRUNE_EVERY_MS = 12 * 3600 * 1000;
const LIST_LIMIT = 3000;

export class VisitLog {
  private lastPrune = -Infinity;

  constructor(
    private readonly store: VisitStore,
    private readonly now: () => number,
  ) {}

  arrive(player: string, name: string, account: boolean): void {
    const now = this.now();
    this.pruneIfDue(now);
    const last = this.store.last(player);
    if (last && (last.left === null || now - last.left <= RESUME_MS)) {
      this.store.reopen(last.id, name);
      return;
    }
    this.store.insert({ player, name, account, arrived: now, left: null });
  }

  leave(player: string): void {
    this.store.close(player, this.now());
  }

  /** Les 90 derniers jours (3000 visites au plus), les plus récentes d'abord. */
  recent(): VisitRow[] {
    const now = this.now();
    this.pruneIfDue(now);
    return this.store.list(now - RETENTION_MS, LIST_LIMIT);
  }

  private pruneIfDue(now: number): void {
    if (now - this.lastPrune < PRUNE_EVERY_MS) return;
    this.lastPrune = now;
    this.store.prune(now - RETENTION_MS);
  }
}

/** Stockage en mémoire (tests, développement). */
export class MemoryVisitStore implements VisitStore {
  rows: VisitRow[] = [];
  private nextId = 1;

  last(player: string): VisitRow | null {
    const mine = this.rows.filter((r) => r.player === player);
    return mine.length ? mine[mine.length - 1]! : null;
  }
  insert(row: Omit<VisitRow, 'id'>): void {
    this.rows.push({ ...row, id: this.nextId++ });
  }
  reopen(id: number, name: string): void {
    const r = this.rows.find((x) => x.id === id);
    if (r) Object.assign(r, { left: null, name });
  }
  close(player: string, at: number): void {
    for (const r of this.rows) if (r.player === player && r.left === null) r.left = at;
  }
  prune(before: number): void {
    this.rows = this.rows.filter((r) => r.arrived >= before);
  }
  list(since: number, limit: number): VisitRow[] {
    return this.rows
      .filter((r) => r.arrived >= since)
      .sort((a, b) => b.arrived - a.arrived || b.id - a.id)
      .slice(0, limit);
  }
}
