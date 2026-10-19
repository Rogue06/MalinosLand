import { CollisionGrid } from '../core/grid';
import type { Facing, Vec2 } from '../core/iso';
import { rotateFacing, rotatedFootprint, rotatePoint, type Rotation } from '../core/rotation';
import type { CatalogEntry, FloorType, InteractionDef, MapFile, WallType, ZoneDef } from './types';
import { validateMap } from './validateMap';

export interface Seat {
  objectId: string;
  index: number;
  /** Position monde du centre de l'assise. */
  x: number;
  y: number;
  facing: Facing;
  height: number;
}

export interface WorldObject {
  /** Id de la carte, ou id généré pour les objets non interactifs. */
  id: string;
  type: string;
  entry: CatalogEntry;
  x: number;
  y: number;
  rot: Rotation;
  /** Empreinte après rotation. */
  w: number;
  d: number;
  variant: number;
  interaction: InteractionDef | null;
  seats: Seat[];
  label: string | null;
}

export interface TileInfo {
  floor: FloorType | null;
  wall: WallType | null;
}

export class MapValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(`Carte invalide :\n- ${errors.join('\n- ')}`);
  }
}

/**
 * Représentation logique d'une salle : tuiles, objets, zones, collisions.
 * Aucune dépendance au moteur graphique.
 */
export class WorldModel {
  readonly grid: CollisionGrid;
  readonly objects: WorldObject[] = [];
  private readonly objectsById = new Map<string, WorldObject>();
  private readonly occupiedSeats = new Map<string, string>();

  constructor(
    readonly map: MapFile,
    catalog: Record<string, CatalogEntry>,
  ) {
    const errors = validateMap(map, catalog);
    if (errors.length > 0) throw new MapValidationError(errors);

    this.grid = new CollisionGrid(map.width, map.height);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (this.tileAt(x, y).wall) this.grid.setBlocked(x, y);
      }
    }

    map.objects.forEach((placed, i) => {
      const entry = catalog[placed.type]!;
      const rot = (placed.rot ?? 0) as Rotation;
      const [w, d] = rotatedFootprint(entry.footprint[0], entry.footprint[1], rot);
      const id = placed.id ?? `${placed.type}-${i}`;
      const obj: WorldObject = {
        id,
        type: placed.type,
        entry,
        x: placed.x,
        y: placed.y,
        rot,
        w,
        d,
        variant: placed.variant ?? 0,
        interaction: placed.interaction ?? entry.defaultInteraction ?? null,
        label: placed.label ?? null,
        seats: (entry.seats ?? []).map((s, index) => {
          const p = rotatePoint(s.x, s.y, rot, entry.footprint[0], entry.footprint[1]);
          return {
            objectId: id,
            index,
            x: placed.x + p.x,
            y: placed.y + p.y,
            facing: rotateFacing('py', rot),
            height: s.height,
          };
        }),
      };
      this.objects.push(obj);
      this.objectsById.set(id, obj);
      if (entry.blocking) {
        for (let ty = obj.y; ty < obj.y + d; ty++) {
          for (let tx = obj.x; tx < obj.x + w; tx++) this.grid.setBlocked(tx, ty);
        }
      }
    });
  }

  get width(): number {
    return this.map.width;
  }

  get height(): number {
    return this.map.height;
  }

  tileAt(x: number, y: number): TileInfo {
    const ch = this.map.tiles[y]?.[x];
    const entry = ch !== undefined ? this.map.legend[ch] : undefined;
    return { floor: entry?.floor ?? null, wall: entry?.wall ?? null };
  }

  getObject(id: string): WorldObject | undefined {
    return this.objectsById.get(id);
  }

  /** Première zone (dans l'ordre de la carte) contenant le point. */
  zoneAt(p: Vec2): ZoneDef | null {
    for (const zone of this.map.zones) {
      const r = zone.rect;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return zone;
    }
    return null;
  }

  /** Distance d'un point au rectangle d'empreinte d'un objet. */
  distanceToObject(p: Vec2, obj: WorldObject): number {
    const dx = Math.max(obj.x - p.x, 0, p.x - (obj.x + obj.w));
    const dy = Math.max(obj.y - p.y, 0, p.y - (obj.y + obj.d));
    return Math.hypot(dx, dy);
  }

  /** Objet utilisable (interaction ou assise) le plus proche à portée. */
  nearestUsable(p: Vec2, maxDist = 0.9): WorldObject | null {
    let best: WorldObject | null = null;
    let bestDist = maxDist;
    for (const obj of this.objects) {
      if (!obj.interaction && obj.seats.length === 0) continue;
      const dist = this.distanceToObject(p, obj);
      if (dist <= bestDist) {
        best = obj;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Case libre adjacente à l'objet depuis laquelle interagir, en privilégiant
   * le devant de l'objet puis la plus proche du joueur.
   */
  approachTile(obj: WorldObject, from: Vec2): Vec2 | null {
    const front = rotateFacing('py', obj.rot);
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    for (let y = obj.y - 1; y <= obj.y + obj.d; y++) {
      for (let x = obj.x - 1; x <= obj.x + obj.w; x++) {
        const inside = x >= obj.x && x < obj.x + obj.w && y >= obj.y && y < obj.y + obj.d;
        if (inside || !this.grid.isWalkable(x, y)) continue;
        const diagonal = (x < obj.x || x >= obj.x + obj.w) && (y < obj.y || y >= obj.y + obj.d);
        const isFront =
          (front === 'py' && y === obj.y + obj.d) ||
          (front === 'ny' && y === obj.y - 1) ||
          (front === 'px' && x === obj.x + obj.w) ||
          (front === 'nx' && x === obj.x - 1);
        const dist = Math.hypot(x + 0.5 - from.x, y + 0.5 - from.y);
        candidates.push({ x, y, score: dist + (isFront ? 0 : 3) + (diagonal ? 2 : 0) });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    return best ? { x: best.x, y: best.y } : null;
  }

  /** Assise libre la plus proche d'un point, sur un objet donné. */
  freeSeat(obj: WorldObject, near: Vec2, selfId: string): Seat | null {
    let best: Seat | null = null;
    let bestDist = Infinity;
    for (const seat of obj.seats) {
      const occupant = this.occupiedSeats.get(seatKey(seat));
      if (occupant && occupant !== selfId) continue;
      const dist = Math.hypot(seat.x - near.x, seat.y - near.y);
      if (dist < bestDist) {
        best = seat;
        bestDist = dist;
      }
    }
    return best;
  }

  occupySeat(seat: Seat, who: string): void {
    this.occupiedSeats.set(seatKey(seat), who);
  }

  releaseSeats(who: string): void {
    for (const [key, occupant] of this.occupiedSeats) {
      if (occupant === who) this.occupiedSeats.delete(key);
    }
  }

  /** Cases accessibles depuis un point (parcours en largeur, 4 directions). */
  reachableTiles(from: Vec2): Set<string> {
    const seen = new Set<string>();
    const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
    if (!this.grid.isWalkable(start.x, start.y)) return seen;
    const queue: Vec2[] = [start];
    seen.add(`${start.x},${start.y}`);
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || !this.grid.isWalkable(nx, ny)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    return seen;
  }
}

function seatKey(seat: Seat): string {
  return `${seat.objectId}#${seat.index}`;
}
