import Phaser from 'phaser';
import { hash2 } from '../core/random';
import { project, TILE_W } from '../core/iso';
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
      .setAlpha(0.22)
      .setDepth(DEPTH_GLOW);
    this.track(haloImg);
    const pool = project(cx, cy, 0);
    const poolImg = this.scene.add
      .image(pool.x, pool.y, glow.key, glow.frame)
      .setDisplaySize(light.radius * TILE_W * 1.6, light.radius * TILE_W * 0.8)
      .setTint(light.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.2)
      .setDepth(DEPTH_LIGHT_POOL);
    this.track(poolImg);
  }

  private addLabel(obj: WorldObject): void {
    const p = project(obj.x + obj.w / 2, obj.y + obj.d / 2, 1.5);
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
