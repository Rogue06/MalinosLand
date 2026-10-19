import { describe, expect, it } from 'vitest';
import { circleBlocked, hasLineOfSight, moveWithCollision } from '../src/core/collision';
import { CollisionGrid } from '../src/core/grid';
import { facingFromDelta, project, screenInputToWorld, unproject } from '../src/core/iso';
import { findPath, smoothPath } from '../src/core/pathfinding';
import { TokenBucket } from '../src/core/rateLimiter';
import { rotateFacing, rotatePoint, rotatedFootprint } from '../src/core/rotation';
import { sanitizeName, sanitizeText } from '../src/core/text';
import { avatarDepth, staticDepth } from '../src/world/depth';

function gridFrom(rows: string[]): CollisionGrid {
  const g = new CollisionGrid(rows[0]!.length, rows.length);
  rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && g.setBlocked(x, y)));
  return g;
}

describe('projection isométrique', () => {
  it('project / unproject sont inverses', () => {
    for (const [x, y] of [
      [0, 0],
      [3.5, 7.25],
      [12, 1],
    ] as const) {
      const s = project(x, y);
      const w = unproject(s.x, s.y);
      expect(w.x).toBeCloseTo(x);
      expect(w.y).toBeCloseTo(y);
    }
  });

  it('les touches écran donnent la bonne direction monde', () => {
    const up = screenInputToWorld(true, false, false, false);
    expect(up.x).toBeCloseTo(-Math.SQRT1_2);
    expect(up.y).toBeCloseTo(-Math.SQRT1_2);
    const right = screenInputToWorld(false, false, false, true);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeLessThan(0);
  });

  it('garde l’orientation sur une diagonale exacte', () => {
    expect(facingFromDelta(1, 1, 'px')).toBe('px');
    expect(facingFromDelta(1, 1, 'py')).toBe('py');
    expect(facingFromDelta(0, -1, 'px')).toBe('ny');
  });
});

describe('rotation des objets', () => {
  it('fait tourner empreinte, points et orientation', () => {
    expect(rotatedFootprint(2, 1, 1)).toEqual([1, 2]);
    // L'avant d'un objet 2x1 (y = 1) devient le côté x = 1 en rotation 1.
    expect(rotatePoint(1, 1, 1, 2, 1)).toEqual({ x: 1, y: 1 });
    expect(rotatePoint(0, 0, 2, 2, 1)).toEqual({ x: 2, y: 1 });
    expect(rotateFacing('py', 3)).toBe('nx');
  });
});

describe('collisions', () => {
  const grid = gridFrom(['.....', '..#..', '.....']);

  it('détecte le chevauchement d’une case bloquée', () => {
    expect(circleBlocked(grid, { x: 1.9, y: 1.5 }, 0.2)).toBe(true);
    expect(circleBlocked(grid, { x: 1.5, y: 1.5 }, 0.2)).toBe(false);
  });

  it('glisse le long d’un mur au lieu de s’arrêter', () => {
    const to = moveWithCollision(grid, { x: 1.5, y: 1.5 }, { x: 1, y: 0.3 }, 0.2);
    expect(to.x).toBeLessThanOrEqual(1.8 + 1e-6);
    expect(to.y).toBeCloseTo(1.8);
  });

  it('ne traverse jamais un mur, même avec un grand déplacement', () => {
    const to = moveWithCollision(grid, { x: 1.5, y: 1.5 }, { x: 3, y: 0 }, 0.2);
    expect(to.x).toBeLessThan(2);
  });

  it('ne sort pas de la carte', () => {
    const to = moveWithCollision(grid, { x: 0.5, y: 0.5 }, { x: -3, y: -3 }, 0.2);
    expect(to.x).toBeGreaterThanOrEqual(0.2 - 1e-6);
    expect(to.y).toBeGreaterThanOrEqual(0.2 - 1e-6);
  });

  it('ligne de vue', () => {
    expect(hasLineOfSight(grid, { x: 0.5, y: 1.5 }, { x: 4.5, y: 1.5 })).toBe(false);
    expect(hasLineOfSight(grid, { x: 0.5, y: 0.5 }, { x: 4.5, y: 0.5 })).toBe(true);
  });
});

describe('pathfinding A*', () => {
  const grid = gridFrom(['.....#....', '.###.#.##.', '...#...#..', '.#.####.#.', '.#........']);

  it('trouve un chemin valide qui contourne les obstacles', () => {
    const path = findPath(grid, { x: 0, y: 0 }, { x: 9, y: 0 })!;
    expect(path).not.toBeNull();
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path.at(-1)).toEqual({ x: 9, y: 0 });
    for (const p of path) expect(grid.isWalkable(p.x, p.y)).toBe(true);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBe(1);
      // Pas de coin coupé en diagonale.
      if (a.x !== b.x && a.y !== b.y) {
        expect(grid.isWalkable(b.x, a.y) && grid.isWalkable(a.x, b.y)).toBe(true);
      }
    }
  });

  it('renvoie null si la cible est inaccessible ou bloquée', () => {
    const closed = gridFrom(['..#..', '..#..', '..#..']);
    expect(findPath(closed, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
    expect(findPath(closed, { x: 0, y: 0 }, { x: 2, y: 1 })).toBeNull();
  });

  it('le lissage garde des segments sans collision', () => {
    const start = { x: 0.5, y: 0.5 };
    const path = findPath(grid, start, { x: 9, y: 4 })!;
    const pts = smoothPath(grid, start, path);
    expect(pts.length).toBeLessThanOrEqual(path.length);
    let prev = start;
    for (const p of pts) {
      expect(hasLineOfSight(grid, prev, p)).toBe(true);
      prev = p;
    }
  });
});

describe('limiteur de débit', () => {
  it('autorise une rafale puis se recharge', () => {
    let t = 0;
    const bucket = new TokenBucket(3, 1, () => t);
    expect([bucket.tryTake(), bucket.tryTake(), bucket.tryTake(), bucket.tryTake()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(bucket.waitTime()).toBeCloseTo(1);
    t = 1000;
    expect(bucket.tryTake()).toBe(true);
  });
});

describe('textes', () => {
  it('retire les caractères de contrôle et limite la longueur', () => {
    expect(sanitizeText('  salut\u0000 ‮à\ttous  ', 50)).toBe('salut à tous');
    expect(sanitizeText('x'.repeat(500), 140)).toHaveLength(140);
    expect(sanitizeText(42, 10)).toBe('');
  });

  it('valide les pseudos', () => {
    expect(sanitizeName('Léa_42')).toBe('Léa_42');
    expect(sanitizeName('a')).toBeNull();
    expect(sanitizeName('<script>')).toBeNull();
    expect(sanitizeName('   Joshua   ')).toBe('Joshua');
  });
});

describe('profondeur des avatars', () => {
  // Comptoir 3x1 en (13,11) : un avatar devant son extrémité gauche doit être devant.
  const desk = { x: 13, y: 11, w: 3, d: 1, depth: staticDepth(13, 11, 3, 1) };

  it('un avatar devant un meuble long est dessiné devant', () => {
    expect(avatarDepth({ x: 13.5, y: 12.25 }, [desk])).toBeGreaterThan(desk.depth);
  });

  it('un avatar derrière est dessiné derrière', () => {
    expect(avatarDepth({ x: 15.5, y: 10.75 }, [desk])).toBeLessThan(desk.depth);
  });
});
