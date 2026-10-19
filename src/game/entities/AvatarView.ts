import Phaser from 'phaser';
import type { AvatarAppearance } from '../../content/avatars';
import { project, Z_PX, type Facing } from '../../core/iso';
import { SIT_HEIGHT, frameName, type AvatarPose } from '../art/characters';
import type { TextureFactory } from '../textures';

/** Calques d'affichage au-dessus du monde. */
export const DEPTH_OVERLAY = 2e7;

const WALK_FRAMES: AvatarPose[] = ['walkA', 'idle', 'walkB', 'idle'];
const HEAD_OFFSET = 60;

/**
 * Représentation graphique d'un avatar (joueur local ou distant) :
 * sprite, ombre, nom et bulles de discussion. Aucune logique de déplacement.
 */
export class AvatarView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly label: Phaser.GameObjects.Text;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private walkTime = 0;

  x = 0;
  y = 0;
  facing: Facing = 'py';
  moving = false;
  /** Hauteur d'assise si l'avatar est assis, sinon null. */
  seatHeight: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: TextureFactory,
    look: AvatarAppearance,
    name: string,
    isSelf: boolean,
  ) {
    const info = textures.avatar(look);
    this.shadow = scene.add.ellipse(0, 0, 26, 12, 0x140f1e, 0.28);
    this.sprite = scene.add.sprite(0, 0, info.key, frameName('py', 'idle'));
    this.sprite.setOrigin(info.originX, info.originY).setScale(info.scale);
    this.label = scene.add
      .text(0, 0, name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: isSelf ? '#ffffff' : '#e8fffb',
        backgroundColor: isSelf ? 'rgba(34,181,166,0.85)' : 'rgba(20,26,43,0.78)',
        padding: { x: 5, y: 2 },
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY);
  }

  setLook(look: AvatarAppearance, name: string): void {
    const info = this.textures.avatar(look);
    this.sprite.setTexture(info.key, this.sprite.frame.name);
    this.sprite.setOrigin(info.originX, info.originY);
    this.label.setText(name);
  }

  setNameVisible(visible: boolean): void {
    this.label.setVisible(visible);
  }

  /** Met à jour cadre, position écran et profondeur. */
  update(dtMs: number, depth: number): void {
    let pose: AvatarPose = 'idle';
    if (this.seatHeight !== null) pose = 'sit';
    else if (this.moving) {
      this.walkTime += dtMs;
      pose = WALK_FRAMES[Math.floor(this.walkTime / 110) % WALK_FRAMES.length]!;
    } else this.walkTime = 0;
    this.sprite.setFrame(frameName(this.facing, pose));

    const p = project(this.x, this.y);
    const lift = this.seatHeight !== null ? (this.seatHeight - SIT_HEIGHT) * Z_PX : 0;
    const sitDrop = this.seatHeight !== null ? 10 : 0;
    this.sprite.setPosition(p.x, p.y - lift).setDepth(depth);
    this.shadow
      .setPosition(p.x, p.y)
      .setDepth(depth - 0.5)
      .setVisible(this.seatHeight === null);
    this.label.setPosition(p.x, p.y - HEAD_OFFSET - lift + sitDrop);
    this.bubble?.setPosition(p.x, p.y - HEAD_OFFSET - 20 - lift + sitDrop);
  }

  /** Affiche une bulle au-dessus de la tête. Le texte est rendu tel quel (jamais interprété). */
  say(text: string, durationMs = 6000): void {
    this.clearBubble();
    this.bubble = createBubble(this.scene, text);
    this.bubbleTimer = this.scene.time.delayedCall(durationMs, () => this.clearBubble());
  }

  private clearBubble(): void {
    this.bubbleTimer?.remove(false);
    this.bubbleTimer = null;
    this.bubble?.destroy();
    this.bubble = null;
  }

  destroy(): void {
    this.clearBubble();
    this.sprite.destroy();
    this.shadow.destroy();
    this.label.destroy();
  }
}

/** Bulle de discussion (texte brut, jamais interprété comme du HTML). */
export function createBubble(scene: Phaser.Scene, text: string): Phaser.GameObjects.Container {
  const t = scene.add
    .text(0, 0, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: Array.from(text).length <= 2 ? '22px' : '12px',
      color: '#1f2740',
      wordWrap: { width: 170, useAdvancedWrap: true },
      align: 'center',
      resolution: 2,
    })
    .setOrigin(0.5, 1);
  const pad = 7;
  const w = t.width + pad * 2;
  const h = t.height + pad * 2;
  const bg = scene.add.graphics();
  bg.fillStyle(0xffffff, 0.96);
  bg.fillRoundedRect(-w / 2, -h, w, h, 9);
  bg.fillTriangle(-6, 0, 6, 0, 0, 7);
  bg.lineStyle(1, 0x1f2740, 0.15);
  bg.strokeRoundedRect(-w / 2, -h, w, h, 9);
  t.setPosition(0, -pad);
  return scene.add.container(0, 0, [bg, t]).setDepth(DEPTH_OVERLAY + 1);
}
