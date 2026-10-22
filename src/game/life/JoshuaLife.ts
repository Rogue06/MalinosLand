import type Phaser from 'phaser';
import { JOSHUA_MOODS, type JoshuaMood } from '../../content/joshua';
import { project, type Vec2 } from '../../core/iso';
import { rotatePoint } from '../../core/rotation';
import type { WorldModel, WorldObject } from '../../world/WorldModel';
import { drawAntenna } from '../art/objects';
import type { TextureFactory } from '../textures';
import type { WorldRenderer } from '../WorldRenderer';

/** Hauteur du dessus de la tête de Joshua (voir le dessin `robot`). */
const HEAD_TOP = 1.05;
/** Bases des deux antennes dans le repère du robot, et leur inclinaison au repos (radians). */
const ANTENNAS = [
  { x: 0.33, y: 0.5, lean: -0.16, phase: 0 },
  { x: 0.67, y: 0.5, lean: 0.16, phase: 1.7 },
] as const;
const MOOD_SECONDS = 45;

interface Antenna {
  img: Phaser.GameObjects.Image;
  lean: number;
  phase: number;
}

/**
 * Joshua vivant : ses antennes, dessinées à part, bougent (doucement au repos, davantage quand
 * on s'approche, beaucoup quand il parle) et leur bout prend la couleur de son humeur, qui
 * change de temps en temps. Tout est local au navigateur (aucun message réseau).
 */
export class JoshuaLife {
  private antennas: Antenna[] = [];
  private time = 0;
  private talkUntil = 0;
  private moodIndex = Math.floor(Math.random() * JOSHUA_MOODS.length);
  private moodTimer = MOOD_SECONDS;
  private robot: WorldObject | null;

  constructor(
    scene: Phaser.Scene,
    world: WorldModel,
    renderer: WorldRenderer,
    tex: TextureFactory,
    private readonly opts: { animate: boolean },
  ) {
    // Seul le Joshua « sans antennes dessinées » (variante 1) reçoit des antennes animées.
    this.robot = world.objects.find((o) => o.type === 'robot' && o.variant === 1) ?? null;
    const robot = this.robot;
    if (!robot) return;
    const info = tex.part('joshua-antenna', drawAntenna);
    const depth = (renderer.objects.get(robot.id)?.depth ?? 0) + 0.3;
    for (const a of ANTENNAS) {
      const p = rotatePoint(a.x, a.y, robot.rot, 1, 1);
      const s = project(robot.x + p.x, robot.y + p.y, HEAD_TOP);
      const img = scene.add
        .image(s.x, s.y, info.key, info.frame)
        .setOrigin(info.originX, info.originY)
        .setScale(info.scale)
        .setRotation(a.lean)
        .setDepth(depth);
      this.antennas.push({ img, lean: a.lean, phase: a.phase });
    }
    this.applyMood();
  }

  /** Humeur du moment (couleur des antennes et ton de la première réplique). */
  get mood(): JoshuaMood {
    return JOSHUA_MOODS[this.moodIndex]!;
  }

  /** Joshua parle : les antennes s'agitent quelques secondes. */
  talk(seconds = 4): void {
    this.talkUntil = this.time + seconds;
  }

  update(deltaMs: number, player: Vec2): void {
    if (!this.robot || this.antennas.length === 0) return;
    const dt = Math.min(deltaMs, 100) / 1000;
    this.time += dt;
    this.moodTimer -= dt;
    if (this.moodTimer <= 0) {
      this.moodTimer = MOOD_SECONDS + Math.random() * 30;
      this.moodIndex = (this.moodIndex + 1 + Math.floor(Math.random() * 3)) % JOSHUA_MOODS.length;
      this.applyMood();
    }
    if (!this.opts.animate) return;
    const near = Math.hypot(this.robot.x + 0.5 - player.x, this.robot.y + 0.5 - player.y) < 2.6;
    const talking = this.time < this.talkUntil;
    const amp = talking ? 0.28 : near ? 0.14 : 0.05;
    const speed = talking ? 10 : near ? 4.5 : 1.4;
    for (const a of this.antennas)
      a.img.setRotation(a.lean + Math.sin(this.time * speed + a.phase) * amp);
  }

  destroy(): void {
    for (const a of this.antennas) a.img.destroy();
    this.antennas = [];
  }

  private applyMood(): void {
    for (const a of this.antennas) a.img.setTint(this.mood.color);
  }
}
