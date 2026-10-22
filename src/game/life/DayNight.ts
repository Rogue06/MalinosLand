import Phaser from 'phaser';
import { parisSky, softenTint, type Sky } from '../../core/daylight';
import { project } from '../../core/iso';
import { setNightSounds } from '../../services/audio';
import type { WorldModel } from '../../world/WorldModel';
import type { TextureFactory } from '../textures';
import type { WorldRenderer } from '../WorldRenderer';
import type { AmbientLife } from './AmbientLife';

/**
 * Jour et nuit à l'heure de Paris (lot C, DEC-028), sans effet lourd :
 * - un seul rectangle teinté en « multiplication » sur tout l'écran (rosé à l'aube, orangé au
 *   coucher, bleu nuit la nuit), plus doux à l'intérieur où les lampes sont allumées ;
 * - les halos des lampes, réverbères et du feu de camp plus vifs le soir ;
 * - des étoiles dans le ciel autour du monde, des lucioles près des arbres de la forêt et du
 *   parc ; les oiseaux dorment, les grillons chantent.
 * Tout est calculé dans le navigateur, sans message réseau. Le ciel est recalculé toutes les
 * 20 secondes (il change lentement).
 */
export interface DayNightOptions {
  /** Qualité « basse » : ni étoiles ni lucioles, seulement la teinte. */
  effects: boolean;
  reducedMotion: boolean;
  /** Le joueur préfère qu'il fasse toujours jour. */
  alwaysDay(): boolean;
}

/** Au-dessus du monde et des oiseaux, sous les halos de lumière et les noms. */
const DEPTH_SHADE = 9.5e6;
const DEPTH_STARS = -1e9;
const DEPTH_FIREFLY = 9.6e6;
const REFRESH_S = 20;
const FIREFLY_ZONES = ['forest', 'park', 'orchard'];
/** Intérieur : la nuit est bien moins sombre (lampes allumées, ambiance feutrée). */
const INDOOR_SOFTEN = 0.6;

interface Firefly {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  phase: number;
  speed: number;
}

export class DayNight {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private stars: Phaser.GameObjects.Graphics[] = [];
  private fireflies: Firefly[] = [];
  private timer = 0;
  private time = 0;
  private indoor = false;
  private alwaysDay: boolean;
  /** Heure imposée (outil de débogage, captures) ; null = heure réelle de Paris. */
  private forced: number | null = null;
  private current: Sky & { hours: number };

  constructor(
    private readonly scene: Phaser.Scene,
    world: WorldModel,
    private readonly renderer: WorldRenderer,
    private readonly life: AmbientLife | null,
    tex: TextureFactory,
    private readonly opts: DayNightOptions,
  ) {
    this.alwaysDay = opts.alwaysDay();
    this.shade = scene.add
      .rectangle(0, 0, 40000, 40000, 0xffffff)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(DEPTH_SHADE)
      .setVisible(false);
    if (opts.effects) {
      this.makeStars();
      this.makeFireflies(world, tex);
    }
    this.current = this.compute();
    this.apply();
  }

  /** Ciel affiché en ce moment (pour l'horloge de l'interface). */
  get sky(): Sky & { hours: number } {
    return this.current;
  }

  /** Impose une heure (0–24) pour les captures et les tests ; null revient à l'heure réelle. */
  forceHour(hours: number | null): void {
    this.forced = hours;
    this.refresh();
  }

  /** Le joueur entre ou sort d'un bâtiment, ou change le réglage « toujours de jour ». */
  setContext(indoor: boolean, alwaysDay: boolean): void {
    if (indoor === this.indoor && alwaysDay === this.alwaysDay) return;
    this.indoor = indoor;
    this.alwaysDay = alwaysDay;
    this.refresh();
  }

  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    this.time += dt;
    this.timer += dt;
    if (this.timer >= REFRESH_S) this.refresh();
    if (this.current.night > 0.05 && !this.opts.reducedMotion) this.animateFireflies();
  }

  destroy(): void {
    setNightSounds(false);
    this.shade.destroy();
    for (const s of this.stars) {
      this.scene.tweens.killTweensOf(s);
      s.destroy();
    }
    for (const f of this.fireflies) f.img.destroy();
    this.stars = [];
    this.fireflies = [];
  }

  private refresh(): void {
    this.timer = 0;
    this.current = this.compute();
    this.apply();
  }

  private compute(): Sky & { hours: number } {
    const now = new Date();
    const sky = parisSky(now, this.alwaysDay);
    if (this.forced === null) return { ...sky, hours: sky.clock.hours };
    // Heure imposée : même calcul, en décalant l'horloge de Paris.
    const shift = (this.forced - sky.clock.hours) * 3_600_000;
    const forced = parisSky(new Date(now.getTime() + shift), this.alwaysDay);
    return { ...forced, hours: forced.clock.hours };
  }

  private apply(): void {
    const sky = this.current;
    const tint = this.indoor ? softenTint(sky.tint, INDOOR_SOFTEN) : sky.tint;
    this.shade.setFillStyle(tint).setVisible(tint !== 0xffffff);
    this.renderer.setLightLevel(sky.lights);
    this.life?.setNight(sky.night);
    setNightSounds(sky.night > 0.6);
    for (const s of this.stars) s.setVisible(sky.night > 0.05).setAlpha(sky.night);
    for (const f of this.fireflies) f.img.setVisible(!this.indoor && sky.night > 0.05);
  }

  /** Étoiles fixes dans le ciel sombre autour du monde, sur deux calques qui scintillent. */
  private makeStars(): void {
    const cam = this.scene.cameras.main;
    const w = Math.max(cam.width, 800) * 3;
    const h = Math.max(cam.height, 600) * 3;
    for (let layer = 0; layer < 2; layer++) {
      const g = this.scene.add.graphics().setScrollFactor(0.15).setDepth(DEPTH_STARS);
      for (let i = 0; i < 160; i++) {
        const big = Math.random() < 0.15;
        g.fillStyle(big ? 0xfff4d6 : 0xe6eeff, 1);
        g.fillCircle(Math.random() * w - w / 3, Math.random() * h - h / 3, big ? 2.2 : 1.3);
      }
      g.setVisible(false);
      this.stars.push(g);
      if (!this.opts.reducedMotion)
        this.scene.tweens.add({
          targets: g,
          alpha: { from: 1, to: 0.45 },
          duration: 2200 + layer * 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
    }
  }

  /** Lucioles : petites lueurs vert-jaune qui flottent près des arbres, la nuit seulement. */
  private makeFireflies(world: WorldModel, tex: TextureFactory): void {
    const glow = tex.glow();
    const inZone = (x: number, y: number) =>
      world.map.zones.some(
        (z) =>
          FIREFLY_ZONES.includes(z.id) &&
          x >= z.rect.x &&
          y >= z.rect.y &&
          x < z.rect.x + z.rect.w &&
          y < z.rect.y + z.rect.h,
      );
    const trees = world.objects.filter(
      (o) => (o.type === 'tree' || o.type === 'bush') && inZone(o.x, o.y),
    );
    for (let i = 0; i < Math.min(18, trees.length * 2); i++) {
      const t = trees[i % trees.length]!;
      const img = this.scene.add
        .image(0, 0, glow.key, glow.frame)
        .setDisplaySize(18, 18)
        .setTint(0xd9ff6b)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH_FIREFLY)
        .setVisible(false);
      this.fireflies.push({
        img,
        x: t.x + 0.5 + (Math.random() - 0.5) * 2.4,
        y: t.y + 0.5 + (Math.random() - 0.5) * 2.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.5,
      });
    }
    this.animateFireflies();
  }

  private animateFireflies(): void {
    // Appelée une première fois depuis le constructeur, avant le premier calcul du ciel.
    const night = (this.current as Sky | undefined)?.night ?? 0;
    for (const f of this.fireflies) {
      const a = this.time * f.speed + f.phase;
      const p = project(
        f.x + Math.sin(a) * 0.5,
        f.y + Math.cos(a * 0.8) * 0.5,
        0.5 + Math.sin(a * 1.7) * 0.25,
      );
      // Elles s'allument et s'éteignent doucement, chacune à son rythme.
      const blink = 0.35 + 0.65 * Math.max(0, Math.sin(a * 2.3));
      f.img.setPosition(p.x, p.y).setAlpha(night * blink);
    }
  }
}
