import type { CollisionGrid } from './grid';
import type { Vec2 } from './iso';

/** Rayon de collision d'un avatar, en tuiles. */
export const AVATAR_RADIUS = 0.22;

/** Le cercle (centre p, rayon r) chevauche-t-il une case bloquée ? */
export function circleBlocked(grid: CollisionGrid, p: Vec2, r: number): boolean {
  const minX = Math.floor(p.x - r);
  const maxX = Math.floor(p.x + r);
  const minY = Math.floor(p.y - r);
  const maxY = Math.floor(p.y + r);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!grid.isBlocked(tx, ty)) continue;
      // Distance du centre au carré de la tuile (AABB).
      const cx = Math.max(tx, Math.min(p.x, tx + 1));
      const cy = Math.max(ty, Math.min(p.y, ty + 1));
      if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < r * r - 1e-9) return true;
    }
  }
  return false;
}

/**
 * Déplace un cercle en glissant le long des obstacles : on résout l'axe x puis
 * l'axe y séparément, en sous-pas pour ne jamais traverser une case fine.
 */
export function moveWithCollision(
  grid: CollisionGrid,
  from: Vec2,
  delta: Vec2,
  r = AVATAR_RADIUS,
): Vec2 {
  const dist = Math.hypot(delta.x, delta.y);
  const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
  let x = from.x;
  let y = from.y;
  const sx = delta.x / steps;
  const sy = delta.y / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0 && !circleBlocked(grid, { x: x + sx, y }, r)) x += sx;
    if (sy !== 0 && !circleBlocked(grid, { x, y: y + sy }, r)) y += sy;
  }
  return { x, y };
}

/** Vrai si un cercle peut aller en ligne droite de a à b sans heurter d'obstacle. */
export function hasLineOfSight(grid: CollisionGrid, a: Vec2, b: Vec2, r = AVATAR_RADIUS): boolean {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 0.1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (circleBlocked(grid, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, r)) {
      return false;
    }
  }
  return true;
}
