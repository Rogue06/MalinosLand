import type { VoxelWorld } from './world';

/**
 * Objets tombés au sol (logique pure et testée) : quand on casse un cube, un petit cube de la
 * matière tombe, se pose, puis vient vers le joueur s'il passe à côté (« pop » : il est dans le
 * sac). Comme dans les jeux de construction en cubes, rien n'est perdu : un objet reste au sol
 * tant qu'on ne vient pas le chercher (gardé dans la sauvegarde).
 */
export interface Drop {
  item: number;
  x: number;
  y: number;
  z: number;
  vz: number;
  /** Secondes depuis l'apparition (on ne ramasse pas tout de suite : on voit l'objet tomber). */
  age: number;
}

export const PICKUP_DELAY = 0.45;
export const PICKUP_RANGE = 2.2;
/** Distance où l'objet est dans le sac. */
export const PICKUP_TOUCH = 0.6;
export const MAX_DROPS = 300;
const GRAVITY = 22;
const ATTRACT_SPEED = 9;

/** Un objet qui sort d'un cube cassé, avec un petit saut. */
export function spawnDrop(cell: { x: number; y: number; z: number }, item: number): Drop {
  return { item, x: cell.x + 0.5, y: cell.y + 0.5, z: cell.z + 0.25, vz: 3.2, age: 0 };
}

/**
 * Avance les objets de `dt` secondes : chute, pose au sol, attraction vers le joueur. Renvoie
 * les objets ramassés (retirés de la liste). `canTake` : le sac a encore de la place.
 */
export function stepDrops(
  drops: Drop[],
  player: { x: number; y: number; z: number },
  world: VoxelWorld,
  dt: number,
  canTake: (item: number) => boolean,
): number[] {
  const picked: number[] = [];
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]!;
    d.age += dt;
    const cx = player.x;
    const cy = player.y;
    const cz = player.z + 0.8;
    const dist = Math.hypot(cx - d.x, cy - d.y, cz - d.z);
    if (d.age > PICKUP_DELAY && dist < PICKUP_RANGE && canTake(d.item)) {
      if (dist < PICKUP_TOUCH) {
        picked.push(d.item);
        drops.splice(i, 1);
        continue;
      }
      // Attiré vers le joueur, en ligne droite (à travers les cubes, comme une aspiration).
      const k = Math.min(1, (ATTRACT_SPEED * dt) / dist);
      d.x += (cx - d.x) * k;
      d.y += (cy - d.y) * k;
      d.z += (cz - d.z) * k;
      d.vz = 0;
      continue;
    }
    // Chute, puis repos sur le cube du dessous.
    d.vz = Math.max(d.vz - GRAVITY * dt, -20);
    const nz = d.z + d.vz * dt;
    if (world.solidAt(Math.floor(d.x), Math.floor(d.y), Math.floor(nz))) {
      d.z = Math.floor(nz) + 1;
      d.vz = 0;
    } else d.z = nz;
    if (d.z < -4) drops.splice(i, 1);
  }
  return picked;
}

/** Relit des objets sauvegardés prudemment. */
export function parseDrops(raw: unknown, isItem: (id: number) => boolean): Drop[] {
  if (!Array.isArray(raw)) return [];
  const out: Drop[] = [];
  for (const e of raw.slice(0, MAX_DROPS)) {
    if (!Array.isArray(e) || e.length !== 4) continue;
    const [item, x, y, z] = e as number[];
    if (![item, x, y, z].every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
    if (!Number.isInteger(item) || !isItem(item!)) continue;
    if (x! < 0 || y! < 0 || x! > 64 || y! > 64 || z! < 0 || z! > 40) continue;
    out.push({ item: item!, x: x!, y: y!, z: z!, vz: 0, age: PICKUP_DELAY });
  }
  return out;
}

/** Forme compacte pour la sauvegarde. */
export function packDrops(drops: readonly Drop[]): Array<[number, number, number, number]> {
  const r = (v: number) => Math.round(v * 100) / 100;
  return drops.slice(0, MAX_DROPS).map((d) => [d.item, r(d.x), r(d.y), r(d.z)]);
}
