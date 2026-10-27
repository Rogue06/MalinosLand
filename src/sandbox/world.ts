import { hash2 } from '../core/random';
import {
  AIR,
  BEDROCK,
  COAL_ORE,
  CRYSTAL_ORE,
  DIRT,
  GRASS,
  GRAVEL,
  HUB_FLOOR,
  HUB_GLASS,
  HUB_LIGHT,
  HUB_TRIM,
  HUB_WALL,
  LEAVES,
  LOG,
  PAD,
  SAND,
  SNOW,
  STONE,
  blockDef,
  itemDef,
} from './blocks';

/**
 * Monde en cubes du « Chantier des mondes ». Logique pure et testée : ni DOM, ni moteur de rendu.
 * Même repère que le Hub : x et y au sol, z vers le haut.
 *
 * Le monde est découpé en **tranches** de CHUNK × CHUNK colonnes, calculées **à la demande** et
 * toujours à l'identique (même graine → même terrain) : le navigateur n'en calcule que ce qu'il
 * faut, et le serveur (jeu à plusieurs) pourra faire de même, en peu de calcul par message. On ne
 * garde que les **modifications** (liste compacte), jamais le monde entier.
 */
export const CHUNK = 16;
export const SIZE_X = 192;
export const SIZE_Y = 192;
export const SIZE_Z = 48;
export const CHUNKS_X = SIZE_X / CHUNK;
export const CHUNKS_Y = SIZE_Y / CHUNK;
/** Plafond de modifications gardées (sauvegarde de moins d'1 Mo). */
export const MAX_EDITS = 60_000;
/** Nombre d'actions que l'on peut annuler (mode créatif). */
export const MAX_UNDO = 100;
/** Demi-largeur de la zone de départ protégée (3 × 3 colonnes). */
export const SPAWN_RADIUS = 1;
/** Hauteur d'air gardée libre au-dessus de la dalle de départ. */
export const SPAWN_CLEAR = 3;
/** Point de départ : au sud du centre, face au Hub que l'on voit au loin, au nord. */
export const SPAWN_X = 96;
export const SPAWN_Y = 120;

/**
 * Le Hub des Malinos, vu de loin (pas encore relié) : rectangle au sol, hauteur du dallage. On
 * ne peut ni le casser ni construire tout contre (bande de PROTECT cubes autour).
 */
export const HUB = { x0: 70, y0: 8, w: 52, d: 34, z: 20 } as const;
const HUB_PROTECT = 3;

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

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Distance (en cubes) d'une colonne au rectangle du Hub (0 dedans). */
function hubDistance(x: number, y: number): number {
  const dx = Math.max(HUB.x0 - x, 0, x - (HUB.x0 + HUB.w - 1));
  const dy = Math.max(HUB.y0 - y, 0, y - (HUB.y0 + HUB.d - 1));
  return Math.hypot(dx, dy);
}

/** Le chemin de gravier entre la dalle de départ et l'entrée du Hub. */
function onPath(x: number, y: number): boolean {
  return Math.abs(x - SPAWN_X) <= 1 && y >= HUB.y0 + HUB.d && y < SPAWN_Y - 2;
}

/**
 * Hauteur du sol d'une colonne : plaines, collines, montagnes (sommets enneigés), aplanie en
 * douceur autour du Hub, de la dalle de départ et du chemin.
 */
export function columnHeight(seed: number, x: number, y: number): number {
  const hills =
    noise2(seed, x, y, 26) * 0.6 +
    noise2(seed + 7, x, y, 11) * 0.3 +
    noise2(seed + 3, x, y, 5) * 0.1;
  const mount = smooth((noise2(seed + 11, x, y, 52) - 0.55) / 0.3);
  let h = 13 + hills * 9 + mount * mount * 22;
  // Le Hub est posé sur un plateau ; la dalle et le chemin sur un terrain doux.
  const hub = smooth(1 - hubDistance(x, y) / 18);
  h = h * (1 - hub) + HUB.z * hub;
  const spawn = smooth(1 - Math.hypot(x - SPAWN_X, y - SPAWN_Y) / 14);
  const path = Math.abs(x - SPAWN_X) <= 4 && y > HUB.y0 + HUB.d && y < SPAWN_Y ? 0.6 : 0;
  const flat = Math.max(spawn, path);
  const target = HUB.z - 2 + (y - (HUB.y0 + HUB.d)) * 0.02;
  h = h * (1 - flat) + target * flat;
  return Math.max(4, Math.min(SIZE_Z - 8, Math.round(h)));
}

/** Sommet de la tour du Hub : un faisceau de lumière en part, visible de tout le monde. */
export const HUB_BEACON = { x: HUB.x0 + 11.5, y: HUB.y0 + 10.5, z: HUB.z + 27 };

/** Les cubes du Hub (null : pas de Hub ici). Dallage, grand hall vitré, entrée, logo, tour. */
export function hubBlock(x: number, y: number, z: number): number | null {
  const lx = x - HUB.x0;
  const ly = y - HUB.y0;
  if (lx < 0 || ly < 0 || lx >= HUB.w || ly >= HUB.d) return null;
  const h = z - HUB.z;
  if (h === 0) return HUB_FLOOR;
  if (h < 0) return null;
  // Lanternes aux quatre coins du dallage.
  const corner = (lx === 1 || lx === HUB.w - 2) && (ly === 1 || ly === HUB.d - 2);
  if (corner) return h <= 2 ? HUB_WALL : h === 3 ? HUB_LIGHT : AIR;
  // Grand hall : murs sombres, bordure turquoise, fenêtres, toit plat.
  const ix = lx - 4;
  const iy = ly - 4;
  const W = HUB.w - 8;
  const D = HUB.d - 8;
  const inside = ix >= 0 && iy >= 0 && ix < W && iy < D;
  // Tour (les futurs logements), au fond à gauche, plus haute que tout.
  const tx = ix - 3;
  const ty = iy - 2;
  if (tx >= 0 && ty >= 0 && tx < 9 && ty < 9 && h <= 26) {
    const edge = tx === 0 || ty === 0 || tx === 8 || ty === 8;
    if (h === 26) return HUB_LIGHT;
    if (h === 25) return HUB_TRIM;
    if (!edge) return h % 5 === 0 ? HUB_FLOOR : AIR;
    return h % 5 === 3 ? HUB_GLASS : HUB_WALL;
  }
  if (!inside || h > 12) return AIR;
  const edge = ix === 0 || iy === 0 || ix === W - 1 || iy === D - 1;
  if (h === 12) return edge ? HUB_TRIM : HUB_WALL;
  if (!edge) return AIR;
  if (h === 11) return HUB_TRIM;
  const front = iy === D - 1;
  const mid = Math.floor(W / 2);
  // Entrée vitrée (on voit dedans, on n'entre pas encore) et grand « M » au-dessus.
  if (front && Math.abs(ix - mid) <= 2 && h <= 5) return HUB_GLASS;
  if (front && Math.abs(ix - mid) <= 3 && h >= 6 && h <= 10) {
    const M = ['1000001', '1100011', '1010101', '1001001', '1000001'];
    return M[10 - h]![ix - mid + 3] === '1' ? HUB_TRIM : HUB_WALL;
  }
  // Bandes de fenêtres sur tout le tour.
  const along = iy === 0 || front ? ix : iy;
  if (h >= 3 && h <= 8 && along % 4 !== 0) return HUB_GLASS;
  return HUB_WALL;
}

/** Où pousse un arbre : une case sur une grille de 7 × 7, décalée, selon la forêt. */
function treeAt(
  seed: number,
  gx: number,
  gy: number,
): { x: number; y: number; trunk: number } | null {
  const h = hash2(gx * 7 + seed * 13, gy * 7 - seed * 29);
  const x = gx * 7 + (h % 5);
  const y = gy * 7 + ((h >> 8) % 5);
  const forest = noise2(seed + 21, x, y, 30);
  if ((h >> 16) % 100 > forest * 120 - 20) return null;
  if (x < 3 || y < 3 || x >= SIZE_X - 3 || y >= SIZE_Y - 3) return null;
  if (hubDistance(x, y) < 6 || Math.hypot(x - SPAWN_X, y - SPAWN_Y) < 6) return null;
  if (Math.abs(x - SPAWN_X) <= 3 && y > HUB.y0 + HUB.d - 2 && y < SPAWN_Y) return null;
  return { x, y, trunk: 4 + ((h >> 4) % 3) };
}

/**
 * Calcule une tranche du terrain de départ (CHUNK × CHUNK colonnes, toute la hauteur). Indice
 * dans la tranche : lx + CHUNK × (ly + CHUNK × z).
 */
export function genChunk(seed: number, cx: number, cy: number): Uint8Array {
  const out = new Uint8Array(CHUNK * CHUNK * SIZE_Z);
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const at = (lx: number, ly: number, z: number) => lx + CHUNK * (ly + CHUNK * z);
  for (let ly = 0; ly < CHUNK; ly++)
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      const y = y0 + ly;
      const h = columnHeight(seed, x, y);
      const hubNear = hubDistance(x, y) < 6;
      const spawnNear = Math.hypot(x - SPAWN_X, y - SPAWN_Y) < 5;
      for (let z = 0; z <= h; z++) {
        let b =
          z === 0
            ? BEDROCK
            : z < h - 3
              ? STONE
              : z < h
                ? DIRT
                : h <= 13
                  ? SAND
                  : h >= 33
                    ? SNOW
                    : GRASS;
        if (b === STONE) {
          const r = hash2(x * 31 + z * 7 + seed, y * 17 - z * 3) % 1000;
          if (z < 10 && r < 6) b = CRYSTAL_ORE;
          else if (r < 20) b = COAL_ORE;
          else if (h >= 30 && z > h - 6 && r < 400) b = STONE;
        }
        // Montagnes : la roche affleure sur les pentes hautes.
        if (b === GRASS && h >= 29) b = STONE;
        if (z === h && onPath(x, y)) b = GRAVEL;
        // Grottes : poches creusées sous la surface (jamais sous le Hub ni la dalle).
        if (z >= 2 && z < h - 2 && !hubNear && !spawnNear) {
          const c = noise3(seed + 50, x, y, z, 8);
          const d = noise3(seed + 90, x, y, z, 6);
          if (Math.abs(c - 0.5) < 0.055 && d > 0.35) b = AIR;
        }
        out[at(lx, ly, z)] = b;
      }
    }
  // Arbres (les feuillages débordent sur les tranches voisines : on regarde aussi autour).
  for (let gy = Math.floor((y0 - 3) / 7); gy <= Math.floor((y0 + CHUNK + 3) / 7); gy++)
    for (let gx = Math.floor((x0 - 3) / 7); gx <= Math.floor((x0 + CHUNK + 3) / 7); gx++) {
      const t = treeAt(seed, gx, gy);
      if (!t) continue;
      const h = columnHeight(seed, t.x, t.y);
      if (h <= 13 || h >= 29 || h + t.trunk + 2 >= SIZE_Z) continue;
      const set = (x: number, y: number, z: number, b: number, onlyAir: boolean) => {
        const lx = x - x0;
        const ly = y - y0;
        if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) return;
        const i = at(lx, ly, z);
        if (!onlyAir || out[i] === AIR) out[i] = b;
      };
      for (let z = h + 1; z <= h + t.trunk; z++) set(t.x, t.y, z, LOG, false);
      for (let dz = t.trunk - 1; dz <= t.trunk + 1; dz++) {
        const r = dz === t.trunk + 1 ? 1 : 2;
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (
              Math.abs(dx) === r &&
              Math.abs(dy) === r &&
              (dz !== t.trunk || hash2(dx + t.x, dy + t.y) % 2)
            )
              continue;
            set(t.x + dx, t.y + dy, h + dz, LEAVES, true);
          }
      }
    }
  // Le Hub, au nord.
  if (x0 < HUB.x0 + HUB.w && x0 + CHUNK > HUB.x0 && y0 < HUB.y0 + HUB.d && y0 + CHUNK > HUB.y0)
    for (let ly = 0; ly < CHUNK; ly++)
      for (let lx = 0; lx < CHUNK; lx++)
        for (let z = HUB.z; z < SIZE_Z; z++) {
          const b = hubBlock(x0 + lx, y0 + ly, z);
          if (b !== null) out[at(lx, ly, z)] = b;
        }
  // Dalle de départ (3 × 3), avec de l'air au-dessus.
  const sx = SPAWN_X - x0;
  const sy = SPAWN_Y - y0;
  if (sx >= -1 && sy >= -1 && sx <= CHUNK && sy <= CHUNK) {
    const ch = columnHeight(seed, SPAWN_X, SPAWN_Y);
    for (let dy = -SPAWN_RADIUS; dy <= SPAWN_RADIUS; dy++)
      for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) {
        const lx = sx + dx;
        const ly = sy + dy;
        if (lx < 0 || ly < 0 || lx >= CHUNK || ly >= CHUNK) continue;
        for (let z = 1; z < SIZE_Z; z++) out[at(lx, ly, z)] = z < ch ? DIRT : z === ch ? PAD : AIR;
      }
  }
  return out;
}

export class VoxelWorld {
  /** Cubes actuels (tranches calculées au fur et à mesure). */
  readonly blocks = new Uint8Array(SIZE_X * SIZE_Y * SIZE_Z);
  private readonly base = new Uint8Array(SIZE_X * SIZE_Y * SIZE_Z);
  private readonly generated = new Uint8Array(CHUNKS_X * CHUNKS_Y);
  /** Modifications par tranche : indice → cube. */
  private readonly changes = new Map<number, Map<number, number>>();
  private readonly undoStack: Array<{ index: number; before: number; after: number }> = [];
  readonly spawn: Cell;

  constructor(readonly seed = 1) {
    this.spawn = { x: SPAWN_X, y: SPAWN_Y, z: columnHeight(seed, SPAWN_X, SPAWN_Y) + 1 };
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

  private chunkOf(index: number): number {
    const c = this.cellOf(index);
    return Math.floor(c.x / CHUNK) + CHUNKS_X * Math.floor(c.y / CHUNK);
  }

  isGenerated(cx: number, cy: number): boolean {
    return this.generated[cx + CHUNKS_X * cy] === 1;
  }

  /** Calcule une tranche si ce n'est pas déjà fait (terrain de départ + modifications). */
  ensureChunk(cx: number, cy: number): void {
    const ci = cx + CHUNKS_X * cy;
    if (this.generated[ci]) return;
    this.generated[ci] = 1;
    const data = genChunk(this.seed, cx, cy);
    for (let z = 0; z < SIZE_Z; z++)
      for (let ly = 0; ly < CHUNK; ly++) {
        const src = CHUNK * (ly + CHUNK * z);
        const dst = this.index(cx * CHUNK, cy * CHUNK + ly, z);
        const row = data.subarray(src, src + CHUNK);
        this.base.set(row, dst);
        this.blocks.set(row, dst);
      }
    for (const [i, b] of this.changes.get(ci) ?? []) this.blocks[i] = b;
  }

  /**
   * Considère toutes les tranches comme calculées, sans rien calculer : pour un monde fabriqué
   * à la main (tests de déplacement, outils).
   */
  markAllGenerated(): void {
    this.generated.fill(1);
  }

  /** Calcule tout le monde (tests, outils). */
  ensureAll(): void {
    for (let cy = 0; cy < CHUNKS_Y; cy++)
      for (let cx = 0; cx < CHUNKS_X; cx++) this.ensureChunk(cx, cy);
  }

  /** Hors de la parcelle : de l'air au-dessus et autour, du socle en dessous. */
  get(x: number, y: number, z: number): number {
    if (z < 0) return BEDROCK;
    if (!this.inBounds(x, y, z)) return AIR;
    const ci = Math.floor(x / CHUNK) + CHUNKS_X * Math.floor(y / CHUNK);
    if (!this.generated[ci]) this.ensureChunk(ci % CHUNKS_X, Math.floor(ci / CHUNKS_X));
    return this.blocks[this.index(x, y, z)]!;
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

  /** Zone protégée : la dalle de départ, et le Hub avec une bande autour. */
  protectedCell(x: number, y: number, z: number): boolean {
    if (hubDistance(x, y) < HUB_PROTECT && z >= HUB.z - 1) return true;
    const near =
      Math.abs(x - this.spawn.x) <= SPAWN_RADIUS && Math.abs(y - this.spawn.y) <= SPAWN_RADIUS;
    return near && z >= this.spawn.z - 1 && z < this.spawn.z + SPAWN_CLEAR;
  }

  private protectedReason(x: number, y: number): string {
    return hubDistance(x, y) < HUB_PROTECT
      ? 'Le Hub des Malinos est protégé : on n’y touche pas (il sera bientôt relié à ce monde).'
      : 'La zone de départ est protégée.';
  }

  /** Pourquoi on ne peut pas casser ce cube (null : possible). */
  breakProblem(x: number, y: number, z: number): string | null {
    const b = this.get(x, y, z);
    if (b === AIR || !this.inBounds(x, y, z)) return 'Il n’y a rien à creuser ici.';
    if (blockDef(b).hub) return this.protectedReason(x, y);
    if (blockDef(b).hardness === Infinity) return 'Ce cube ne se casse pas.';
    if (this.protectedCell(x, y, z)) return this.protectedReason(x, y);
    return null;
  }

  /** Pourquoi on ne peut pas poser ce cube ici (null : possible). */
  placeProblem(x: number, y: number, z: number, block: number): string | null {
    if (!this.inBounds(x, y, z)) return 'Hors de la parcelle.';
    if (!itemDef(block)?.block) return 'Ce n’est pas un cube.';
    const here = this.get(x, y, z);
    if (here !== AIR) return 'La place est déjà prise.';
    if (this.protectedCell(x, y, z)) return this.protectedReason(x, y);
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

  /**
   * Écrit un cube (la tranche est calculée si besoin) et tient à jour la liste des
   * modifications : revenir au cube de départ efface la modification.
   */
  write(index: number, block: number, record = true): void {
    const ci = this.chunkOf(index);
    if (!this.generated[ci]) this.ensureChunk(ci % CHUNKS_X, Math.floor(ci / CHUNKS_X));
    const before = this.blocks[index]!;
    if (before === block) return;
    this.blocks[index] = block;
    let m = this.changes.get(ci);
    if (!m) this.changes.set(ci, (m = new Map()));
    if (this.base[index] === block) m.delete(index);
    else m.set(index, block);
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

  /** Nombre de modifications. */
  get editCount(): number {
    let n = 0;
    for (const m of this.changes.values()) n += m.size;
    return n;
  }

  /** Modifications par rapport au terrain de départ : ce qu'on sauvegarde. */
  edits(): Edit[] {
    const out: Edit[] = [];
    for (const m of this.changes.values())
      for (const [i, b] of m) {
        if (out.length >= MAX_EDITS) return out;
        out.push([i, b]);
      }
    return out;
  }

  /**
   * Recharge des modifications sauvegardées. Les données sont relues prudemment : indice hors de
   * la parcelle, cube inconnu, cube incassable ou zone protégée → ignoré.
   */
  load(raw: unknown): number {
    this.reset();
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
      const current = this.get(c.x, c.y, c.z);
      if (blockDef(current).hardness === Infinity) continue;
      this.write(index, block, false);
      applied++;
    }
    return applied;
  }

  /** Remet le terrain de départ (les tranches seront recalculées à la demande). */
  reset(): void {
    this.changes.clear();
    this.generated.fill(0);
    this.undoStack.length = 0;
  }
}

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
