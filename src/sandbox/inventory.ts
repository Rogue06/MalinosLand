import {
  BRICK,
  COAL,
  CORAL,
  CRYSTAL,
  CRYSTAL_PICK,
  DIRT,
  FURNACE,
  GLASS,
  LOG,
  PLANKS,
  SAND,
  STICK,
  STONE,
  STONE_PICK,
  TORCH,
  TURQUOISE,
  WOOD_PICK,
  WORKBENCH,
  itemDef,
} from './blocks';
import type { VoxelWorld } from './world';

/**
 * Inventaire et fabrication du « Chantier des mondes » (logique pure et testée). Une recette
 * vérifie tout avant de rien retirer : une fabrication ne peut ni dupliquer ni perdre d'objets.
 */

export const HOTBAR_SIZE = 9;
/** Plafond par objet (une pile raisonnable, pas de stock infini). */
export const MAX_STACK = 999;

export type Station = 'workbench' | 'furnace';

export interface Recipe {
  id: string;
  /** Objet obtenu et quantité. */
  out: [item: number, count: number];
  /** Ingrédients nécessaires. */
  needs: Array<[item: number, count: number]>;
  /** Atelier à proximité (null : partout, dans les mains). */
  station: Station | null;
}

export const RECIPES: readonly Recipe[] = [
  { id: 'planches', out: [PLANKS, 4], needs: [[LOG, 1]], station: null },
  { id: 'batons', out: [STICK, 4], needs: [[PLANKS, 2]], station: null },
  { id: 'etabli', out: [WORKBENCH, 1], needs: [[PLANKS, 4]], station: null },
  {
    id: 'torches',
    out: [TORCH, 4],
    needs: [
      [COAL, 1],
      [STICK, 1],
    ],
    station: null,
  },
  {
    id: 'pioche-bois',
    out: [WOOD_PICK, 1],
    needs: [
      [PLANKS, 3],
      [STICK, 2],
    ],
    station: 'workbench',
  },
  {
    id: 'pioche-pierre',
    out: [STONE_PICK, 1],
    needs: [
      [STONE, 3],
      [STICK, 2],
    ],
    station: 'workbench',
  },
  { id: 'four', out: [FURNACE, 1], needs: [[STONE, 8]], station: 'workbench' },
  {
    id: 'verre',
    out: [GLASS, 4],
    needs: [
      [SAND, 4],
      [COAL, 1],
    ],
    station: 'furnace',
  },
  {
    id: 'briques',
    out: [BRICK, 4],
    needs: [
      [DIRT, 4],
      [COAL, 1],
    ],
    station: 'furnace',
  },
  {
    id: 'pioche-cristal',
    out: [CRYSTAL_PICK, 1],
    needs: [
      [CRYSTAL, 3],
      [STICK, 2],
    ],
    station: 'workbench',
  },
  {
    id: 'turquoise',
    out: [TURQUOISE, 4],
    needs: [
      [CRYSTAL, 1],
      [STONE, 4],
    ],
    station: 'workbench',
  },
  {
    id: 'corail',
    out: [CORAL, 4],
    needs: [
      [BRICK, 2],
      [SAND, 2],
    ],
    station: 'workbench',
  },
];

export const STATION_LABEL: Record<Station, string> = {
  workbench: 'un établi',
  furnace: 'un four',
};

/** Ateliers (établi, four) à portée d'un joueur dont les pieds sont en (x, y, z). */
export function stationsNear(
  world: Pick<VoxelWorld, 'get'>,
  x: number,
  y: number,
  z: number,
): Set<Station> {
  const out = new Set<Station>();
  const px = Math.floor(x);
  const py = Math.floor(y);
  const pz = Math.floor(z);
  for (let cz = pz - 2; cz <= pz + 3; cz++)
    for (let cy = py - 4; cy <= py + 4; cy++)
      for (let cx = px - 4; cx <= px + 4; cx++) {
        const b = world.get(cx, cy, cz);
        if (b === WORKBENCH) out.add('workbench');
        if (b === FURNACE) out.add('furnace');
      }
  return out;
}

export class Inventory {
  readonly counts = new Map<number, number>();
  /** Objets rangés dans la barre rapide (null : case vide). */
  readonly hotbar: Array<number | null> = Array.from({ length: HOTBAR_SIZE }, () => null);
  selected = 0;

  count(item: number): number {
    return this.counts.get(item) ?? 0;
  }

  has(item: number, n = 1): boolean {
    return this.count(item) >= n;
  }

  /** Ajoute des objets ; un nouvel objet prend la première case libre de la barre rapide. */
  add(item: number, n = 1): number {
    if (!itemDef(item) || n <= 0) return 0;
    const before = this.count(item);
    const after = Math.min(MAX_STACK, before + n);
    this.counts.set(item, after);
    if (before === 0 && !this.hotbar.includes(item)) {
      const free = this.hotbar.indexOf(null);
      if (free >= 0) this.hotbar[free] = item;
    }
    return after - before;
  }

  /** Retire des objets : tout ou rien. */
  remove(item: number, n = 1): boolean {
    if (n <= 0 || !this.has(item, n)) return false;
    const left = this.count(item) - n;
    if (left === 0) {
      this.counts.delete(item);
      const slot = this.hotbar.indexOf(item);
      if (slot >= 0) this.hotbar[slot] = null;
    } else this.counts.set(item, left);
    return true;
  }

  /** Objet tenu (case choisie de la barre rapide). */
  held(): number | null {
    const id = this.hotbar[this.selected] ?? null;
    return id !== null && this.has(id) ? id : null;
  }

  /** Range un objet dans la case choisie de la barre rapide. */
  assign(item: number, slot = this.selected): void {
    if (!this.has(item) || slot < 0 || slot >= HOTBAR_SIZE) return;
    const other = this.hotbar.indexOf(item);
    if (other >= 0) this.hotbar[other] = this.hotbar[slot] ?? null;
    this.hotbar[slot] = item;
  }

  /** Pourquoi on ne peut pas fabriquer (null : possible). */
  craftProblem(recipe: Recipe, stations: ReadonlySet<Station>): string | null {
    if (recipe.station && !stations.has(recipe.station))
      return `Il faut être près d’${STATION_LABEL[recipe.station]}.`;
    const missing = recipe.needs.filter(([item, n]) => !this.has(item, n));
    if (missing.length > 0)
      return `Il manque : ${missing
        .map(([item, n]) => `${n - this.count(item)} × ${itemDef(item)?.name ?? '?'}`)
        .join(', ')}.`;
    if (this.count(recipe.out[0]) + recipe.out[1] > MAX_STACK) return 'Ton sac est plein.';
    return null;
  }

  /** Fabrique une fois. Tout est vérifié avant de retirer quoi que ce soit. */
  craft(recipe: Recipe, stations: ReadonlySet<Station>): boolean {
    if (this.craftProblem(recipe, stations)) return false;
    for (const [item, n] of recipe.needs) this.remove(item, n);
    this.add(recipe.out[0], recipe.out[1]);
    return true;
  }

  /**
   * Remplace le contenu du sac par celui que garde le serveur (monde partagé). La barre rapide
   * garde l'ordre choisi ; un objet parti libère sa case, un nouveau prend la première libre.
   */
  setCounts(stacks: ReadonlyArray<readonly [number, number]>): void {
    this.counts.clear();
    for (const [item, n] of stacks)
      if (itemDef(item) && n > 0) this.counts.set(item, Math.min(MAX_STACK, n));
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const id = this.hotbar[i];
      if (id !== null && id !== undefined && !this.has(id)) this.hotbar[i] = null;
    }
    for (const item of this.counts.keys()) {
      if (this.hotbar.includes(item)) continue;
      const free = this.hotbar.indexOf(null);
      if (free >= 0) this.hotbar[free] = item;
    }
  }

  /** Contenu du sac sous forme compacte (serveur). */
  stacks(): Array<[number, number]> {
    return [...this.counts];
  }

  toJSON(): { counts: Array<[number, number]>; hotbar: Array<number | null>; selected: number } {
    return { counts: [...this.counts], hotbar: [...this.hotbar], selected: this.selected };
  }

  /** Relit une sauvegarde prudemment (objets inconnus et quantités absurdes ignorés). */
  static parse(raw: unknown): Inventory {
    const inv = new Inventory();
    const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    if (Array.isArray(r.counts))
      for (const e of r.counts.slice(0, 200)) {
        if (!Array.isArray(e)) continue;
        const [item, n] = e as [unknown, unknown];
        if (
          Number.isInteger(item) &&
          Number.isInteger(n) &&
          (n as number) > 0 &&
          itemDef(item as number)
        )
          inv.counts.set(item as number, Math.min(MAX_STACK, n as number));
      }
    if (Array.isArray(r.hotbar))
      r.hotbar.slice(0, HOTBAR_SIZE).forEach((id, i) => {
        if (Number.isInteger(id) && inv.has(id as number) && !inv.hotbar.includes(id as number))
          inv.hotbar[i] = id as number;
      });
    if (
      Number.isInteger(r.selected) &&
      (r.selected as number) >= 0 &&
      (r.selected as number) < HOTBAR_SIZE
    )
      inv.selected = r.selected as number;
    return inv;
  }
}
