import Phaser from 'phaser';
import { appearanceKey, type AvatarAppearance } from '../content/avatars';
import { CATALOG } from '../content/catalog';
import { TILE_H, TILE_W } from '../core/iso';
import type { Rotation } from '../core/rotation';
import type { FloorType, WallType } from '../world/types';
import { frameName, renderAvatarSheet, AVATAR_FACINGS, AVATAR_POSES } from './art/characters';
import { drawFloor } from './art/floors';
import { IsoBuilder, type RenderedSprite } from './art/iso3d';
import { DECOR_ART, OBJECT_ART } from './art/objects';
import { drawWall, wallFaceY } from './art/walls';

export interface TextureInfo {
  key: string;
  /** Cadre dans un atlas (undefined = texture autonome). */
  frame?: string;
  originX: number;
  originY: number;
  /** Échelle à appliquer au sprite (textures dessinées en haute résolution). */
  scale: number;
}

/**
 * Génère à la demande les textures procédurales et les enregistre dans Phaser.
 * Chaque texture n'est créée qu'une fois puis réutilisée (cache par clé).
 */
export class TextureFactory {
  private infos = new Map<string, TextureInfo>();
  private batch: Array<{ name: string; canvas: HTMLCanvasElement; info: TextureInfo }> | null =
    null;
  private atlasCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly texScale: number,
  ) {}

  /**
   * Mode lot : les textures demandées sont regroupées dans des atlas lors de
   * `commitBatch()`. Moins de textures = moins d'appels de dessin, ce qui
   * compte beaucoup sur les GPU intégrés modestes.
   */
  beginBatch(): void {
    this.batch = [];
  }

  commitBatch(pageSize = 2048): void {
    const items = this.batch ?? [];
    this.batch = null;
    const pages = packShelves(
      items.map((i) => ({ w: i.canvas.width + 2, h: i.canvas.height + 2 })),
      pageSize,
    );
    pages.forEach((page) => {
      const key = `atlas:${this.atlasCount++}`;
      const canvas = document.createElement('canvas');
      canvas.width = page.width;
      canvas.height = page.height;
      const ctx = canvas.getContext('2d')!;
      for (const p of page.placements) ctx.drawImage(items[p.index]!.canvas, p.x + 1, p.y + 1);
      const tex = this.scene.textures.addCanvas(key, canvas);
      if (!tex) throw new Error('Impossible de créer un atlas');
      for (const p of page.placements) {
        const item = items[p.index]!;
        tex.add(item.name, 0, p.x + 1, p.y + 1, item.canvas.width, item.canvas.height);
        item.info.key = key;
        item.info.frame = item.name;
      }
    });
  }

  private register(key: string, r: RenderedSprite): TextureInfo {
    const existing = this.infos.get(key);
    if (existing) return existing;
    const info: TextureInfo = {
      key,
      originX: r.anchorX / r.canvas.width,
      originY: r.anchorY / r.canvas.height,
      scale: 1 / r.scale,
    };
    if (this.batch) this.batch.push({ name: key, canvas: r.canvas, info });
    else if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, r.canvas);
    this.infos.set(key, info);
    return info;
  }

  object(type: string, rot: Rotation, variant: number): TextureInfo {
    const key = `obj:${type}:${rot}:${variant}`;
    const cached = this.infos.get(key);
    if (cached) return cached;
    const entry = CATALOG[type];
    const art = OBJECT_ART[type];
    if (!entry || !art) throw new Error(`Aucun dessin pour l’objet « ${type} »`);
    const b = new IsoBuilder(rot, entry.footprint[0], entry.footprint[1]);
    art(b, variant);
    return this.register(key, b.render(this.texScale));
  }

  /**
   * Siège en deux images de même cadrage : `base` (tout sauf le dossier) et `front` (le
   * dossier). null si l'objet n'a pas de dossier séparé.
   */
  objectLayers(
    type: string,
    rot: Rotation,
    variant: number,
  ): { base: TextureInfo; front: TextureInfo } | null {
    const entry = CATALOG[type];
    const art = OBJECT_ART[type];
    if (!entry || !art) return null;
    const b = new IsoBuilder(rot, entry.footprint[0], entry.footprint[1]);
    art(b, variant);
    if (!b.hasLayer('front')) return null;
    const key = `obj:${type}:${rot}:${variant}`;
    return {
      base:
        this.infos.get(`${key}:base`) ??
        this.register(`${key}:base`, b.render(this.texScale, 2, 'base')),
      front:
        this.infos.get(`${key}:front`) ??
        this.register(`${key}:front`, b.render(this.texScale, 2, 'front')),
    };
  }

  wall(type: WallType, mask: number): TextureInfo {
    const key = `wall:${type}:${mask}`;
    return this.infos.get(key) ?? this.register(key, drawWall(type, mask).render(this.texScale));
  }

  decor(type: string, side: 'px' | 'py', variant: number, wall: WallType): TextureInfo {
    const key = `decor:${type}:${side}:${variant}:${wall}`;
    const cached = this.infos.get(key);
    if (cached) return cached;
    const art = DECOR_ART[type];
    if (!art) throw new Error(`Aucun dessin pour le décor « ${type} »`);
    const b = new IsoBuilder(side === 'px' ? 1 : 0, 1, 1);
    art(b, variant, wallFaceY(wall));
    return this.register(key, b.render(this.texScale));
  }

  /**
   * Sols pré-assemblés par blocs de CHUNK × CHUNK tuiles : quelques grandes
   * images au lieu d'une image par tuile.
   */
  floorChunk(
    key: string,
    tiles: Array<{ x: number; y: number; type: FloorType; variant: number }>,
    x0: number,
    y0: number,
    size: number,
    scale: number,
  ): TextureInfo {
    const pad = 4;
    const hw = (TILE_W / 2) * scale;
    const hh = (TILE_H / 2) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * 2 * hw + pad * 2);
    canvas.height = Math.ceil(size * 2 * hh + pad * 2);
    const ctx = canvas.getContext('2d')!;
    // Origine du bloc : sommet haut de la tuile (x0, y0), décalé de `size` tuiles en x écran.
    const ox = pad + size * hw;
    const oy = pad;
    const cache = new Map<string, HTMLCanvasElement>();
    for (const t of tiles) {
      const ck = `${t.type}:${t.variant}`;
      let tc = cache.get(ck);
      if (!tc) cache.set(ck, (tc = drawFloor(t.type, t.variant, scale)));
      const lx = t.x - x0;
      const ly = t.y - y0;
      // Le canvas de tuile a son sommet haut en (2 + hw, 2).
      ctx.drawImage(tc, ox + (lx - ly) * hw - (2 + hw), oy + (lx + ly) * hh - 2);
    }
    this.scene.textures.addCanvas(key, canvas);
    const info: TextureInfo = {
      key,
      originX: ox / canvas.width,
      originY: oy / canvas.height,
      scale: 1 / scale,
    };
    this.infos.set(key, info);
    return info;
  }

  /** Feuille de sprites d'un avatar : 4 orientations × 4 poses. */
  avatar(look: AvatarAppearance): TextureInfo {
    const key = `avatar:${appearanceKey(look)}`;
    const cached = this.infos.get(key);
    if (cached) return cached;
    const sheet = renderAvatarSheet(look, this.texScale);
    const tex = this.scene.textures.addCanvas(key, sheet.canvas);
    if (!tex) throw new Error('Impossible de créer la texture d’avatar');
    for (const f of sheet.frames) tex.add(f.name, 0, f.x, f.y, sheet.frameW, sheet.frameH);
    const info: TextureInfo = {
      key,
      originX: sheet.anchorX / sheet.frameW,
      originY: sheet.anchorY / sheet.frameH,
      scale: 1 / this.texScale,
    };
    this.infos.set(key, info);
    return info;
  }

  /** Halo lumineux radial (mélange additif). */
  glow(): TextureInfo {
    const key = 'fx:glow';
    const cached = this.infos.get(key);
    if (cached) return cached;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return this.register(key, { canvas, anchorX: size / 2, anchorY: size / 2, scale: 1 });
  }

  /** Ombre douce au sol pour une empreinte w × d. */
  shadow(w: number, d: number): TextureInfo {
    const key = `fx:shadow:${w}x${d}`;
    const cached = this.infos.get(key);
    if (cached) return cached;
    const s = this.texScale;
    const pad = 12 * s;
    const width = (w + d) * (TILE_W / 2) * s + pad * 2;
    const height = (w + d) * (TILE_H / 2) * s + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext('2d')!;
    // Repère : origine au coin (0,0) de l'empreinte, axes isométriques.
    const ox = pad + d * (TILE_W / 2) * s;
    const oy = pad;
    ctx.setTransform(
      (TILE_W / 2) * s,
      (TILE_H / 2) * s,
      -(TILE_W / 2) * s,
      (TILE_H / 2) * s,
      ox,
      oy,
    );
    ctx.translate(w / 2, d / 2);
    ctx.scale(w / 2 + 0.18, d / 2 + 0.18);
    const g = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1);
    g.addColorStop(0, 'rgba(20,16,30,0.55)');
    g.addColorStop(0.7, 'rgba(20,16,30,0.25)');
    g.addColorStop(1, 'rgba(20,16,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    return this.register(key, { canvas, anchorX: ox, anchorY: oy, scale: s });
  }
}

export const AVATAR_FRAME = frameName;
export { AVATAR_FACINGS, AVATAR_POSES };

interface ShelfPage {
  width: number;
  height: number;
  placements: Array<{ index: number; x: number; y: number }>;
}

/** Rangement en étagères (simple et suffisant pour quelques centaines d'images). */
export function packShelves(sizes: Array<{ w: number; h: number }>, pageSize: number): ShelfPage[] {
  const order = sizes.map((s, index) => ({ ...s, index })).sort((a, b) => b.h - a.h);
  const pages: ShelfPage[] = [];
  let page: ShelfPage | null = null;
  let x = 0;
  let y = 0;
  let shelfH = 0;
  for (const item of order) {
    const w = Math.min(item.w, pageSize);
    const h = Math.min(item.h, pageSize);
    if (page && x + w > pageSize) {
      x = 0;
      y += shelfH;
      shelfH = 0;
    }
    if (!page || y + h > pageSize) {
      page = { width: 0, height: 0, placements: [] };
      pages.push(page);
      x = 0;
      y = 0;
      shelfH = 0;
    }
    page.placements.push({ index: item.index, x, y });
    x += w;
    shelfH = Math.max(shelfH, h);
    page.width = Math.max(page.width, x);
    page.height = Math.max(page.height, y + shelfH);
  }
  return pages;
}
