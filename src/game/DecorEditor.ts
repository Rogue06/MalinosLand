import Phaser from 'phaser';
import { FURNITURE_COLORS } from '../content/furniture';
import { HOME_RULES, MAPS } from '../content/world';
import { project, unproject, type Vec2 } from '../core/iso';
import type { Rotation } from '../core/rotation';
import { decorEditorStore, type DecorAction } from '../state';
import {
  PLACE_PROBLEMS,
  checkPlacement,
  decorIndex,
  footprint,
  itemAt,
  splitHomeMap,
  type DecorItem,
  type PlaceProblem,
} from '../world/decor';
import type { MapFile } from '../world/types';
import { DEPTH_OVERLAY } from './entities/AvatarView';
import type { TextureFactory } from './textures';

/** Ce dont l'éditeur a besoin de la scène. */
export interface DecorHost {
  scene: Phaser.Scene;
  tex: TextureFactory;
  /** Reconstruit le logement avec ces meubles (déjà vérifiés). */
  apply(items: DecorItem[]): void;
  /** Positions des personnes présentes (dont soi). */
  people(): Vec2[];
  /** Met en valeur un meuble posé (rang), ou aucun. */
  highlight(index: number | null): void;
  /** Enregistre en base et prévient les visiteurs. */
  save(items: DecorItem[]): Promise<void>;
  /** L'éditeur se ferme (enregistré ou annulé). */
  close(): void;
  /** Écran tactile : conseils sans raccourcis clavier. */
  touch: boolean;
}

interface Held {
  t: string;
  r: Rotation;
  v: number;
  /** Meuble déjà posé que l'on déplace (pour le remettre en place si on annule). */
  origin: { item: DecorItem; index: number } | null;
}

const OK_COLOR = 0x5fe3d0;
const BAD_COLOR = 0xff6b6b;
const SELECTED_COLOR = 0xffc857;

/**
 * Éditeur de décoration du logement : prendre un meuble du catalogue, le poser, le tourner, le
 * déplacer, changer sa couleur ou le ranger. Tout se fait sur un brouillon ; rien n'est envoyé
 * avant « Enregistrer ». Les règles de placement sont celles de src/world/decor.ts.
 */
export class DecorEditor {
  private draft: DecorItem[];
  private readonly original: DecorItem[];
  private readonly base: MapFile = MAPS.studio!;
  private held: Held | null = null;
  private selected = -1;
  /** Case visée (coin de l'empreinte du meuble en main). */
  private tile: Vec2 | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  private readonly outline: Phaser.GameObjects.Graphics;
  private saving = false;
  private dirty = false;
  private message: string | null = null;

  constructor(
    private readonly host: DecorHost,
    items: DecorItem[],
  ) {
    this.original = items.map((i) => ({ ...i }));
    this.draft = items.map((i) => ({ ...i }));
    this.outline = host.scene.add.graphics().setDepth(-4.4e6);
    this.message = 'Choisis un meuble en bas, ou touche un meuble posé pour le modifier.';
    this.publish();
  }

  // ---------------------------------------------------------------- Commandes

  command(action: DecorAction, type?: string): void {
    if (this.saving) return;
    switch (action) {
      case 'pick':
        if (!type || !HOME_RULES.allowed.has(type)) return;
        this.dropHeld();
        if (this.draft.length >= HOME_RULES.max) return this.say(PLACE_PROBLEMS.full);
        this.select(-1);
        this.held = { t: type, r: 0, v: 0, origin: null };
        this.say(
          this.host.touch
            ? 'Touche le sol pour viser, puis touche encore pour le poser.'
            : 'Clique sur le sol pour le poser · R pour le tourner · Échap pour annuler.',
        );
        break;
      case 'rotate':
        return this.rotate();
      case 'color':
        return this.recolor();
      case 'move':
        return this.pickUpSelected();
      case 'remove':
        return this.removeSelected();
      case 'deselect':
        this.dropHeld();
        this.select(-1);
        break;
      case 'reset':
        this.dropHeld();
        this.select(-1);
        this.draft = splitHomeMap(this.base, HOME_RULES).furniture;
        this.changed();
        this.say('Studio d’origine remis en place (pas encore enregistré).');
        return;
      case 'save':
        void this.save();
        return;
      case 'cancel':
        this.dropHeld();
        this.select(-1);
        if (this.dirty) this.host.apply(this.original);
        this.host.close();
        return;
      default:
        return;
    }
    this.renderGhost();
    this.publish();
  }

  /** Touches du clavier (hors saisie de texte). Renvoie true si la touche est utilisée. */
  key(code: string): boolean {
    switch (code) {
      case 'KeyR':
        this.rotate();
        return true;
      case 'KeyC':
        this.recolor();
        return true;
      case 'KeyM':
        this.pickUpSelected();
        return true;
      case 'Delete':
      case 'Backspace':
        this.removeSelected();
        return true;
      case 'Escape':
        if (!this.held && this.selected < 0) return false;
        this.command('deselect');
        return true;
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------- Souris / doigt

  pointerMove(worldX: number, worldY: number): void {
    if (!this.held) return;
    const next = this.anchor(worldX, worldY);
    if (this.tile && next.x === this.tile.x && next.y === this.tile.y) return;
    this.tile = next;
    this.renderGhost();
  }

  /** `overIds` : objets sous le pointeur ; `touch` : au doigt, un premier appui vise seulement. */
  pointerDown(worldX: number, worldY: number, overIds: string[], touch: boolean): void {
    if (this.saving) return;
    if (this.held) {
      const next = this.anchor(worldX, worldY);
      const moved = !this.tile || next.x !== this.tile.x || next.y !== this.tile.y;
      this.tile = next;
      if (touch && moved) {
        this.renderGhost();
        this.say('Touche encore au même endroit pour le poser.');
        this.publish();
        return;
      }
      this.placeHeld();
      return;
    }
    const fromOver = overIds.map(decorIndex).find((i) => i >= 0);
    const p = unproject(worldX, worldY);
    const index =
      fromOver ?? itemAt(this.draft, Math.floor(p.x), Math.floor(p.y), HOME_RULES.catalog);
    this.select(index);
    if (index >= 0) this.say(this.toolsHint(''));
    this.publish();
  }

  destroy(): void {
    this.ghost?.destroy();
    this.outline.destroy();
    this.host.highlight(null);
    decorEditorStore.set({ ...decorEditorStore.get(), active: false, held: null, selected: null });
  }

  // ---------------------------------------------------------------- Actions

  private placeHeld(): void {
    const held = this.held;
    if (!held || !this.tile) return;
    const item: DecorItem = { t: held.t, x: this.tile.x, y: this.tile.y, r: held.r, v: held.v };
    const problem = this.check(item, this.draft);
    if (problem) {
      this.say(PLACE_PROBLEMS[problem]);
      this.renderGhost();
      this.publish();
      return;
    }
    // Un meuble déplacé reprend son rang ; un nouveau va à la fin.
    const index = held.origin ? Math.min(held.origin.index, this.draft.length) : this.draft.length;
    this.draft.splice(index, 0, item);
    this.held = null;
    this.tile = null;
    this.changed();
    this.select(index);
    this.say(this.toolsHint('Posé ! '));
    this.renderGhost();
    this.publish();
  }

  private rotate(): void {
    if (this.held) {
      this.held.r = ((this.held.r + 1) % 4) as Rotation;
      this.renderGhost();
      return;
    }
    const current = this.draft[this.selected];
    if (!current) return;
    const others = this.draft.filter((_, i) => i !== this.selected);
    const turned = { ...current, r: ((current.r + 1) % 4) as Rotation };
    // Un meuble long qui tourne peut gêner : on essaie aussi de le décaler d'une case.
    const candidates = [turned, { ...turned, x: turned.x - 1 }, { ...turned, y: turned.y - 1 }];
    const ok = candidates.find((c) => this.check(c, others) === null);
    if (!ok) {
      this.say('Pas la place de le tourner ici : déplace-le d’abord (M).');
      this.publish();
      return;
    }
    this.draft[this.selected] = ok;
    this.changed();
    this.publish();
  }

  private recolor(): void {
    const colorsOf = (t: string) => FURNITURE_COLORS[t] ?? 1;
    if (this.held) {
      this.held.v = (this.held.v + 1) % colorsOf(this.held.t);
      this.renderGhost();
      return;
    }
    const current = this.draft[this.selected];
    if (!current || colorsOf(current.t) < 2) return;
    this.draft[this.selected] = { ...current, v: (current.v + 1) % colorsOf(current.t) };
    this.changed();
    this.publish();
  }

  private pickUpSelected(): void {
    const current = this.draft[this.selected];
    if (!current) return;
    const index = this.selected;
    this.draft.splice(index, 1);
    this.select(-1);
    this.held = { t: current.t, r: current.r, v: current.v, origin: { item: current, index } };
    this.tile = { x: current.x, y: current.y };
    this.changed();
    this.say(
      this.host.touch
        ? 'Touche l’endroit où le poser, puis touche encore pour confirmer.'
        : 'Clique là où tu veux le poser · R pour le tourner · Échap pour le remettre.',
    );
    this.renderGhost();
    this.publish();
  }

  private removeSelected(): void {
    if (this.selected < 0) return;
    this.draft.splice(this.selected, 1);
    this.select(-1);
    this.changed();
    this.say('Rangé.');
    this.publish();
  }

  /** Lâche le meuble en main ; s'il venait d'être soulevé, il reprend sa place. */
  private dropHeld(): void {
    const held = this.held;
    if (!held) return;
    this.held = null;
    this.tile = null;
    if (held.origin) {
      this.draft.splice(Math.min(held.origin.index, this.draft.length), 0, held.origin.item);
      this.changed();
    }
    this.renderGhost();
  }

  private async save(): Promise<void> {
    this.dropHeld();
    this.select(-1);
    this.saving = true;
    this.say('Enregistrement…');
    this.publish();
    try {
      await this.host.save(this.draft);
      this.saving = false;
      this.host.close();
    } catch (e) {
      this.saving = false;
      this.say(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.');
      this.publish();
    }
  }

  // ---------------------------------------------------------------- Aides

  private check(item: DecorItem, items: DecorItem[]): PlaceProblem {
    return checkPlacement(this.base, items, item, HOME_RULES, this.host.people());
  }

  /** Coin de l'empreinte pour que le meuble soit centré sous le pointeur. */
  private anchor(worldX: number, worldY: number): Vec2 {
    const p = unproject(worldX, worldY);
    const held = this.held;
    const fp = held
      ? footprint({ t: held.t, x: 0, y: 0, r: held.r, v: 0 }, HOME_RULES.catalog)
      : { w: 1, d: 1 };
    return {
      x: Math.floor(p.x) - Math.floor((fp.w - 1) / 2),
      y: Math.floor(p.y) - Math.floor((fp.d - 1) / 2),
    };
  }

  private select(index: number): void {
    this.selected = index >= 0 && index < this.draft.length ? index : -1;
    this.host.highlight(this.selected >= 0 ? this.selected : null);
    this.renderGhost();
  }

  private changed(): void {
    this.dirty = true;
    this.host.apply(this.draft);
    // La salle a été reconstruite : on remet la surbrillance.
    this.host.highlight(this.selected >= 0 ? this.selected : null);
    this.renderGhost();
  }

  private toolsHint(prefix: string): string {
    return (
      prefix +
      (this.host.touch
        ? 'Les boutons ci-dessous le tournent, changent sa couleur, le déplacent ou le rangent.'
        : 'R : tourner · C : couleur · M : déplacer · Suppr : ranger · Échap : terminer.')
    );
  }

  private say(text: string): void {
    this.message = text;
  }

  private renderGhost(): void {
    const g = this.outline;
    g.clear();
    const held = this.held;
    if (!held || !this.tile) {
      this.ghost?.setVisible(false);
      // Meuble sélectionné : contour jaune au sol.
      const sel = this.draft[this.selected];
      if (sel) this.drawFootprint(sel, SELECTED_COLOR, 0.18);
      return;
    }
    const item: DecorItem = { t: held.t, x: this.tile.x, y: this.tile.y, r: held.r, v: held.v };
    const ok = this.check(item, this.draft) === null;
    const info = this.host.tex.object(held.t, held.r, held.v);
    const p = project(item.x, item.y);
    if (!this.ghost) this.ghost = this.host.scene.add.image(0, 0, info.key, info.frame);
    this.ghost
      .setTexture(info.key, info.frame)
      .setOrigin(info.originX, info.originY)
      .setScale(info.scale)
      .setPosition(p.x, p.y)
      .setAlpha(0.82)
      .setDepth(DEPTH_OVERLAY - 10)
      .setVisible(true);
    if (ok) this.ghost.clearTint();
    else this.ghost.setTint(BAD_COLOR);
    // Empreinte au sol : verte si l'on peut poser, rouge sinon.
    this.drawFootprint(item, ok ? OK_COLOR : BAD_COLOR, 0.28);
  }

  private drawFootprint(item: DecorItem, color: number, alpha: number): void {
    const g = this.outline;
    const fp = footprint(item, HOME_RULES.catalog);
    const corners = [
      project(fp.x, fp.y),
      project(fp.x + fp.w, fp.y),
      project(fp.x + fp.w, fp.y + fp.d),
      project(fp.x, fp.y + fp.d),
    ];
    g.fillStyle(color, alpha);
    g.lineStyle(2, color, 0.95);
    g.beginPath();
    g.moveTo(corners[0]!.x, corners[0]!.y);
    for (const c of corners.slice(1)) g.lineTo(c.x, c.y);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  private publish(): void {
    const sel = this.draft[this.selected];
    decorEditorStore.set({
      active: true,
      held: this.held?.t ?? null,
      selected: sel ? { type: sel.t, colors: FURNITURE_COLORS[sel.t] ?? 1 } : null,
      count: this.draft.length + (this.held?.origin ? 1 : 0),
      max: HOME_RULES.max,
      dirty: this.dirty,
      saving: this.saving,
      message: this.message,
    });
  }
}
