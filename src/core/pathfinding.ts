import { hasLineOfSight } from './collision';
import type { CollisionGrid } from './grid';
import type { Vec2 } from './iso';

const SQRT2 = Math.SQRT2;
const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/** Tas binaire minimal pour l'open set de A*. */
class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.prio.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent]! <= this.prio[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastPrio = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.prio[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l]! < this.prio[m]!) m = l;
        if (r < this.items.length && this.prio[r]! < this.prio[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.prio[a], this.prio[b]] = [this.prio[b]!, this.prio[a]!];
  }
}

/**
 * A* sur la grille (8 directions, sans couper les coins).
 * Renvoie la liste des tuiles de départ à arrivée incluses, ou null.
 */
export function findPath(
  grid: CollisionGrid,
  start: Vec2,
  goal: Vec2,
  maxNodes = 4000,
): Vec2[] | null {
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  const gx = Math.floor(goal.x);
  const gy = Math.floor(goal.y);
  if (!grid.isWalkable(gx, gy)) return null;
  if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

  const w = grid.width;
  const idx = (x: number, y: number) => y * w + x;
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const open = new MinHeap();
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };

  const startId = idx(sx, sy);
  gScore.set(startId, 0);
  open.push(startId, h(sx, sy));
  let explored = 0;

  while (open.size > 0) {
    const current = open.pop()!;
    if (closed.has(current)) continue;
    closed.add(current);
    const cx = current % w;
    const cy = Math.floor(current / w);
    if (cx === gx && cy === gy) return rebuild(cameFrom, current, w);
    if (++explored > maxNodes) return null;

    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.isWalkable(nx, ny)) continue;
      // Diagonale : les deux cases orthogonales doivent être libres.
      if (
        dx !== 0 &&
        dy !== 0 &&
        (!grid.isWalkable(cx + dx, cy) || !grid.isWalkable(cx, cy + dy))
      ) {
        continue;
      }
      const nId = idx(nx, ny);
      if (closed.has(nId)) continue;
      const tentative = gScore.get(current)! + cost;
      if (tentative < (gScore.get(nId) ?? Infinity)) {
        gScore.set(nId, tentative);
        cameFrom.set(nId, current);
        open.push(nId, tentative + h(nx, ny));
      }
    }
  }
  return null;
}

function rebuild(cameFrom: Map<number, number>, end: number, w: number): Vec2[] {
  const path: Vec2[] = [];
  let cur: number | undefined = end;
  while (cur !== undefined) {
    path.push({ x: cur % w, y: Math.floor(cur / w) });
    cur = cameFrom.get(cur);
  }
  return path.reverse();
}

/**
 * Transforme un chemin de tuiles en points de passage (centres de tuiles),
 * en supprimant les points intermédiaires visibles en ligne droite.
 */
export function smoothPath(grid: CollisionGrid, from: Vec2, tiles: Vec2[]): Vec2[] {
  const points = tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  if (points.length === 0) return [];
  const result: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < points.length) {
    let furthest = i;
    for (let j = points.length - 1; j > i; j--) {
      if (hasLineOfSight(grid, anchor, points[j]!)) {
        furthest = j;
        break;
      }
    }
    const p = points[furthest]!;
    result.push(p);
    anchor = p;
    i = furthest + 1;
  }
  return result;
}
