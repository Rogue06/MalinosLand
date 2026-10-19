import { depthOf, type Vec2 } from '../core/iso';

/** Rectangle d'empreinte au sol avec sa profondeur d'affichage. */
export interface DepthBox {
  x: number;
  y: number;
  w: number;
  d: number;
  depth: number;
}

/** Profondeur d'un objet statique : centre de son empreinte. */
export function staticDepth(x: number, y: number, w: number, d: number): number {
  return depthOf(x + w / 2, y + d / 2);
}

/**
 * Profondeur d'un avatar. La règle « somme des coordonnées » ne suffit pas
 * près des meubles longs : on contraint donc l'avatar à être devant les objets
 * dont il est entièrement du côté +x/+y, et derrière ceux dont il est du côté -x/-y.
 */
export function avatarDepth(p: Vec2, nearby: Iterable<DepthBox>, r = 0.2): number {
  let lo = -Infinity;
  let hi = Infinity;
  const e = 1e-3;
  for (const o of nearby) {
    let front: boolean | null = null;
    if (p.x - r >= o.x + o.w - e) front = true;
    else if (p.x + r <= o.x + e) front = false;
    else if (p.y - r >= o.y + o.d - e) front = true;
    else if (p.y + r <= o.y + e) front = false;
    if (front === true) lo = Math.max(lo, o.depth + 1);
    else if (front === false) hi = Math.min(hi, o.depth - 1);
  }
  const base = depthOf(p.x, p.y, 0.5);
  if (lo > hi) return lo;
  return Math.min(Math.max(base, lo), hi);
}

/** Index spatial : objets proches d'une tuile (rayon `margin`). */
export class DepthIndex {
  private cells = new Map<number, DepthBox[]>();

  constructor(
    private readonly width: number,
    boxes: DepthBox[],
    margin = 2,
  ) {
    for (const b of boxes) {
      for (let y = Math.floor(b.y - margin); y < b.y + b.d + margin; y++) {
        for (let x = Math.floor(b.x - margin); x < b.x + b.w + margin; x++) {
          const key = y * width + x;
          let list = this.cells.get(key);
          if (!list) this.cells.set(key, (list = []));
          list.push(b);
        }
      }
    }
  }

  near(p: Vec2): DepthBox[] {
    return this.cells.get(Math.floor(p.y) * this.width + Math.floor(p.x)) ?? [];
  }
}
