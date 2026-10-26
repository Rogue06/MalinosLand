import { hash2 } from '../core/random';
import {
  AIR,
  BEDROCK,
  COAL_ORE,
  CRYSTAL_ORE,
  DIRT,
  GRASS,
  LEAVES,
  LOG,
  PAD,
  SAND,
  STONE,
  blockDef,
  itemDef,
} from './blocks';

/**
 * Monde en cubes du « Chantier des mondes » (prototype B0). Logique pure et testée : ni DOM,
 * ni moteur de rendu. Même repère que le Hub : x et y au sol, z vers le haut.
 *
 * Le terrain de départ est **reproductible** (même graine → même terrain) : on ne sauvegarde que
 * les **modifications** (liste compacte), jamais le monde entier.
 */
export const SIZE_X = 64;
export const SIZE_Y = 64;
export const SIZE_Z = 32;
/** Plafond de modifications gardées (sauvegarde de quelques centaines de Ko au plus). */
export const MAX_EDITS = 30_000;
/** Nombre d'actions que l'on peut annuler (mode créatif). */
export const MAX_UNDO = 100;
/** Demi-largeur de la zone de départ protégée (3 × 3 colonnes). */
export const SPAWN_RADIUS = 1;
/** Hauteur d'air gardée libre au-dessus de la dalle de départ. */
export const SPAWN_CLEAR = 3;

export interface Cell {
  x: number;
  y: number;
  z: number;
}

/** Modification d'un cube : position (indice) et nouveau type. */
export type Edit = [index: number, block: number];

/** Bruit de valeur lissé en 2D, reproductible. */
function noise2(seed: number, x: number, y: number, scale: number): number {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = x / scale - gx;
  const fy = y / scale - gy;
  const v = (i: number, j: number) => (hash2(gx + i + seed * 31, gy + j - seed * 17) % 1000) / 1000;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx);
  const b = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx);
  return a + (b - a) * s(fy);
}

/** Bruit de valeur en 3D (grottes) : deux couches 2D décalées selon la hauteur. */
function noise3(seed: number, x: number, y: number, z: number, scale: number): number {
  const lo = Math.floor(z / scale);
  const t = z / scale - lo;
  const a = noise2(seed + lo * 101, x, y, scale);
  const b = noise2(seed + (lo + 1) * 101, x, y, scale);
  return a + (b - a) * t * t * (3 - 2 * t);
}

export class VoxelWorld {
  readonly blocks: Uint8Array;
  private readonly base: Uint8Array;
  private readonly undoStack: Array<{ index: number; before: number; after: number }> = [];
  readonly spawn: Cell;

  constructor(readonly seed = 1) {
    this.base = generate(seed);
    this.blocks = this.base.slice();
    const sx = Math.floor(SIZE_X / 2);
    const sy = Math.floor(SIZE_Y / 2);
    this.spawn = { x: sx, y: sy, z: this.surface(sx, sy) + 1 };
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < SIZE_X && y < SIZE_Y && z < SIZE_Z;
  }

  index(x: number, y: number, z: number): number {
    return x + SIZE_X * (y + SIZE_Y * z);
  }

  cellOf(index: number): Cell {
    const x = index % SIZE_X;
    const y = Math.floor(index / SIZE_X) % SIZE_Y;
    const z = Math.floor(index / (SIZE_X * SIZE_Y));
    return { x, y, z };
  }

  /** Hors de la parcelle : de l'air au-dessus et autour, du socle en dessous. */
  get(x: number, y: number, z: number): number {
    if (z < 0) return BEDROCK;
    return this.inBounds(x, y, z) ? this.blocks[this.index(x, y, z)]! : AIR;
  }

  /** Bloque le passage (bords de la parcelle compris : on ne tombe pas dans le vide). */
  solidAt(x: number, y: number, z: number): boolean {
    if (x < 0 || y < 0 || x >= SIZE_X || y >= SIZE_Y || z < 0) return true;
    return blockDef(this.get(x, y, z)).solid;
  }

  /** Hauteur du cube le plus haut d'une colonne (-1 si vide). */
  surface(x: number, y: number): number {
    for (let z = SIZE_Z - 1; z >= 0; z--) if (this.get(x, y, z) !== AIR) return z;
    return -1;
  }

  /** Dans la zone de départ protégée (colonnes autour de la dalle) ? */
  protectedCell(x: number, y: number, z: number): boolean {
    const near =
      Math.abs(x - this.spawn.x) <= SPAWN_RADIUS && Math.abs(y - this.spawn.y) <= SPAWN_RADIUS;
    return near && z >= this.spawn.z - 1 && z < this.spawn.z + SPAWN_CLEAR;
  }

  /** Pourquoi on ne peut pas casser ce cube (null : possible). */
  breakProblem(x: number, y: number, z: number): string | null {
    const b = this.get(x, y, z);
    if (b === AIR || !this.inBounds(x, y, z)) return 'Il n’y a rien à creuser ici.';
    if (blockDef(b).hardness === Infinity) return 'Ce cube ne se casse pas.';
    if (this.protectedCell(x, y, z)) return 'La zone de départ est protégée.';
    return null;
  }

  /** Pourquoi on ne peut pas poser ce cube ici (null : possible). */
  placeProblem(x: number, y: number, z: number, block: number): string | null {
    if (!this.inBounds(x, y, z)) return 'Hors de la parcelle.';
    if (!itemDef(block)?.block) return 'Ce n’est pas un cube.';
    const here = this.get(x, y, z);
    if (here !== AIR) return 'La place est déjà prise.';
    if (this.protectedCell(x, y, z)) return 'La zone de départ est protégée.';
    // Un cube se pose contre un autre (pas de cube flottant tout seul).
    const touching = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ].some(([dx, dy, dz]) => {
      const n = this.get(x + dx!, y + dy!, z + dz!);
      return n !== AIR && z + dz! >= 0;
    });
    return touching || z === 0 ? null : 'Pose-le contre un autre cube.';
  }

  /** Casse un cube. Renvoie le cube cassé, ou null (sans rien changer) si c'est interdit. */
  dig(x: number, y: number, z: number): number | null {
    if (this.breakProblem(x, y, z)) return null;
    const before = this.get(x, y, z);
    this.write(this.index(x, y, z), AIR);
    // Une torche posée sur ce cube tombe avec lui.
    if (this.get(x, y, z + 1) !== AIR && blockDef(this.get(x, y, z + 1)).small)
      this.write(this.index(x, y, z + 1), AIR);
    return before;
  }

  /** Pose un cube. Renvoie false (sans rien changer) si c'est interdit. */
  place(x: number, y: number, z: number, block: number): boolean {
    if (this.placeProblem(x, y, z, block)) return false;
    this.write(this.index(x, y, z), block);
    return true;
  }

  private write(index: number, block: number, record = true): void {
    const before = this.blocks[index]!;
    if (before === block) return;
    this.blocks[index] = block;
    if (record) {
      this.undoStack.push({ index, before, after: block });
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Annule la dernière action ; renvoie la case touchée (null : rien à annuler). */
  undo(): Cell | null {
    const last = this.undoStack.pop();
    if (!last) return null;
    this.write(last.index, last.before, false);
    return this.cellOf(last.index);
  }

  /** Oublie l'historique (en survie, on ne peut pas annuler pour récupérer des cubes). */
  clearUndo(): void {
    this.undoStack.length = 0;
  }

  /** Modifications par rapport au terrain de départ : ce qu'on sauvegarde. */
  edits(): Edit[] {
    const out: Edit[] = [];
    for (let i = 0; i < this.blocks.length && out.length < MAX_EDITS; i++)
      if (this.blocks[i] !== this.base[i]) out.push([i, this.blocks[i]!]);
    return out;
  }

  /**
   * Recharge des modifications sauvegardées. Les données sont relues prudemment : indice hors de
   * la parcelle, cube inconnu, cube incassable ou zone protégée → ignoré.
   */
  load(raw: unknown): number {
    this.blocks.set(this.base);
    this.undoStack.length = 0;
    if (!Array.isArray(raw)) return 0;
    let applied = 0;
    for (const e of raw.slice(0, MAX_EDITS)) {
      if (!Array.isArray(e) || e.length !== 2) continue;
      const [i, b] = e as [unknown, unknown];
      if (!Number.isInteger(i) || !Number.isInteger(b)) continue;
      const index = i as number;
      const block = b as number;
      if (index < 0 || index >= this.blocks.length) continue;
      if (block !== AIR && !itemDef(block)?.block) continue;
      const c = this.cellOf(index);
      if (this.protectedCell(c.x, c.y, c.z)) continue;
      if (blockDef(this.base[index]!).hardness === Infinity) continue;
      this.blocks[index] = block;
      applied++;
    }
    return applied;
  }

  /** Remet le terrain de départ. */
  reset(): void {
    this.blocks.set(this.base);
    this.undoStack.length = 0;
  }
}

/**
 * Terrain de départ : collines, plages de sable, socle, pierre avec charbon et cristal, grottes,
 * arbres. Une dalle de départ protégée au centre.
 */
export function generate(seed: number): Uint8Array {
  const out = new Uint8Array(SIZE_X * SIZE_Y * SIZE_Z);
  const at = (x: number, y: number, z: number) => x + SIZE_X * (y + SIZE_Y * z);
  const heights = new Int16Array(SIZE_X * SIZE_Y);
  const cx = Math.floor(SIZE_X / 2);
  const cy = Math.floor(SIZE_Y / 2);
  for (let y = 0; y < SIZE_Y; y++)
    for (let x = 0; x < SIZE_X; x++) {
      const n =
        noise2(seed, x, y, 22) * 0.55 +
        noise2(seed + 7, x, y, 9) * 0.3 +
        noise2(seed + 3, x, y, 4) * 0.15;
      const h = 9 + Math.round(n * 12);
      heights[x + y * SIZE_X] = h;
      for (let z = 0; z <= h; z++) {
        let block = z === 0 ? BEDROCK : z < h - 3 ? STONE : z < h ? DIRT : h <= 12 ? SAND : GRASS;
        if (block === STONE) {
          const r = hash2(x * 31 + z * 7 + seed, y * 17 - z * 3) % 1000;
          if (z < 8 && r < 6) block = CRYSTAL_ORE;
          else if (r < 22) block = COAL_ORE;
        }
        out[at(x, y, z)] = block;
      }
    }
  // Grottes : poches creusées sous la surface (jamais dans le socle ni près de la dalle).
  for (let z = 2; z < SIZE_Z - 1; z++)
    for (let y = 0; y < SIZE_Y; y++)
      for (let x = 0; x < SIZE_X; x++) {
        if (z > heights[x + y * SIZE_X]! - 2) continue;
        if (Math.abs(x - cx) < 4 && Math.abs(y - cy) < 4) continue;
        const c = noise3(seed + 50, x, y, z, 7);
        const d = noise3(seed + 90, x, y, z, 5);
        if (Math.abs(c - 0.5) < 0.06 && d > 0.35) out[at(x, y, z)] = AIR;
      }
  // Dalle de départ (3 × 3) au centre, posée sur la surface, avec de l'air au-dessus.
  const ch = heights[cx + cy * SIZE_X]!;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      for (let z = 1; z < SIZE_Z; z++)
        out[at(cx + dx, cy + dy, z)] = z < ch ? DIRT : z === ch ? PAD : AIR;
  // Arbres, loin de la dalle et des bords.
  for (let i = 0; i < 40; i++) {
    const x = 3 + (hash2(seed * 13 + i, 5) % (SIZE_X - 6));
    const y = 3 + (hash2(seed * 29 + i, 11) % (SIZE_Y - 6));
    if (Math.abs(x - cx) < 5 && Math.abs(y - cy) < 5) continue;
    const h = heights[x + y * SIZE_X]!;
    if (out[at(x, y, h)] !== GRASS || h + 7 >= SIZE_Z) continue;
    const trunk = 4 + (hash2(i, seed) % 2);
    for (let z = h + 1; z <= h + trunk; z++) out[at(x, y, z)] = LOG;
    for (let dz = trunk - 1; dz <= trunk + 1; dz++) {
      const r = dz === trunk + 1 ? 1 : 2;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dy) === r && (dz !== trunk || hash2(dx + i, dy) % 2))
            continue;
          const idx = at(x + dx, y + dy, h + dz);
          if (out[idx] === AIR) out[idx] = LEAVES;
        }
    }
  }
  return out;
}

/** Touché par un rayon : le cube, et la case vide juste devant la face touchée. */
export interface RayHit {
  cell: Cell;
  /** Case où poser un cube (devant la face touchée). */
  before: Cell;
}

/**
 * Lancer de rayon dans la grille (méthode d'Amanatides et Woo) : premier cube non vide traversé
 * par la demi-droite `origin + t × dir`, en ignorant ce qui dépasse le niveau `maxZ` (vue de
 * dessus en coupe).
 */
export function raycast(
  world: VoxelWorld,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  maxDist = 80,
  maxZ = SIZE_Z - 1,
): RayHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const step = { x: Math.sign(dir.x), y: Math.sign(dir.y), z: Math.sign(dir.z) };
  const delta = {
    x: dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity,
    y: dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity,
    z: dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity,
  };
  const frac = (o: number, s: number) => (s > 0 ? Math.floor(o) + 1 - o : o - Math.floor(o));
  const tMax = {
    x: dir.x !== 0 ? frac(origin.x, step.x) * delta.x : Infinity,
    y: dir.y !== 0 ? frac(origin.y, step.y) * delta.y : Infinity,
    z: dir.z !== 0 ? frac(origin.z, step.z) * delta.z : Infinity,
  };
  let prev: Cell = { x, y, z };
  let t = 0;
  while (t <= maxDist) {
    if (world.inBounds(x, y, z) && z <= maxZ && world.get(x, y, z) !== AIR)
      return { cell: { x, y, z }, before: prev };
    prev = { x, y, z };
    if (tMax.x < tMax.y && tMax.x < tMax.z) {
      x += step.x;
      t = tMax.x;
      tMax.x += delta.x;
    } else if (tMax.y < tMax.z) {
      y += step.y;
      t = tMax.y;
      tMax.y += delta.y;
    } else {
      z += step.z;
      t = tMax.z;
      tMax.z += delta.z;
    }
  }
  return null;
}
