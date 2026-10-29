import Phaser from 'phaser';
import { hash2 } from '../core/random';
import { project, TILE_W } from '../core/iso';
import { rotatePoint } from '../core/rotation';
import type { WorldModel, WorldObject } from '../world/WorldModel';
import { staticDepth, type DepthBox } from '../world/depth';
import type { FloorType, WallType } from '../world/types';
import { WALL_E, WALL_N, WALL_S, WALL_W } from './art/walls';
import { DEPTH_OVERLAY, createBubble } from './entities/AvatarView';
import type { TextureFactory, TextureInfo } from './textures';

export const DEPTH_FLOOR = -1e7;
const DEPTH_FLAT = -6e6;
const DEPTH_SHADOW = -5e6;
const DEPTH_LIGHT_POOL = -4e6;
const DEPTH_GLOW = 1e7;
/** Opacité des halos de lumière en plein jour. */
const HALO_ALPHA = 0.22;
/** Couleurs des ampoules d'une borne d'arcade : rose, jaune, cyan, violet. */
const MARQUEE_COLORS = [0xff4fa3, 0xffd34d, 0x3ff0ff, 0xb46bff];
/** Pas du chenillard des ampoules (ms). */
const MARQUEE_STEP = 230;
const POOL_ALPHA = 0.2;

export interface RenderedObject {
  obj: WorldObject;
  image: Phaser.GameObjects.Image;
  /** Dossier d'un siège, dessiné juste au-dessus du reste (profondeur + 0,5). */
  front?: Phaser.GameObjects.Image;
  depth: number;
}

/** Écart de profondeur du dossier : un personnage assis de dos se place entre les deux. */
export const BACKREST_DEPTH = 0.5;

export interface RenderOptions {
  effects: boolean;
  reducedMotion: boolean;
  /** Qualité haute : sols en pleine résolution. */
  hiDpi: boolean;
}

type Plan = () => void;
const FLOOR_CHUNK = 8;

/**
 * Construit l'affichage statique d'une salle à partir du WorldModel :
 * sols, murs, décors muraux, objets, ombres et lumières.
 */
export class WorldRenderer {
  readonly objects = new Map<string, RenderedObject>();
  readonly depthBoxes: DepthBox[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  /** Halos des lampes (et leur tache au sol), plus vifs la nuit. */
  private lights: Array<{ halo: Phaser.GameObjects.Image; pool: Phaser.GameObjects.Image }> = [];
  /** Tout ce qui a été affiché pour la salle (pour pouvoir la reconstruire). */
  private created: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldModel,
    private readonly tex: TextureFactory,
    private readonly opts: RenderOptions,
  ) {}

  build(): void {
    this.buildFloors();
    // Passe 1 : génération des textures (regroupées en atlas). Passe 2 : images.
    this.tex.beginBatch();
    const plans = [...this.planWalls(), ...this.planObjects()];
    this.tex.commitBatch();
    for (const plan of plans) plan();
  }

  /**
   * Retire tout l'affichage de la salle : utilisé pour la reconstruire quand la décoration d'un
   * logement change (les textures restent en cache).
   */
  destroy(): void {
    for (const go of this.created) {
      this.scene.tweens.killTweensOf(go);
      go.destroy();
    }
    this.created = [];
    this.objects.clear();
    this.depthBoxes.length = 0;
    this.labels = [];
    this.lights = [];
  }

  /** Niveau des lampes : 0 en plein jour (halos discrets), 1 la nuit (bien allumées). */
  setLightLevel(level: number): void {
    for (const l of this.lights) {
      l.halo.setAlpha(HALO_ALPHA + 0.4 * level);
      l.pool.setAlpha(POOL_ALPHA + 0.32 * level);
    }
  }

  private track<T extends Phaser.GameObjects.GameObject>(go: T): T {
    this.created.push(go);
    return go;
  }

  private place(info: TextureInfo, x: number, y: number, z = 0): Phaser.GameObjects.Image {
    const p = project(x, y, z);
    return this.track(
      this.scene.add
        .image(p.x, p.y, info.key, info.frame)
        .setOrigin(info.originX, info.originY)
        .setScale(info.scale),
    );
  }

  private buildFloors(): void {
    const { world } = this;
    const size = FLOOR_CHUNK;
    const scale = this.tex.texScale >= 2 ? (this.opts.hiDpi ? 2 : 1.5) : 1;
    for (let cy = 0; cy < world.height; cy += size) {
      for (let cx = 0; cx < world.width; cx += size) {
        const tiles: Array<{ x: number; y: number; type: FloorType; variant: number }> = [];
        for (let y = cy; y < Math.min(cy + size, world.height); y++) {
          for (let x = cx; x < Math.min(cx + size, world.width); x++) {
            const floor = world.tileAt(x, y).floor;
            if (!floor) continue;
            tiles.push({
              x,
              y,
              type: floor,
              variant: floor === 'hall' ? (x + y) % 2 : hash2(x, y) % 4,
            });
          }
        }
        if (tiles.length === 0) continue;
        const info = this.tex.floorChunk(
          `floor:${world.map.id}:${cx}:${cy}`,
          tiles,
          cx,
          cy,
          size,
          scale,
        );
        this.place(info, cx, cy).setDepth(DEPTH_FLOOR + cy * world.width + cx);
      }
    }
  }

  private connects(x: number, y: number): boolean {
    if (this.world.tileAt(x, y).wall) return true;
    return this.world.objects.some(
      (o) => o.entry.connectsWalls && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.d,
    );
  }

  private planWalls(): Plan[] {
    const { world } = this;
    const plans: Plan[] = [];
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const wall = world.tileAt(x, y).wall;
        if (!wall) continue;
        let mask = 0;
        if (this.connects(x, y - 1)) mask |= WALL_N;
        if (this.connects(x + 1, y)) mask |= WALL_E;
        if (this.connects(x, y + 1)) mask |= WALL_S;
        if (this.connects(x - 1, y)) mask |= WALL_W;
        const info = this.tex.wall(wall, mask);
        plans.push(() => this.place(info, x, y).setDepth(staticDepth(x, y, 1, 1)));
      }
    }
    for (const decor of world.map.wallDecor) {
      const wall = world.tileAt(decor.x, decor.y).wall as WallType;
      const info = this.tex.decor(decor.type, decor.side, decor.variant ?? 0, wall);
      plans.push(() =>
        this.place(info, decor.x, decor.y).setDepth(staticDepth(decor.x, decor.y, 1, 1) + 1),
      );
    }
    return plans;
  }

  private planObjects(): Plan[] {
    const glow = this.opts.effects ? this.tex.glow() : null;
    return this.world.objects.map((obj, i) => {
      const flat = obj.entry.flat === true;
      const depth = flat ? DEPTH_FLAT + i : staticDepth(obj.x, obj.y, obj.w, obj.d);
      // Sièges : le dossier est une image à part, pour qu'un personnage assis de dos passe
      // devant le siège mais derrière son dossier.
      const layers =
        !flat && obj.seats.length > 0
          ? this.tex.objectLayers(obj.type, obj.rot, obj.variant)
          : null;
      const info = layers?.base ?? this.tex.object(obj.type, obj.rot, obj.variant);
      const shadow = this.opts.effects && !flat ? this.tex.shadow(obj.w, obj.d) : null;
      return () => {
        const image = this.place(info, obj.x, obj.y).setDepth(depth);
        const front = layers
          ? this.place(layers.front, obj.x, obj.y).setDepth(depth + BACKREST_DEPTH)
          : undefined;
        this.objects.set(obj.id, { obj, image, depth, ...(front ? { front } : {}) });
        if (!flat) this.depthBoxes.push({ x: obj.x, y: obj.y, w: obj.w, d: obj.d, depth });
        if (obj.interaction || obj.seats.length > 0) {
          for (const img of front ? [image, front] : [image]) {
            img.setInteractive({ pixelPerfect: true, alphaTolerance: 40, useHandCursor: true });
            img.setData('objectId', obj.id);
          }
        }
        if (shadow) this.place(shadow, obj.x, obj.y).setDepth(DEPTH_SHADOW).setAlpha(0.7);
        const light = obj.entry.light;
        if (light && glow) this.addLight(glow, obj, light);
        if (obj.entry.marquee && glow) this.addMarquee(glow, obj, obj.entry.marquee);
        if (obj.entry.hover && !this.opts.reducedMotion) {
          this.scene.tweens.add({
            targets: image,
            y: image.y - 4,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
        if (obj.label) this.addLabel(obj);
      };
    });
  }

  private addLight(
    glow: TextureInfo,
    obj: WorldObject,
    light: NonNullable<WorldObject['entry']['light']>,
  ): void {
    const cx = obj.x + obj.w / 2 + (light.dx ?? 0);
    const cy = obj.y + obj.d / 2 + (light.dy ?? 0);
    const halo = project(cx, cy, light.z);
    const haloImg = this.scene.add
      .image(halo.x, halo.y, glow.key, glow.frame)
      .setDisplaySize(light.radius * TILE_W * 0.9, light.radius * TILE_W * 0.9)
      .setTint(light.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(HALO_ALPHA)
      .setDepth(DEPTH_GLOW);
    this.track(haloImg);
    const pool = project(cx, cy, 0);
    const poolImg = this.scene.add
      .image(pool.x, pool.y, glow.key, glow.frame)
      .setDisplaySize(light.radius * TILE_W * 1.6, light.radius * TILE_W * 0.8)
      .setTint(light.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(POOL_ALPHA)
      .setDepth(DEPTH_LIGHT_POOL);
    this.track(poolImg);
    this.lights.push({ halo: haloImg, pool: poolImg });
  }

  /**
   * Ampoules de chapiteau (borne d'arcade des années 80) : quatre couleurs qui s'allument et
   * s'éteignent l'une après l'autre, en chenillard. Immobiles si l'on réduit les animations.
   */
  private addMarquee(
    glow: TextureInfo,
    obj: WorldObject,
    bulbs: NonNullable<WorldObject['entry']['marquee']>,
  ): void {
    const [fw, fd] = obj.entry.footprint;
    bulbs.forEach(([u, v, z], i) => {
      const r = rotatePoint(u, v, obj.rot, fw, fd);
      const p = project(obj.x + r.x, obj.y + r.y, z);
      const color = MARQUEE_COLORS[i % MARQUEE_COLORS.length]!;
      const image = (size: number, blend: Phaser.BlendModes, alpha: number) =>
        this.track(
          this.scene.add
            .image(p.x, p.y, glow.key, glow.frame)
            .setDisplaySize(TILE_W * size, TILE_W * size)
            .setTint(color)
            .setBlendMode(blend)
            .setAlpha(alpha)
            .setDepth(DEPTH_GLOW),
        );
      // Un halo coloré, et l'ampoule elle-même : un point net et vif.
      const halo = image(0.3, Phaser.BlendModes.ADD, 0.9);
      const core = image(0.09, Phaser.BlendModes.NORMAL, 1);
      if (this.opts.reducedMotion) return;
      // Clignotement franc, allumé ou éteint, décalé d'une couleur à l'autre : à tout instant,
      // à peu près la moitié des ampoules brillent et la lumière semble courir.
      this.scene.tweens.add({
        targets: [halo, core],
        alpha: 0.08,
        duration: 70,
        hold: MARQUEE_STEP * 2,
        repeatDelay: MARQUEE_STEP * 2,
        delay: (i % MARQUEE_COLORS.length) * MARQUEE_STEP,
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private addLabel(obj: WorldObject): void {
    const p = project(obj.x + obj.w / 2, obj.y + obj.d / 2, obj.entry.labelZ ?? 1.5);
    const label = this.scene.add
      .text(p.x, p.y, obj.label ?? '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#13213b',
        backgroundColor: 'rgba(95,227,208,0.92)',
        padding: { x: 5, y: 2 },
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY);
    this.labels.push(this.track(label));
  }

  setLabelsVisible(visible: boolean): void {
    for (const l of this.labels) l.setVisible(visible);
  }

  /**
   * Change l'image d'un objet déjà affiché (affiche d'un stand du musée). La zone cliquable suit
   * la nouvelle image : on redimensionne celle qui existe (le test au pixel lit toujours l'image
   * actuelle). Surtout pas removeInteractive() puis setInteractive() : Phaser retire l'objet de
   * la liste des cliquables à l'image suivante, et le stand ne réagissait plus au clic.
   */
  setObjectTexture(id: string, info: TextureInfo): void {
    const r = this.objects.get(id);
    if (!r) return;
    r.image.setTexture(info.key, info.frame).setOrigin(info.originX, info.originY);
    r.image.setScale(info.scale);
    const area = r.image.input?.hitArea as { width: number; height: number } | undefined;
    if (area) {
      area.width = r.image.width;
      area.height = r.image.height;
    }
  }

  /** Bulle temporaire au-dessus d'un objet (ex. Joshua qui salue). */
  objectBubble(id: string, text: string, durationMs = 5000): void {
    const r = this.objects.get(id);
    if (!r) return;
    const p = project(r.obj.x + r.obj.w / 2, r.obj.y + r.obj.d / 2, 1.5);
    const bubble = createBubble(this.scene, text).setPosition(p.x, p.y - 22);
    this.scene.time.delayedCall(durationMs, () => bubble.destroy());
  }

  /** Surbrillance au survol d'un objet utilisable. */
  highlight(id: string, on: boolean): void {
    const r = this.objects.get(id);
    if (!r) return;
    for (const img of r.front ? [r.image, r.front] : [r.image]) {
      if (on) img.setTint(0x2e2e2e).setTintMode(Phaser.TintModes.ADD);
      else img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
  }
}
