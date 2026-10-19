/**
 * Projection isométrique 2:1 (dimétrique) et conversions monde ↔ écran.
 *
 * Repère « monde » : x vers le bas-droite de l'écran, y vers le bas-gauche,
 * z vers le haut. L'unité est la tuile (1 = une case de sol).
 */

export const TILE_W = 64;
export const TILE_H = 32;
/** Hauteur à l'écran (px) d'une unité verticale z. */
export const Z_PX = 32;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 extends Vec2 {
  z: number;
}

/** Projette un point monde vers l'écran (pixels, avant zoom caméra). */
export function project(x: number, y: number, z = 0): Vec2 {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2) - z * Z_PX,
  };
}

/** Inverse de `project` pour z = 0 : renvoie une position monde continue. */
export function unproject(sx: number, sy: number): Vec2 {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Tuile entière contenant une position monde. */
export function tileOf(p: Vec2): Vec2 {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

/**
 * Profondeur d'affichage : plus un objet est « devant » (x + y grand), plus il
 * est dessiné tard. Un léger biais permet de départager des cas d'égalité.
 */
export function depthOf(x: number, y: number, bias = 0): number {
  return (x + y) * 100 + bias;
}

/** Les 4 orientations d'un avatar ou d'un objet, alignées sur les axes du monde. */
export type Facing = 'px' | 'py' | 'nx' | 'ny';

export const FACINGS: readonly Facing[] = ['py', 'px', 'ny', 'nx'];

/** Vecteur unitaire monde associé à une orientation. */
export function facingVector(f: Facing): Vec2 {
  switch (f) {
    case 'px':
      return { x: 1, y: 0 };
    case 'nx':
      return { x: -1, y: 0 };
    case 'py':
      return { x: 0, y: 1 };
    case 'ny':
      return { x: 0, y: -1 };
  }
}

/**
 * Orientation à partir d'un déplacement. Sur une diagonale parfaite, on garde
 * l'orientation courante si elle est compatible, pour éviter le scintillement.
 */
export function facingFromDelta(dx: number, dy: number, current: Facing): Facing {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 1e-6 && ay < 1e-6) return current;
  const fx: Facing = dx > 0 ? 'px' : 'nx';
  const fy: Facing = dy > 0 ? 'py' : 'ny';
  if (Math.abs(ax - ay) < 0.15 * Math.max(ax, ay)) {
    if (current === fx || current === fy) return current;
  }
  return ax > ay ? fx : fy;
}

/** Orientation de l'avatar qui regarde un point. */
export function facingToward(from: Vec2, to: Vec2, current: Facing): Facing {
  return facingFromDelta(to.x - from.x, to.y - from.y, current);
}

/**
 * Direction monde correspondant aux touches écran (haut, bas, gauche, droite).
 * « Haut » à l'écran = vers (-1, -1) dans le monde, etc. Résultat normalisé.
 */
export function screenInputToWorld(
  up: boolean,
  down: boolean,
  left: boolean,
  right: boolean,
): Vec2 {
  let x = 0;
  let y = 0;
  if (up) {
    x -= 1;
    y -= 1;
  }
  if (down) {
    x += 1;
    y += 1;
  }
  if (left) {
    x -= 1;
    y += 1;
  }
  if (right) {
    x += 1;
    y -= 1;
  }
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}
