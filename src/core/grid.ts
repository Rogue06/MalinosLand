import type { Vec2 } from './iso';

/**
 * Grille de collision : une case est bloquée (mur, meuble…) ou libre.
 * Indépendante du rendu, utilisée par le déplacement et le pathfinding.
 */
export class CollisionGrid {
  readonly width: number;
  readonly height: number;
  private readonly blocked: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.blocked = new Uint8Array(width * height);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Hors de la carte = bloqué. */
  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.blocked[y * this.width + x] === 1;
  }

  isWalkable(x: number, y: number): boolean {
    return !this.isBlocked(x, y);
  }

  setBlocked(x: number, y: number, value = true): void {
    if (!this.inBounds(x, y)) return;
    this.blocked[y * this.width + x] = value ? 1 : 0;
  }

  /** Case libre la plus proche (recherche en largeur), ou null. */
  nearestWalkable(target: Vec2, maxRadius = 6): Vec2 | null {
    const tx = Math.floor(target.x);
    const ty = Math.floor(target.y);
    if (this.isWalkable(tx, ty)) return { x: tx, y: ty };
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (!this.isWalkable(x, y)) continue;
          const d = Math.hypot(x + 0.5 - target.x, y + 0.5 - target.y);
          if (d < bestDist) {
            bestDist = d;
            best = { x, y };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }
}
