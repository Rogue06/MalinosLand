import { AVATAR_RADIUS, circleBlocked, moveWithCollision } from '../core/collision';
import { facingFromDelta, facingVector, facingToward, type Facing, type Vec2 } from '../core/iso';
import { findPath, smoothPath } from '../core/pathfinding';
import type { Seat, WorldModel, WorldObject } from './WorldModel';

/** Distance maximale (tuiles) pour utiliser un objet. */
export const USE_RANGE = 0.95;
export const WALK_SPEED = 3.4;

export type PendingAction = { kind: 'use' | 'sit'; objectId: string };

export interface StepResult {
  moved: boolean;
  /** Action à exécuter maintenant (le joueur vient d'arriver). */
  arrived: PendingAction | null;
}

/**
 * Logique du personnage contrôlé : déplacement au clavier ou au clic
 * (pathfinding), actions différées « aller vers un objet puis l'utiliser »,
 * assise. Aucune dépendance au rendu.
 */
export class PlayerController {
  pos: Vec2;
  facing: Facing;
  seat: Seat | null = null;
  private standPos: Vec2 | null = null;
  private waypoints: Vec2[] = [];
  private pending: PendingAction | null = null;
  private stuckTime = 0;

  constructor(
    private readonly world: WorldModel,
    readonly id: string,
    spawn: Vec2,
    facing: Facing,
  ) {
    this.pos = { ...spawn };
    this.facing = facing;
  }

  get isWalkingPath(): boolean {
    return this.waypoints.length > 0;
  }

  /** Destination finale du chemin courant (pour l'indicateur au sol). */
  get destination(): Vec2 | null {
    return this.waypoints.at(-1) ?? null;
  }

  /** Va vers un point du sol. Renvoie false si inaccessible. */
  walkTo(target: Vec2): boolean {
    this.standUp();
    const tile = this.world.grid.nearestWalkable(target, 3);
    if (!tile) return false;
    this.pending = null;
    return this.planPath(tile, target);
  }

  private planPath(tile: Vec2, exact?: Vec2): boolean {
    const tiles = findPath(this.world.grid, this.pos, tile);
    if (!tiles) return false;
    const points = smoothPath(this.world.grid, this.pos, tiles);
    // Si le point cliqué est libre, on s'y arrête exactement.
    if (exact && Math.floor(exact.x) === tile.x && Math.floor(exact.y) === tile.y) {
      if (!circleBlocked(this.world.grid, exact, AVATAR_RADIUS))
        points[points.length - 1] = { ...exact };
    }
    this.waypoints = points;
    this.stuckTime = 0;
    return true;
  }

  /**
   * Demande d'utiliser un objet (interaction ou assise). Si l'objet est à
   * portée, renvoie l'action immédiatement ; sinon le joueur s'y rend.
   */
  requestUse(obj: WorldObject): PendingAction | 'walking' | 'unreachable' {
    const kind: PendingAction['kind'] = obj.seats.length > 0 ? 'sit' : 'use';
    const action: PendingAction = { kind, objectId: obj.id };
    if (kind === 'use' && this.world.distanceToObject(this.pos, obj) <= USE_RANGE) {
      this.standUp();
      this.faceObject(obj);
      return action;
    }
    let target: Vec2 | null;
    if (kind === 'sit') {
      const seat = this.world.freeSeat(obj, this.pos, this.id);
      if (!seat) return 'unreachable';
      const fv = facingVector(seat.facing);
      const front = { x: Math.floor(seat.x + fv.x * 0.8), y: Math.floor(seat.y + fv.y * 0.8) };
      target = this.world.grid.isWalkable(front.x, front.y)
        ? front
        : this.world.approachTile(obj, this.pos);
      if (target && this.isOnTile(target)) {
        return action;
      }
    } else {
      target = this.world.approachTile(obj, this.pos);
    }
    if (!target) return 'unreachable';
    this.standUp();
    if (!this.planPath(target)) return 'unreachable';
    this.pending = action;
    return 'walking';
  }

  private isOnTile(t: Vec2): boolean {
    return Math.floor(this.pos.x) === t.x && Math.floor(this.pos.y) === t.y;
  }

  faceObject(obj: WorldObject): void {
    const cx = Math.max(obj.x, Math.min(this.pos.x, obj.x + obj.w));
    const cy = Math.max(obj.y, Math.min(this.pos.y, obj.y + obj.d));
    this.facing = facingToward(this.pos, { x: cx, y: cy }, this.facing);
  }

  /** S'asseoir sur une place libre de l'objet. */
  sitOn(obj: WorldObject): boolean {
    const seat = this.world.freeSeat(obj, this.pos, this.id);
    if (!seat) return false;
    this.world.occupySeat(seat, this.id);
    this.standPos = { ...this.pos };
    this.seat = seat;
    this.pos = { x: seat.x, y: seat.y };
    this.facing = seat.facing;
    this.waypoints = [];
    this.pending = null;
    return true;
  }

  standUp(): void {
    if (!this.seat) return;
    this.world.releaseSeats(this.id);
    this.seat = null;
    if (this.standPos) this.pos = this.standPos;
    this.standPos = null;
  }

  cancel(): void {
    this.waypoints = [];
    this.pending = null;
  }

  /** Avance d'un pas de simulation. `input` = direction clavier (monde). */
  update(dt: number, input: Vec2): StepResult {
    if (input.x !== 0 || input.y !== 0) {
      this.standUp();
      this.cancel();
      const before = this.pos;
      this.pos = moveWithCollision(this.world.grid, this.pos, {
        x: input.x * WALK_SPEED * dt,
        y: input.y * WALK_SPEED * dt,
      });
      this.facing = facingFromDelta(input.x, input.y, this.facing);
      return { moved: this.pos.x !== before.x || this.pos.y !== before.y, arrived: null };
    }

    const next = this.waypoints[0];
    if (!next) return { moved: false, arrived: null };
    const dx = next.x - this.pos.x;
    const dy = next.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * dt;
    const before = this.pos;
    if (dist <= step) {
      this.pos = moveWithCollision(this.world.grid, this.pos, { x: dx, y: dy });
      this.waypoints.shift();
    } else {
      this.pos = moveWithCollision(this.world.grid, this.pos, {
        x: (dx / dist) * step,
        y: (dy / dist) * step,
      });
    }
    if (dist > 1e-4) this.facing = facingFromDelta(dx, dy, this.facing);
    const progressed = Math.hypot(this.pos.x - before.x, this.pos.y - before.y);
    this.stuckTime = progressed < step * 0.2 ? this.stuckTime + dt : 0;
    if (this.stuckTime > 0.5) {
      this.cancel();
      return { moved: false, arrived: null };
    }
    if (this.waypoints.length === 0 && this.pending) {
      const action = this.pending;
      this.pending = null;
      return { moved: true, arrived: action };
    }
    return { moved: progressed > 0, arrived: null };
  }
}
