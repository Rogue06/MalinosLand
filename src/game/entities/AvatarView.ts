import Phaser from 'phaser';
import type { AvatarAppearance } from '../../content/avatars';
import { GOLD_TITLE, nameWithBadge } from '../../content/roles';
import type { ChatScope, Role } from '../../multiplayer/protocol';
import { bubbleDuration, bubbleText, isEmojiOnly } from '../../core/bubble';
import { settingsStore } from '../../services/settings';
import { project, Z_PX, type Facing } from '../../core/iso';
import { AVATAR_FACINGS, SIT_HEIGHT, frameName, type AvatarPose } from '../art/characters';
import type { TextureFactory } from '../textures';

/** Calques d'affichage au-dessus du monde. */
export const DEPTH_OVERLAY = 2e7;

const WALK_FRAMES: AvatarPose[] = ['walkA', 'idle', 'walkB', 'idle'];
const HEAD_OFFSET = 60;
/** Statut doré : couleur du pseudo, et reflet bref qui passe toutes les trois secondes. */
const GOLD = '#ffd23f';
const GOLD_GLINT = '#fff6cf';
const GLINT_PERIOD = 3000;
const GLINT_MS = 380;

/**
 * Représentation graphique d'un avatar (joueur local ou distant) :
 * sprite, ombre, nom et bulles de discussion. Aucune logique de déplacement.
 */
export class AvatarView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly label: Phaser.GameObjects.Text;
  /** Titre au-dessus du pseudo (statut doré seulement). */
  private title: Phaser.GameObjects.Text | null = null;
  private role: Role | null = null;
  private glintTime = 0;
  private glinting = false;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private walkTime = 0;

  x = 0;
  y = 0;
  facing: Facing = 'py';
  moving = false;
  /** Hauteur d'assise si l'avatar est assis, sinon null. */
  seatHeight: number | null = null;
  /** Dans la ronde de champignons : l'avatar danse (petits sauts, tour sur lui-même). */
  dancing = false;
  private danceTime = 0;
  private nameVisible = true;
  private baseName: string;
  private away = false;
  /** Joueur masqué par le joueur local : rien n'est affiché. */
  private hidden = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: TextureFactory,
    look: AvatarAppearance,
    name: string,
    private readonly isSelf: boolean,
  ) {
    this.baseName = name;
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
    this.baseName = name;
    this.refreshLabel();
  }

  /** Statut « absent » : nom suivi de 💤 et avatar estompé. */
  setAway(away: boolean): void {
    this.away = away;
    this.refreshLabel();
    this.sprite.setAlpha(away ? 0.55 : 1);
  }

  /**
   * Rôle visible : pseudo doré avec son titre au-dessus, ou badge 🛡️ des modérateurs.
   * Le rôle vient du serveur temps réel (ou de la base pour soi-même), jamais d'un autre joueur.
   */
  setRole(role: Role | null): void {
    if (role === this.role) return;
    this.role = role;
    if (role === 'gold') {
      this.label.setColor(GOLD).setBackgroundColor('rgba(44,30,4,0.9)');
      this.title ??= this.scene.add
        .text(0, 0, GOLD_TITLE, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          fontStyle: 'bold italic',
          color: GOLD,
          stroke: '#2c1e04',
          strokeThickness: 3,
          resolution: 2,
        })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH_OVERLAY);
    } else {
      this.label
        .setColor(this.isSelf ? '#ffffff' : '#e8fffb')
        .setBackgroundColor(this.isSelf ? 'rgba(34,181,166,0.85)' : 'rgba(20,26,43,0.78)');
      this.title?.destroy();
      this.title = null;
    }
    this.glinting = false;
    this.refreshLabel();
    this.setNameVisible(this.nameVisible);
  }

  private refreshLabel(): void {
    const name = nameWithBadge(this.baseName, this.role);
    this.label.setText(this.away ? `${name} 💤` : name);
  }

  setNameVisible(visible: boolean): void {
    this.nameVisible = visible;
    this.label.setVisible(visible && !this.hidden);
    this.title?.setVisible(visible && !this.hidden);
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.sprite.setVisible(!hidden);
    this.label.setVisible(this.nameVisible && !hidden);
    this.title?.setVisible(this.nameVisible && !hidden);
    if (hidden) this.clearBubble();
  }

  /** Met à jour cadre, position écran et profondeur. */
  update(dtMs: number, depth: number): void {
    let pose: AvatarPose = 'idle';
    let facing = this.facing;
    let hop = 0;
    const dancing = this.dancing && !this.moving && this.seatHeight === null;
    if (this.seatHeight !== null) pose = 'sit';
    else if (this.moving) {
      this.walkTime += dtMs;
      pose = WALK_FRAMES[Math.floor(this.walkTime / 110) % WALK_FRAMES.length]!;
    } else this.walkTime = 0;
    if (dancing) {
      // Petits pas, un tour sur soi-même toutes les deux secondes, et de petits sauts.
      this.danceTime += dtMs;
      pose = WALK_FRAMES[Math.floor(this.danceTime / 220) % WALK_FRAMES.length]!;
      facing = AVATAR_FACINGS[Math.floor(this.danceTime / 500) % AVATAR_FACINGS.length]!;
      hop = Math.abs(Math.sin(this.danceTime / 170)) * 6;
    } else this.danceTime = 0;
    this.sprite.setFrame(frameName(facing, pose));

    const p = project(this.x, this.y);
    const lift = this.seatHeight !== null ? (this.seatHeight - SIT_HEIGHT) * Z_PX : 0;
    const sitDrop = this.seatHeight !== null ? 10 : 0;
    this.sprite.setPosition(p.x, p.y - lift - hop).setDepth(depth);
    this.shadow
      .setPosition(p.x, p.y)
      .setDepth(depth - 0.5)
      .setVisible(this.seatHeight === null && !this.hidden);
    const labelY = p.y - HEAD_OFFSET - lift + sitDrop;
    this.label.setPosition(p.x, labelY);
    const titleH = this.title ? this.title.height - 2 : 0;
    this.title?.setPosition(p.x, labelY - this.label.height + 1);
    this.bubble?.setPosition(p.x, labelY - 20 - titleH);
    if (this.role === 'gold') {
      // Reflet : on ne change la couleur qu'au début et à la fin (le texte est redessiné).
      this.glintTime = (this.glintTime + dtMs) % GLINT_PERIOD;
      const glint = this.glintTime < GLINT_MS;
      if (glint !== this.glinting) {
        this.glinting = glint;
        this.label.setColor(glint ? GOLD_GLINT : GOLD);
      }
    }
  }

  /**
   * Affiche une bulle au-dessus de la tête (« Autour » ou « Tout le monde »), le temps de la lire.
   * Le texte est rendu tel quel (jamais interprété).
   */
  say(text: string, scope: ChatScope = 'local', durationMs = bubbleDuration(text)): void {
    this.clearBubble();
    if (this.hidden) return;
    const still = settingsStore.get().reducedMotion;
    const bubble = createBubble(this.scene, text, scope);
    this.bubble = bubble;
    // Elle apparaît d'un petit bond, puis s'efface en douceur.
    if (!still) {
      bubble.setScale(0.6).setAlpha(0);
      this.scene.tweens.add({
        targets: bubble,
        scale: 1,
        alpha: 1,
        duration: 220,
        ease: 'Back.easeOut',
      });
    }
    this.bubbleTimer = this.scene.time.delayedCall(durationMs, () => {
      if (still || this.bubble !== bubble) return this.clearBubble();
      this.scene.tweens.add({
        targets: bubble,
        alpha: 0,
        duration: 350,
        onComplete: () => this.bubble === bubble && this.clearBubble(),
      });
    });
  }

  private clearBubble(): void {
    this.bubbleTimer?.remove(false);
    this.bubbleTimer = null;
    if (this.bubble) this.scene.tweens.killTweensOf(this.bubble);
    this.bubble?.destroy();
    this.bubble = null;
  }

  destroy(): void {
    this.clearBubble();
    this.sprite.destroy();
    this.shadow.destroy();
    this.label.destroy();
    this.title?.destroy();
  }
}

/** Bulle de discussion (texte brut, jamais interprété comme du HTML). */
/** Couleur du liseré : turquoise pour « Autour », violet pour « Tout le monde ». */
const BUBBLE_ACCENT: Record<ChatScope, number> = { local: 0x22b5a6, global: 0x7b6cf6 };

/**
 * Bulle de chat : fond clair, ombre douce, liseré coloré selon la portée du message, petite
 * pointe vers le personnage ; un 🌍 au coin pour « Tout le monde ». Un ou deux émojis seuls
 * s'affichent en grand.
 */
export function createBubble(
  scene: Phaser.Scene,
  raw: string,
  scope: ChatScope = 'local',
): Phaser.GameObjects.Container {
  const text = bubbleText(raw);
  const big = isEmojiOnly(text);
  const t = scene.add
    .text(0, 0, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: big ? '24px' : '13px',
      color: '#1f2740',
      wordWrap: { width: 190, useAdvancedWrap: true },
      align: 'center',
      lineSpacing: 2,
      resolution: 2,
    })
    .setOrigin(0.5, 1);
  const padX = 10;
  const padY = 7;
  const w = Math.max(t.width + padX * 2, 34);
  const h = t.height + padY * 2;
  const r = Math.min(12, h / 2);
  const accent = BUBBLE_ACCENT[scope];
  const bg = scene.add.graphics();
  // Ombre douce sous la bulle.
  bg.fillStyle(0x0d1630, 0.18);
  bg.fillRoundedRect(-w / 2 + 1, -h + 3, w, h, r);
  // Corps, liseré et pointe.
  bg.fillStyle(0xffffff, 0.97);
  bg.fillRoundedRect(-w / 2, -h, w, h, r);
  bg.fillTriangle(-7, -1, 7, -1, 0, 8);
  bg.lineStyle(2, accent, 0.9);
  bg.strokeRoundedRect(-w / 2, -h, w, h, r);
  bg.lineBetween(-7, 0, 0, 8);
  bg.lineBetween(7, 0, 0, 8);
  // Le haut de la pointe, pour cacher le liseré du bas de la bulle à cet endroit.
  bg.fillStyle(0xffffff, 0.97);
  bg.fillRect(-6, -2.5, 12, 3);
  t.setPosition(0, -padY);
  const parts: Phaser.GameObjects.GameObject[] = [bg, t];
  if (scope === 'global') {
    const chip = scene.add.graphics();
    chip.fillStyle(accent, 1);
    chip.fillCircle(-w / 2 + 2, -h + 2, 9);
    const globe = scene.add
      .text(-w / 2 + 2, -h + 2, '🌍', { fontSize: '11px', resolution: 2 })
      .setOrigin(0.5, 0.5);
    parts.push(chip, globe);
  }
  return scene.add.container(0, 0, parts).setDepth(DEPTH_OVERLAY + 1);
}
