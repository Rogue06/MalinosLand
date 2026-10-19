import { Z_PX, TILE_H, TILE_W, type Vec2, type Vec3 } from '../../core/iso';
import { rotatePoint, type Rotation } from '../../core/rotation';
import { darken, lighten, rgba } from './color';

/** Faces d'une boîte. Seules top, py (+y) et px (+x) sont visibles à l'écran. */
export type Face = 'top' | 'py' | 'px' | 'ny' | 'nx';

export interface Decal {
  face: Face;
  /** Rectangle dans le repère de la face, en fractions [0,1] (u horizontal, v vertical). */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  color: string;
}

export interface BoxSpec {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  /** Couleurs explicites (sinon dérivées de color). */
  top?: string;
  side?: string;
  decals?: Decal[];
  /** Contour sombre léger (true par défaut). */
  outline?: boolean;
}

interface Item {
  min: Vec3;
  max: Vec3;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export interface RenderedSprite {
  canvas: HTMLCanvasElement;
  /** Position (px du canvas) du point monde (0,0,0) local. */
  anchorX: number;
  anchorY: number;
  scale: number;
}

const HW = TILE_W / 2;
const HH = TILE_H / 2;

function proj(p: Vec3): Vec2 {
  return { x: (p.x - p.y) * HW, y: (p.x + p.y) * HH - p.z * Z_PX };
}

/**
 * Construit une image isométrique à partir de primitives 3D simples
 * (boîtes, polygones, textes plaqués sur une face). Tout est dessiné dans le
 * repère canonique de l'objet puis tourné selon `rot`.
 */
export class IsoBuilder {
  private items: Item[] = [];
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  constructor(
    private readonly rot: Rotation = 0,
    /** Empreinte canonique servant de pivot de rotation. */
    private readonly fw = 1,
    private readonly fd = 1,
  ) {}

  /** Point canonique → point local tourné. */
  private tr(p: Vec3): Vec3 {
    const r = rotatePoint(p.x, p.y, this.rot, this.fw, this.fd);
    return { x: r.x, y: r.y, z: p.z };
  }

  private extend(points: Vec2[]): void {
    for (const p of points) {
      this.minX = Math.min(this.minX, p.x);
      this.minY = Math.min(this.minY, p.y);
      this.maxX = Math.max(this.maxX, p.x);
      this.maxY = Math.max(this.maxY, p.y);
    }
  }

  private rotFace(face: Face): Face {
    if (face === 'top') return 'top';
    const order: Face[] = ['py', 'px', 'ny', 'nx'];
    return order[(order.indexOf(face) + this.rot) % 4]!;
  }

  box(spec: BoxSpec): this {
    const a = this.tr({ x: spec.x, y: spec.y, z: spec.z });
    const b = this.tr({ x: spec.x + spec.w, y: spec.y + spec.d, z: spec.z + spec.h });
    const min = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: spec.z };
    const max = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: spec.z + spec.h };
    const P = (x: number, y: number, z: number) => proj({ x, y, z });
    const top = [
      P(min.x, min.y, max.z),
      P(max.x, min.y, max.z),
      P(max.x, max.y, max.z),
      P(min.x, max.y, max.z),
    ];
    const left = [
      P(min.x, max.y, min.z),
      P(max.x, max.y, min.z),
      P(max.x, max.y, max.z),
      P(min.x, max.y, max.z),
    ];
    const right = [
      P(max.x, min.y, min.z),
      P(max.x, max.y, min.z),
      P(max.x, max.y, max.z),
      P(max.x, min.y, max.z),
    ];
    this.extend([...top, ...left, ...right]);

    const base = spec.color;
    const cTop = spec.top ?? lighten(base, 0.14);
    const cLeft = spec.side ?? base;
    const cRight = darken(spec.side ?? base, 0.2);
    const outline = spec.outline !== false;
    const decals = (spec.decals ?? [])
      .map((dc) => this.decalPolygon(spec, dc))
      .filter((p) => p !== null);

    this.items.push({
      min,
      max,
      draw: (ctx) => {
        if (spec.h > 0) {
          fillPoly(ctx, left, cLeft, outline ? darken(cLeft, 0.35) : null);
          fillPoly(ctx, right, cRight, outline ? darken(cRight, 0.35) : null);
        }
        fillPoly(ctx, top, cTop, outline ? darken(cTop, 0.3) : null);
        for (const d of decals) fillPoly(ctx, d.points, d.color, null);
      },
    });
    return this;
  }

  /** Calcule le polygone écran d'un décor collé sur une face d'une boîte. */
  private decalPolygon(s: BoxSpec, dc: Decal): { points: Vec2[]; color: string } | null {
    const face = this.rotFace(dc.face);
    if (face === 'ny' || face === 'nx') return null;
    const eps = 0.002;
    const corners: Vec3[] = [];
    const uv: Array<[number, number]> = [
      [dc.u0, dc.v0],
      [dc.u1, dc.v0],
      [dc.u1, dc.v1],
      [dc.u0, dc.v1],
    ];
    for (const [u, v] of uv) {
      switch (dc.face) {
        case 'top':
          corners.push({ x: s.x + u * s.w, y: s.y + v * s.d, z: s.z + s.h + eps });
          break;
        case 'py':
          corners.push({ x: s.x + u * s.w, y: s.y + s.d + eps, z: s.z + v * s.h });
          break;
        case 'ny':
          corners.push({ x: s.x + s.w - u * s.w, y: s.y - eps, z: s.z + v * s.h });
          break;
        case 'px':
          corners.push({ x: s.x + s.w + eps, y: s.y + s.d - u * s.d, z: s.z + v * s.h });
          break;
        case 'nx':
          corners.push({ x: s.x - eps, y: s.y + u * s.d, z: s.z + v * s.h });
          break;
      }
    }
    return { points: corners.map((c) => proj(this.tr(c))), color: dc.color };
  }

  /** Polygone libre (coordonnées canoniques). Ignoré s'il fait face à l'arrière. */
  poly(points: Vec3[], fill: string, opts: { stroke?: string; facing?: Face } = {}): this {
    if (opts.facing) {
      const f = this.rotFace(opts.facing);
      if (f === 'nx' || f === 'ny') return this;
    }
    const local = points.map((p) => this.tr(p));
    const screen = local.map(proj);
    this.extend(screen);
    this.items.push({
      min: {
        x: Math.min(...local.map((p) => p.x)),
        y: Math.min(...local.map((p) => p.y)),
        z: Math.min(...local.map((p) => p.z)),
      },
      max: {
        x: Math.max(...local.map((p) => p.x)),
        y: Math.max(...local.map((p) => p.y)),
        z: Math.max(...local.map((p) => p.z)),
      },
      draw: (ctx) => fillPoly(ctx, screen, fill, opts.stroke ?? null),
    });
    return this;
  }

  /** Disque horizontal (plateau de table, eau, ombre…). */
  disc(cx: number, cy: number, z: number, r: number, fill: string, stroke?: string): this {
    const pts: Vec3[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z });
    }
    return this.poly(pts, fill, stroke ? { stroke } : {});
  }

  /** Cylindre vertical (pieds de table, pots, poteaux). */
  cylinder(cx: number, cy: number, z: number, r: number, h: number, color: string): this {
    const c = this.tr({ x: cx, y: cy, z });
    const segs = 16;
    const top: Vec2[] = [];
    const bottom: Vec2[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      top.push(proj({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, z: z + h }));
      bottom.push(proj({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, z }));
    }
    this.extend([...top, ...bottom]);
    const pc = proj({ x: c.x, y: c.y, z });
    const rx = r * HW * Math.SQRT2;
    const ry = r * HH * Math.SQRT2;
    const hp = h * Z_PX;
    this.items.push({
      min: { x: c.x - r, y: c.y - r, z },
      max: { x: c.x + r, y: c.y + r, z: z + h },
      draw: (ctx) => {
        const grad = ctx.createLinearGradient(pc.x - rx, 0, pc.x + rx, 0);
        grad.addColorStop(0, lighten(color, 0.08));
        grad.addColorStop(0.45, color);
        grad.addColorStop(1, darken(color, 0.3));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(pc.x, pc.y, rx, ry, 0, 0, Math.PI);
        ctx.lineTo(pc.x - rx, pc.y - hp);
        ctx.ellipse(pc.x, pc.y - hp, rx, ry, 0, Math.PI, 0, true);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = lighten(color, 0.16);
        ctx.beginPath();
        ctx.ellipse(pc.x, pc.y - hp, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    });
    return this;
  }

  /**
   * Texte plaqué sur une face verticale ou horizontale, en perspective.
   * `anchor` est le centre du texte (coordonnées canoniques), `size` en px.
   */
  text(
    anchor: Vec3,
    face: 'py' | 'px' | 'top',
    text: string,
    opts: {
      size: number;
      color: string;
      weight?: number;
      font?: string;
      fit?: number;
      glow?: string;
    },
  ): this {
    const f = this.rotFace(face);
    if (f === 'nx' || f === 'ny') return this;
    const uDir: Vec3 = face === 'px' ? { x: 0, y: -1, z: 0 } : { x: 1, y: 0, z: 0 };
    const vDir: Vec3 = face === 'top' ? { x: 0, y: -1, z: 0 } : { x: 0, y: 0, z: 1 };
    const o = proj(this.tr(anchor));
    const pu = proj(this.tr({ x: anchor.x + uDir.x, y: anchor.y + uDir.y, z: anchor.z + uDir.z }));
    const pv = proj(this.tr({ x: anchor.x + vDir.x, y: anchor.y + vDir.y, z: anchor.z + vDir.z }));
    const ux = pu.x - o.x;
    const uy = pu.y - o.y;
    const vx = pv.x - o.x;
    const vy = pv.y - o.y;
    const lu = Math.hypot(ux, uy);
    const lv = Math.hypot(vx, vy);
    // Largeur maximale le long de la face (px) si `fit` est donné (en tuiles).
    const maxWidth = opts.fit !== undefined ? opts.fit * lu : undefined;
    const r = (maxWidth ?? text.length * opts.size * 0.7) / 2 + opts.size;
    this.extend([
      { x: o.x - r, y: o.y - r },
      { x: o.x + r, y: o.y + r },
    ]);
    const p = this.tr(anchor);
    this.items.push({
      min: { x: p.x, y: p.y, z: p.z },
      max: { x: p.x, y: p.y, z: p.z },
      draw: (ctx) => {
        ctx.save();
        // Repère de la face : 1 unité = 1 px le long de u et de -v.
        ctx.transform(ux / lu, uy / lu, -vx / lv, -vy / lv, o.x, o.y);
        ctx.font = `${opts.weight ?? 700} ${opts.size}px ${opts.font ?? 'system-ui, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = opts.color;
        if (opts.glow) {
          ctx.shadowColor = opts.glow;
          ctx.shadowBlur = opts.size * 0.8;
        }
        if (maxWidth !== undefined) ctx.fillText(text, 0, 0, maxWidth);
        else ctx.fillText(text, 0, 0);
        ctx.restore();
      },
    });
    return this;
  }

  /** Dessin 2D libre positionné sur un point 3D (lueurs, émojis…), toujours au premier plan. */
  overlay(
    anchor: Vec3,
    bounds: { w: number; h: number },
    fn: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
  ): this {
    const p = this.tr(anchor);
    const o = proj(p);
    this.extend([
      { x: o.x - bounds.w / 2, y: o.y - bounds.h / 2 },
      { x: o.x + bounds.w / 2, y: o.y + bounds.h / 2 },
    ]);
    this.items.push({
      min: { x: 99, y: 99, z: 99 },
      max: { x: 99, y: 99, z: 99 },
      draw: (ctx) => fn(ctx, o.x, o.y),
    });
    return this;
  }

  /** Rend l'image. `scale` = résolution de la texture (2 = net en zoom ×2). */
  render(scale: number, pad = 2): RenderedSprite {
    if (!Number.isFinite(this.minX)) {
      this.minX = this.minY = 0;
      this.maxX = this.maxY = 1;
    }
    const width = Math.ceil((this.maxX - this.minX) * scale) + pad * 2;
    const height = Math.ceil((this.maxY - this.minY) * scale) + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const ox = -this.minX * scale + pad;
    const oy = -this.minY * scale + pad;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.6;
    for (const item of sortItems(this.items)) item.draw(ctx);
    return { canvas, anchorX: ox, anchorY: oy, scale };
  }
}

function fillPoly(
  ctx: CanvasRenderingContext2D,
  pts: Vec2[],
  fill: string,
  stroke: string | null,
): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = rgba(stroke, 0.55);
    ctx.stroke();
  }
}

/**
 * Tri du peintre entre boîtes alignées sur les axes : A est devant B si A est
 * entièrement du côté +x, +y ou +z de B (axes testés dans cet ordre).
 * Tri topologique, avec repli sur la somme des centres en cas de cycle.
 */
export function inFront(a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }): boolean {
  const e = 1e-6;
  if (a.min.x >= b.max.x - e) return true;
  if (b.min.x >= a.max.x - e) return false;
  if (a.min.y >= b.max.y - e) return true;
  if (b.min.y >= a.max.y - e) return false;
  if (a.min.z >= b.max.z - e) return true;
  if (b.min.z >= a.max.z - e) return false;
  const ca = a.min.x + a.max.x + a.min.y + a.max.y + a.min.z + a.max.z;
  const cb = b.min.x + b.max.x + b.min.y + b.max.y + b.min.z + b.max.z;
  return ca > cb;
}

/** Rectangle occupé à l'écran par une boîte (projection de ses coins extrêmes). */
function screenRect(it: Item): [number, number, number, number] {
  const { min, max } = it;
  return [
    (min.x - max.y) * HW,
    (max.x - min.y) * HW,
    (min.x + min.y) * HH - max.z * Z_PX,
    (max.x + max.y) * HH - min.z * Z_PX,
  ];
}

function sortItems(items: Item[]): Item[] {
  const n = items.length;
  const after: number[][] = Array.from({ length: n }, () => []);
  const indegree = new Array<number>(n).fill(0);
  const rects = items.map(screenRect);
  const e = 1e-3;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Deux boîtes qui ne se recouvrent pas à l'écran n'ont pas d'ordre à respecter : ne pas
      // créer de contrainte inutile évite des cycles (et donc des pièces dessinées par-dessus
      // ce qui devrait les cacher, comme un écouteur vu à travers la tête).
      const [a, b] = [rects[i]!, rects[j]!];
      if (a[1] <= b[0] + e || b[1] <= a[0] + e || a[3] <= b[2] + e || b[3] <= a[2] + e) continue;
      if (inFront(items[i]!, items[j]!)) {
        after[j]!.push(i);
        indegree[i]!++;
      } else {
        after[i]!.push(j);
        indegree[j]!++;
      }
    }
  }
  const result: Item[] = [];
  const done = new Array<boolean>(n).fill(false);
  while (result.length < n) {
    let next = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && indegree[i] === 0) {
        next = i;
        break;
      }
    }
    if (next === -1) next = done.findIndex((d) => !d);
    done[next] = true;
    result.push(items[next]!);
    for (const k of after[next]!) indegree[k]!--;
  }
  return result;
}
