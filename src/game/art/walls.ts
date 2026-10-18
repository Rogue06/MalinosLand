import type { WallType } from '../../world/types';
import { darken } from './color';
import type { Decal } from './iso3d';
import { IsoBuilder } from './iso3d';
import { PALETTE as P } from './palette';

export const WALL_HEIGHT: Record<WallType, number> = { tall: 2.6, brick: 2.6, low: 0.8 };
export const WALL_THICKNESS: Record<WallType, number> = { tall: 0.36, brick: 0.36, low: 0.26 };

/** Bits de connexion vers les voisins : N = y-1, E = x+1, S = y+1, W = x-1. */
export const WALL_N = 1;
export const WALL_E = 2;
export const WALL_S = 4;
export const WALL_W = 8;

/** Plan de la face visible (+y) d'un mur, dans le repère de sa tuile. */
export function wallFaceY(type: WallType): number {
  return 0.5 + WALL_THICKNESS[type] / 2;
}

function brickDecals(h: number): Decal[] {
  const decals: Decal[] = [];
  const row = 0.13 / h;
  for (let v = row; v < 1 - 0.02; v += row)
    decals.push({ face: 'py', u0: 0, v0: v, u1: 1, v1: v + 0.012, color: '#e3c7b4' });
  for (let v = row; v < 1 - 0.02; v += row)
    decals.push({ face: 'px', u0: 0, v0: v, u1: 1, v1: v + 0.012, color: '#d9b9a4' });
  return decals;
}

/**
 * Mur d'une tuile : un poteau central et des bras vers les murs voisins.
 * Les murs hauts ont une plinthe, les cloisons basses un chapeau turquoise.
 */
export function drawWall(type: WallType, mask: number): IsoBuilder {
  const b = new IsoBuilder();
  const h = WALL_HEIGHT[type];
  const t = WALL_THICKNESS[type];
  const lo = 0.5 - t / 2;
  const hi = 0.5 + t / 2;
  const body = type === 'brick' ? P.brick : type === 'tall' ? P.plaster : P.slate;
  const segments: Array<[number, number, number, number]> = [[lo, lo, t, t]];
  if (mask & WALL_N) segments.push([lo, 0, t, lo]);
  if (mask & WALL_S) segments.push([lo, hi, t, 1 - hi]);
  if (mask & WALL_W) segments.push([0, lo, lo, t]);
  if (mask & WALL_E) segments.push([hi, lo, 1 - hi, t]);

  // Fusion du poteau avec les bras alignés pour limiter les arêtes visibles.
  const merged: Array<[number, number, number, number]> = [];
  const horizontal = mask & (WALL_E | WALL_W);
  const vertical = mask & (WALL_N | WALL_S);
  if (horizontal) {
    const x0 = mask & WALL_W ? 0 : lo;
    const x1 = mask & WALL_E ? 1 : hi;
    merged.push([x0, lo, x1 - x0, t]);
  }
  if (vertical) {
    const y0 = mask & WALL_N ? 0 : lo;
    const y1 = mask & WALL_S ? 1 : hi;
    // Évite de dessiner deux fois le poteau central.
    if (horizontal) {
      if (mask & WALL_N) merged.push([lo, 0, t, lo]);
      if (mask & WALL_S) merged.push([lo, hi, t, 1 - hi]);
    } else merged.push([lo, y0, t, y1 - y0]);
  }
  if (merged.length === 0) merged.push(segments[0]!);

  for (const [x, y, w, d] of merged) {
    if (type === 'low') {
      b.box({ x, y, z: 0, w, d, h: h - 0.07, color: body });
      b.box({
        x: x - 0.02,
        y: y - 0.02,
        z: h - 0.07,
        w: w + 0.04,
        d: d + 0.04,
        h: 0.07,
        color: P.teal,
      });
    } else {
      b.box({
        x,
        y,
        z: 0,
        w,
        d,
        h,
        color: body,
        top: darken(body, 0.45),
        decals: [
          ...(type === 'brick' ? brickDecals(h) : []),
          { face: 'py', u0: 0, v0: 0, u1: 1, v1: 0.05, color: darken(body, 0.25) },
          { face: 'px', u0: 0, v0: 0, u1: 1, v1: 0.05, color: darken(body, 0.25) },
        ],
      });
    }
  }
  return b;
}
