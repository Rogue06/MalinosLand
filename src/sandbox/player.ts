import { blockDef } from './blocks';
import type { VoxelWorld } from './world';

/**
 * Déplacement du personnage dans le monde en cubes (logique pure et testée) : gravité, saut,
 * collisions axe par axe contre les cubes pleins, montée automatique d'une marche (facultative,
 * pour les personnes peu habituées aux jeux), vol en mode créatif.
 * Repère du monde : x et y au sol, z vers le haut ; la position est celle des pieds.
 */
export const HALF_WIDTH = 0.3;
export const HEIGHT = 1.8;
export const EYE = 1.62;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 6.2;
/** Accroupi (Maj) : on avance doucement et on ne tombe pas du bord. */
export const SNEAK_SPEED = 1.4;
export const FLY_SPEED = 10;
export const GRAVITY = 30;
export const JUMP_SPEED = 8.6;
/** Au-delà, on retombe… sur la dalle de départ. */
export const FALL_LIMIT = -8;
/** Dans l'eau : plus lent, on coule doucement, on remonte en nageant (saut maintenu). */
export const SWIM_FACTOR = 0.55;
export const SWIM_UP = 3.4;
export const SINK_SPEED = 2.2;
/** Coup de jambes pour sortir de l'eau contre un bord. */
export const SWIM_HOP = 6.4;

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vz: number;
  onGround: boolean;
}

export interface MoveInput {
  /** Direction voulue au sol (longueur 0 à 1, repère du monde). */
  wish: { x: number; y: number };
  jump: boolean;
  sprint: boolean;
  /** Accroupi : lent, et on reste au bord au lieu de tomber. */
  sneak?: boolean;
  /** Mode vol (créatif) : monter, descendre. */
  fly?: boolean;
  down?: boolean;
  /** Monte seul une marche d'un cube en marchant. */
  autoStep?: boolean;
}

const EPS = 1e-4;

/** Le corps du personnage chevauche-t-il un cube plein ? */
export function collides(world: VoxelWorld, x: number, y: number, z: number): boolean {
  const x0 = Math.floor(x - HALF_WIDTH + EPS);
  const x1 = Math.floor(x + HALF_WIDTH - EPS);
  const y0 = Math.floor(y - HALF_WIDTH + EPS);
  const y1 = Math.floor(y + HALF_WIDTH - EPS);
  const z0 = Math.floor(z + EPS);
  const z1 = Math.floor(z + HEIGHT - EPS);
  for (let zz = z0; zz <= z1; zz++)
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) if (world.solidAt(xx, yy, zz)) return true;
  return false;
}

/** Le personnage a-t-il de l'eau à hauteur de taille ? */
export function inWater(world: VoxelWorld, p: { x: number; y: number; z: number }): boolean {
  return (
    blockDef(world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z + 0.4))).fluid === true
  );
}

/** Une case est-elle occupée par le corps du personnage (pour refuser d'y poser un cube) ? */
export function occupies(p: PlayerState, cell: { x: number; y: number; z: number }): boolean {
  return (
    cell.x + 1 > p.x - HALF_WIDTH &&
    cell.x < p.x + HALF_WIDTH &&
    cell.y + 1 > p.y - HALF_WIDTH &&
    cell.y < p.y + HALF_WIDTH &&
    cell.z + 1 > p.z &&
    cell.z < p.z + HEIGHT
  );
}

/** Avance le personnage de `dt` secondes (découpé en petits pas pour ne jamais traverser). */
export function stepPlayer(p: PlayerState, input: MoveInput, dt: number, world: VoxelWorld): void {
  let left = Math.min(dt, 0.25);
  while (left > 0) {
    const h = Math.min(left, 1 / 120);
    subStep(p, input, h, world);
    left -= h;
  }
}

function subStep(p: PlayerState, input: MoveInput, dt: number, world: VoxelWorld): void {
  const sneak = !!input.sneak && !input.fly;
  const water = !input.fly && inWater(world, p);
  const speed =
    (input.fly ? FLY_SPEED : sneak ? SNEAK_SPEED : input.sprint ? SPRINT_SPEED : WALK_SPEED) *
    (water ? SWIM_FACTOR : 1);
  const len = Math.hypot(input.wish.x, input.wish.y);
  const k = len > 1 ? 1 / len : 1;
  const dx = input.wish.x * k * speed * dt;
  const dy = input.wish.y * k * speed * dt;

  let blocked = false;
  if (input.fly) {
    p.vz = input.jump ? FLY_SPEED : input.down ? -FLY_SPEED : 0;
  } else if (water) {
    // On nage : on coule lentement, on remonte avec le saut.
    p.vz = input.jump ? SWIM_UP : Math.max(p.vz - GRAVITY * 0.3 * dt, -SINK_SPEED);
  } else {
    if (input.jump && p.onGround) {
      p.vz = JUMP_SPEED;
      p.onGround = false;
    }
    p.vz = Math.max(p.vz - GRAVITY * dt, -40);
  }

  // Axe x, puis y : on avance jusqu'au cube, ou on monte la marche si c'est permis.
  for (const axis of ['x', 'y'] as const) {
    const d = axis === 'x' ? dx : dy;
    if (d === 0) continue;
    const nx = axis === 'x' ? p.x + d : p.x;
    const ny = axis === 'y' ? p.y + d : p.y;
    if (!collides(world, nx, ny, p.z)) {
      // Accroupi au sol : on ne fait pas le pas s'il n'y a plus rien sous les pieds.
      if (sneak && p.onGround && !collides(world, nx, ny, p.z - 0.05)) continue;
      p.x = nx;
      p.y = ny;
    } else {
      blocked = true;
      if (
        input.autoStep &&
        p.onGround &&
        !collides(world, nx, ny, Math.floor(p.z + EPS) + 1) &&
        !collides(world, p.x, p.y, Math.floor(p.z + EPS) + 1)
      ) {
        p.z = Math.floor(p.z + EPS) + 1;
        p.x = nx;
        p.y = ny;
      }
    }
  }

  // Contre un bord, en nageant vers le haut : un coup de jambes pour sortir de l'eau.
  if (water && blocked && input.jump) p.vz = SWIM_HOP;

  // Axe z : on tombe jusqu'au sol, on se cogne au plafond.
  const nz = p.z + p.vz * dt;
  if (!collides(world, p.x, p.y, nz)) p.z = nz;
  else {
    // En tombant, on se pose sur le dessus du cube touché (jamais plus haut qu'avant).
    if (p.vz < 0) p.z = Math.min(p.z, Math.floor(nz) + 1);
    p.vz = 0;
  }
  // Au sol : un cube plein juste sous les pieds (sonde de 2 cm, pour ne jamais rater un saut).
  p.onGround = !input.fly && p.vz <= 0 && collides(world, p.x, p.y, p.z - 0.02);
}

/** Retour sur la dalle de départ (bouton « Revenir au départ », chute sous le monde). */
export function respawn(p: PlayerState, world: VoxelWorld): void {
  p.x = world.spawn.x + 0.5;
  p.y = world.spawn.y + 0.5;
  p.z = world.spawn.z;
  p.vz = 0;
  p.onGround = false;
}
