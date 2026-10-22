import Phaser from 'phaser';
import { project, TILE_W } from '../../core/iso';
import type { WorldObject } from '../../world/WorldModel';
import type { TextureFactory } from '../textures';

/** Profondeurs : taches au sol sous les avatars, faisceaux au-dessus de tout. */
const DEPTH_SPOTS = -3.9e6;
const DEPTH_BEAMS = 1.05e7;
/** Hauteur d'où tombent les faisceaux (en unités z). */
const BEAM_TOP = 3.2;

/**
 * Lumières de la ronde des Malinos : quand quelqu'un y danse, des projecteurs colorés balaient
 * le cercle et des taches de couleur tournent au sol. Tout est local (chaque joueur voit les
 * danseurs et allume ses propres lumières) : aucun message réseau.
 */
export class DanceFloor {
  private spots: Phaser.GameObjects.Image[] = [];
  private beams: Phaser.GameObjects.Image[] = [];
  private level = 0;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    tex: TextureFactory,
    readonly ringObject: WorldObject,
    private readonly animate: boolean,
  ) {
    const glow = tex.glow();
    const beam = tex.beam();
    for (let i = 0; i < 4; i++)
      this.spots.push(
        scene.add
          .image(0, 0, glow.key, glow.frame)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(TILE_W * 0.9, TILE_W * 0.45)
          .setDepth(DEPTH_SPOTS)
          .setAlpha(0),
      );
    const ring = ringObject;
    const top = project(ring.x + ring.w / 2, ring.y + ring.d / 2, BEAM_TOP);
    for (let i = 0; i < 3; i++)
      this.beams.push(
        scene.add
          .image(top.x + (i - 1) * 26, top.y, beam.key, beam.frame)
          .setOrigin(0.5, 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(46, BEAM_TOP * 32 + 40)
          .setDepth(DEPTH_BEAMS)
          .setAlpha(0),
      );
  }

  /** `active` : au moins une personne danse dans la ronde. */
  update(deltaMs: number, active: boolean): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    this.time += this.animate ? dt : 0;
    // Allumage et extinction en douceur.
    this.level += ((active ? 1 : 0) - this.level) * Math.min(1, dt * 3);
    if (this.level < 0.01 && !active) {
      for (const img of [...this.spots, ...this.beams]) img.setAlpha(0);
      return;
    }
    const cx = this.ringObject.x + this.ringObject.w / 2;
    const cy = this.ringObject.y + this.ringObject.d / 2;
    this.spots.forEach((img, i) => {
      const a = this.time * 1.6 + (i * Math.PI) / 2;
      const p = project(cx + Math.cos(a) * 0.5, cy + Math.sin(a) * 0.5, 0);
      img
        .setPosition(p.x, p.y)
        .setAlpha(0.55 * this.level)
        .setTint(this.color(i * 0.25));
    });
    this.beams.forEach((img, i) => {
      img
        .setRotation(Math.sin(this.time * 1.3 + i * 2.1) * 0.45)
        .setAlpha(0.32 * this.level)
        .setTint(this.color(0.15 + i * 0.33));
    });
  }

  destroy(): void {
    for (const img of [...this.spots, ...this.beams]) img.destroy();
    this.spots = [];
    this.beams = [];
  }

  /** Couleur qui tourne lentement dans l'arc-en-ciel (décalage de 0 à 1). */
  private color(offset: number): number {
    const h = (this.time * 0.12 + offset) % 1;
    return Phaser.Display.Color.HSVToRGB(h, 0.85, 1).color as number;
  }
}
