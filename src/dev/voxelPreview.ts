import Phaser from 'phaser';
import { project } from '../core/iso';
import type { Rotation } from '../core/rotation';
import { AVATAR_FACINGS, frameName, type AvatarPose } from '../game/art/characters';
import { IsoBuilder } from '../game/art/iso3d';
import { PROTOTYPE_APPEARANCE, renderPrototypeAvatarSheet } from '../game/art/prototype/avatar';
import { prototypeTreeArt } from '../game/art/prototype/trees';
import { TextureFactory, type TextureInfo } from '../game/textures';
import './voxelPreview.css';
import { BLENDER_ASSETS, blenderArt } from './blenderArt';

// Comme art-preview.html, cet atelier ne fait pas partie des entrées du build public.
const W = 1120;
const H = 820;
const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
const controls = ['render', 'view', 'rotation', 'pose', 'zoom', 'quality'] as const;
const params = new URLSearchParams(location.search);
for (const id of controls) {
  const input = select(id);
  const value = params.get(id);
  if (value && [...input.options].some((option) => option.value === value)) input.value = value;
}
if (!params.has('pose') && matchMedia('(prefers-reduced-motion: reduce)').matches)
  select('pose').value = 'idle';
const status = document.getElementById('status')!;

class VoxelPreview extends Phaser.Scene {
  private factories!: [TextureFactory, TextureFactory];
  private actors: Array<{
    sprite: Phaser.GameObjects.Sprite;
    homeX: number;
    homeY: number;
    row: number;
  }> = [];
  private rotation: Rotation = 0;
  private zoom = 3;
  private garden = false;
  private rowHeight = 410;

  preload(): void {
    if (select('render').value === 'blender') {
      for (const [name, url] of Object.entries(BLENDER_ASSETS))
        this.load.image(`blender-source:${name}`, url);
    }
  }

  create(): void {
    const scale = Number(select('quality').value);
    this.factories = [
      new TextureFactory(this, scale),
      new TextureFactory(
        this,
        scale,
        select('render').value === 'blender'
          ? blenderArt(this)
          : {
              id: 'voxel-study',
              avatar: renderPrototypeAvatarSheet,
              objects: { tree: prototypeTreeArt },
            },
      ),
    ];
    this.draw();
  }

  private label(x: number, y: number, text: string, color = '#aab9d0', size = 12): void {
    this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${size}px`,
        color,
        resolution: 2,
      })
      .setDepth(100000);
  }

  private place(info: TextureInfo, x: number, y: number, depth = 0): Phaser.GameObjects.Image {
    return this.add
      .image(x, y, info.key, info.frame)
      .setOrigin(info.originX, info.originY)
      .setScale(info.scale * this.zoom)
      .setDepth(depth);
  }

  private ground(tex: TextureFactory, x: number, y: number, grass: boolean): void {
    const info = tex.part(`study-ground:${grass}`, (b) => {
      b.box({
        x: -0.16,
        y: -0.16,
        z: -0.12,
        w: 1.32,
        d: 1.32,
        h: 0.12,
        color: grass ? '#946342' : '#7c7e8a',
        top: grass ? '#8eb653' : '#d8d3c6',
        outline: false,
      });
      if (grass) {
        for (const [gx, gy] of [
          [0.05, 0.75],
          [0.88, 0.22],
          [0.8, 0.86],
        ]) {
          b.box({
            x: gx!,
            y: gy!,
            z: 0,
            w: 0.045,
            d: 0.045,
            h: 0.08,
            color: '#6a9b43',
            outline: false,
          });
          b.box({
            x: gx! + 0.06,
            y: gy!,
            z: 0,
            w: 0.03,
            d: 0.035,
            h: 0.05,
            color: '#79a84e',
            outline: false,
          });
        }
      } else {
        b.box({
          x: 0.49,
          y: -0.16,
          z: 0,
          w: 0.012,
          d: 1.32,
          h: 0.002,
          color: '#b9b5ae',
          outline: false,
        });
        b.box({
          x: -0.16,
          y: 0.49,
          z: 0,
          w: 1.32,
          d: 0.012,
          h: 0.002,
          color: '#b9b5ae',
          outline: false,
        });
      }
    });
    this.place(info, x, y, -100);
    if (select('quality').value !== '1') this.place(tex.shadow(1, 1), x, y, -90).setAlpha(0.4);
  }

  private avatar(tex: TextureFactory, x: number, y: number, row: number): void {
    const info = tex.avatar(PROTOTYPE_APPEARANCE);
    const sprite = this.add
      .sprite(x, y, info.key, frameName(AVATAR_FACINGS[this.rotation]!, 'idle'))
      .setOrigin(info.originX, info.originY)
      .setScale(info.scale * this.zoom)
      .setDepth(100);
    this.actors.push({ sprite, homeX: x, homeY: y, row });
  }

  draw(): void {
    // DisplayList.removeAll(true) retire les objets sans les détruire (ni libérer leurs textes).
    for (const child of [...this.children.list]) child.destroy();
    this.actors = [];
    this.rotation = Number(select('rotation').value) as Rotation;
    this.zoom = Number(select('zoom').value);
    this.garden = select('view').value === 'garden';
    this.rowHeight = this.garden ? 160 + 192 * this.zoom : this.zoom === 4 ? 490 : 410;
    this.scale.resize(W, this.rowHeight * 2);
    for (const row of [0, 1]) {
      const y = row * this.rowHeight;
      const tex = this.factories[row]!;
      this.add
        .rectangle(W / 2, y + this.rowHeight / 2, W, this.rowHeight, row ? 0x182437 : 0x141c2e)
        .setDepth(-200);
      this.label(
        28,
        y + 23,
        row ? 'APRÈS  /  PROTOTYPE' : 'AVANT  /  MAIN',
        row ? '#8ae1c3' : '#bac6d9',
        14,
      );
      this.label(805, y + 26, row ? 'Même moteur · nouveaux dessins' : 'Dessins actuels du dépôt');
      if (this.garden) {
        this.drawGarden(tex, y, row);
      } else {
        const feet = y + this.rowHeight - 48 - 26 * this.zoom;
        for (let col = 0; col < 3; col++) {
          const x = 185 + col * 375;
          const originY = feet - 16 * this.zoom;
          this.ground(tex, x, originY, col > 0);
          if (col === 0) this.avatar(tex, x, feet, row);
          else this.place(tex.object('tree', this.rotation, col === 1 ? 0 : 2), x, originY, 10);
          this.label(
            x - 55,
            y + this.rowHeight - 28,
            ['Avatar', 'Chêne · vert', 'Sakura · rose'][col]!,
          );
        }
      }
    }
    status.textContent = `Rendu Phaser ${this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'} · zoom ×${this.zoom} · textures ×${select('quality').value} · avant et après synchronisés`;
    document.getElementById('gallery')!.dataset.ready = 'true';
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.setAttribute(
      'aria-label',
      'Dessins actuels en haut ; avatar, chêne et sakura du prototype en bas.',
    );
  }

  private drawGarden(tex: TextureFactory, rowY: number, row: number): void {
    // Deux petits jardins identiques : seul le dessin des trois modèles change.
    const ox = W / 2;
    const oy = rowY + 80 + 64 * this.zoom;
    const ground = tex.part('study-garden', (b: IsoBuilder) => {
      for (let x = 0; x < 4; x++)
        for (let y = 0; y < 4; y++)
          b.box({
            x,
            y,
            z: -0.09,
            w: 1,
            d: 1,
            h: 0.09,
            color: '#795b40',
            top: y === 2 ? '#d6cfb9' : (x + y) % 2 ? '#739a59' : '#7ca35d',
            outline: false,
          });
    });
    this.place(ground, ox, oy, -100);
    for (const obj of [
      { type: 'tree', x: 0, y: 0, variant: 0, rot: this.rotation },
      { type: 'tree', x: 2, y: 0, variant: 2, rot: this.rotation },
      { type: 'bench', x: 0, y: 3, variant: 0, rot: 0 as Rotation },
      { type: 'flowerbed', x: 2, y: 3, variant: 1, rot: 0 as Rotation },
    ]) {
      const p = project(obj.x, obj.y);
      if (select('quality').value !== '1')
        this.place(
          tex.shadow(obj.type === 'tree' ? 1 : 2, 1),
          ox + p.x * this.zoom,
          oy + p.y * this.zoom,
          -90,
        ).setAlpha(0.4);
      this.place(
        tex.object(obj.type, obj.rot, obj.variant),
        ox + p.x * this.zoom,
        oy + p.y * this.zoom,
        (obj.x + obj.y + 1) * 100,
      );
    }
    const p = project(1.5, 2.5);
    this.avatar(tex, ox + p.x * this.zoom, oy + p.y * this.zoom, row);
    this.label(
      28,
      rowY + this.rowHeight - 28,
      'Mobilier actuel · empreintes conservées · marche autour du sakura',
    );
  }

  update(time: number): void {
    const mode = select('pose').value;
    const sequence: AvatarPose[] = ['walkA', 'idle', 'walkB', 'idle'];
    const pose = mode === 'walk' ? sequence[Math.floor(time / 110) % 4]! : (mode as AvatarPose);
    for (const actor of this.actors) {
      let facing = AVATAR_FACINGS[this.rotation]!;
      if (this.garden && mode === 'walk') {
        // Chemin carré autour du sakura : même règle de profondeur statique que le monde.
        const t = (time / 1800) % 4;
        const side = Math.floor(t);
        const u = t - side;
        const points = [
          [1.5 + 2 * u, -0.5],
          [3.5, -0.5 + 2 * u],
          [3.5 - 2 * u, 1.5],
          [1.5, 1.5 - 2 * u],
        ];
        const [x, y] = points[side]!;
        const p = project(x!, y!);
        facing = (['px', 'py', 'nx', 'ny'] as const)[side]!;
        actor.sprite
          .setPosition(
            W / 2 + p.x * this.zoom,
            actor.row * this.rowHeight + 80 + 64 * this.zoom + p.y * this.zoom,
          )
          .setDepth((x! + y!) * 100 + 0.5);
      } else {
        actor.sprite.setPosition(actor.homeX, actor.homeY).setDepth(this.garden ? 400 : 100);
      }
      actor.sprite.setFrame(frameName(facing, pose));
    }
  }
}

declare global {
  interface Window {
    __voxelPreview: Phaser.Game;
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'gallery',
  width: W,
  height: H,
  backgroundColor: '#141c2e',
  render: { antialias: true, roundPixels: false, powerPreference: 'low-power' },
  fps: { target: 30, limit: 30 },
  audio: { noAudio: true },
  banner: false,
  scene: VoxelPreview,
});
// Accès de test local ; éviter de réimporter l'entrée Vite et créer un second jeu.
window.__voxelPreview = game;
import.meta.hot?.dispose(() => game.destroy(true));

document.getElementById('controls')!.addEventListener('change', (event) => {
  const query = new URLSearchParams();
  for (const id of controls) query.set(id, select(id).value);
  history.replaceState(null, '', `${location.pathname}?${query}`);
  if (['quality', 'render'].includes((event.target as HTMLElement).id)) location.reload();
  else (game.scene.getScenes(true)[0] as VoxelPreview | undefined)?.draw();
});
document.getElementById('controls')!.addEventListener('submit', (event) => event.preventDefault());
document
  .getElementById('reset')!
  .addEventListener('click', () => location.assign(location.pathname));
