import Phaser from 'phaser';
import { project, type Vec2 } from '../../core/iso';
import { rotatePoint } from '../../core/rotation';
import type { WorldModel, WorldObject } from '../../world/WorldModel';
import type { WorldRenderer } from '../WorldRenderer';

/**
 * Vie du décor, entièrement dans le navigateur (aucun message réseau) : jets d'eau de la
 * fontaine, oiseaux qui se posent dans les arbres et s'envolent quand on approche, papillons
 * autour des massifs, vapeur du café. Discret, et coupé si le joueur réduit les animations.
 */
export interface LifeOptions {
  /** Qualité « basse » : moins d'oiseaux et de gouttes. */
  effects: boolean;
  /** Échelle des textures (netteté). */
  texScale: number;
  /** Profondeur d'affichage d'un point au sol (même règle que les avatars). */
  depthAt(x: number, y: number): number;
  /** Position du joueur, pour que les oiseaux s'envolent à son approche. */
  player(): Vec2;
}

interface Drop {
  dot: Phaser.GameObjects.Arc;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  alive: boolean;
}

interface Spot {
  x: number;
  y: number;
  z: number;
  /** Arbre sur lequel l'oiseau est posé (profondeur), ou null au sol. */
  tree: string | null;
}

interface Bird {
  img: Phaser.GameObjects.Image;
  at: Spot;
  from: Spot;
  to: Spot | null;
  t: number;
  dur: number;
  next: number;
  flap: number;
}

interface Butterfly {
  img: Phaser.GameObjects.Image;
  cx: number;
  cy: number;
  phase: number;
  speed: number;
}

const BIRD_TEX = 'life:bird';
const BUTTERFLY_TEX = 'life:butterfly';
const BIRD_TINTS = [0xc08a5c, 0x7f6a5a, 0x6f9be0, 0xe0885f];
const BUTTERFLY_TINTS = [0xf6e27a, 0xf2a7c3, 0x9fd6ff, 0xffffff];
const FLY_SPEED = 4; // tuiles par seconde
const FLY_DEPTH = 9e6; // en vol : au-dessus de tout
const BIRD_SCALE = 1.4;
const BUTTERFLY_SCALE = 1.3;

/** Point d'un objet (coordonnées de son dessin canonique) dans le monde. */
function objectPoint(o: WorldObject, lx: number, ly: number): Vec2 {
  const p = rotatePoint(lx, ly, o.rot, o.entry.footprint[0], o.entry.footprint[1]);
  return { x: o.x + p.x, y: o.y + p.y };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

export class AmbientLife {
  private drops: Drop[] = [];
  private fountains: Array<{ x: number; y: number; depth: number }> = [];
  /** Plans d'eau où naissent des ronds (fontaine : bassin bas ; étang). */
  private waters: Array<{ x: number; y: number; z: number; r: number; depth: number }> = [];
  private dropTimer = 0;
  private rippleTimer = 0;
  private steamSpots: Array<{ x: number; y: number; z: number; depth: number }> = [];
  /** Feux de camp : étincelles et fumée. */
  private fires: Array<{ x: number; y: number; depth: number }> = [];
  private fireTimer = 0;
  private steamTimer = 0;
  private birds: Bird[] = [];
  private perches: Spot[] = [];
  private grounds: Spot[] = [];
  private butterflies: Butterfly[] = [];
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldModel,
    private readonly renderer: WorldRenderer,
    private readonly opts: LifeOptions,
  ) {
    this.makeTextures();
    const depthOf = (o: WorldObject) => this.renderer.objects.get(o.id)?.depth ?? 0;
    for (const o of world.objects) {
      if (o.type === 'fountain') {
        const c = objectPoint(o, 1, 1);
        this.fountains.push({ ...c, depth: depthOf(o) + 0.5 });
        this.waters.push({ ...c, z: 0.27, r: 0.6, depth: depthOf(o) + 0.1 });
      } else if (o.type === 'campfire') {
        const c = objectPoint(o, 0.5, 0.5);
        this.fires.push({ ...c, depth: depthOf(o) + 0.5 });
      } else if (o.type === 'pond') {
        const c = objectPoint(o, 1.5, 1.5);
        this.waters.push({ ...c, z: 0.13, r: 1.0, depth: depthOf(o) + 0.1 });
      } else if (o.type === 'coffee_bar') {
        const c = objectPoint(o, 0.98, 0.6);
        this.steamSpots.push({ ...c, z: 0.97, depth: depthOf(o) + 0.5 });
      } else if (o.type === 'tree') {
        const c = objectPoint(o, 0.5, 0.5);
        this.perches.push({ x: c.x, y: c.y, z: o.variant % 3 === 1 ? 2.06 : 1.88, tree: o.id });
        // Coins d'herbe autour de l'arbre, où les oiseaux viennent picorer.
        for (const [dx, dy] of [
          [1.5, 0.5],
          [-0.5, 0.5],
          [0.5, 1.5],
          [0.5, -0.5],
        ] as const) {
          const gx = o.x + dx;
          const gy = o.y + dy;
          if (world.grid.isWalkable(Math.floor(gx), Math.floor(gy)))
            this.grounds.push({ x: gx, y: gy, z: 0, tree: null });
        }
      }
    }
    for (let i = 0; i < (opts.effects ? 22 : 10); i++) this.drops.push(this.makeDrop());
    const birdCount = this.perches.length === 0 ? 0 : opts.effects ? 6 : 3;
    for (let i = 0; i < birdCount; i++) {
      const bird = this.makeBird();
      this.birds.push(bird);
      this.placeBird(bird);
    }
    const beds = world.objects.filter((o) => o.type === 'flowerbed');
    for (let i = 0; i < Math.min(beds.length, opts.effects ? 4 : 2); i++) {
      const c = objectPoint(beds[(i * 2) % beds.length]!, 1, 0.5);
      const img = scene.add
        .image(0, 0, BUTTERFLY_TEX)
        .setTint(pick(BUTTERFLY_TINTS))
        .setScale(BUTTERFLY_SCALE / opts.texScale);
      this.butterflies.push({ img, cx: c.x, cy: c.y, phase: rand(0, 10), speed: rand(0.6, 1) });
    }
  }

  /** Petits dessins générés une fois (oiseau : 3 images ; papillon). */
  private makeTextures(): void {
    const tm = this.scene.textures;
    const s = this.opts.texScale;
    if (!tm.exists(BIRD_TEX)) {
      const w = 12;
      const h = 10;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(w * 3 * s);
      canvas.height = Math.ceil(h * s);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(s, s);
      const body = (ox: number) => {
        ctx.fillStyle = '#e9e4dc';
        ctx.beginPath();
        ctx.ellipse(ox + 6, 6, 3.6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ox + 9, 4.4, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(ox + 1.4, 5, 1.8, 1.2); // queue
        ctx.fillStyle = '#2b2b33';
        ctx.fillRect(ox + 9.4, 3.8, 0.8, 0.8); // œil
        ctx.fillStyle = '#f2b04a';
        ctx.fillRect(ox + 10.6, 4.4, 1.4, 0.8); // bec
      };
      const wing = (ox: number, up: boolean) => {
        ctx.fillStyle = '#cfc8be';
        ctx.beginPath();
        ctx.moveTo(ox + 4.5, 5.5);
        ctx.lineTo(ox + 7.5, 5.5);
        ctx.lineTo(ox + (up ? 5 : 6.5), up ? 0.6 : 9.6);
        ctx.closePath();
        ctx.fill();
      };
      body(0); // posé
      body(w);
      wing(w, true); // ailes en haut
      body(w * 2);
      wing(w * 2, false); // ailes en bas
      const tex = tm.addCanvas(BIRD_TEX, canvas);
      if (tex) for (let i = 0; i < 3; i++) tex.add(i, 0, i * w * s, 0, w * s, h * s);
    }
    if (!tm.exists(BUTTERFLY_TEX)) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(8 * s);
      canvas.height = Math.ceil(6 * s);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(s, s);
      ctx.fillStyle = '#ffffff';
      for (const dx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(4 + dx * 2, 2.6, 2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#3a3340';
      ctx.fillRect(3.6, 1, 0.8, 4.4);
      tm.addCanvas(BUTTERFLY_TEX, canvas);
    }
  }

  private makeDrop(): Drop {
    const dot = this.scene.add.circle(0, 0, 1.6, 0xcff4ff, 0.85).setVisible(false);
    return { dot, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, alive: false };
  }

  private makeBird(): Bird {
    const at = { ...pick(this.perches) };
    const img = this.scene.add
      .image(0, 0, BIRD_TEX, 0)
      .setOrigin(0.5, 0.9)
      .setTint(pick(BIRD_TINTS))
      .setScale(BIRD_SCALE / this.opts.texScale)
      .setFlipX(Math.random() < 0.5);
    return { img, at, from: at, to: null, t: 0, dur: 0, next: rand(2, 10), flap: 0 };
  }

  /** Retire les gouttes, oiseaux et papillons (la salle va être reconstruite). */
  destroy(): void {
    for (const d of this.drops) d.dot.destroy();
    for (const b of this.birds) b.img.destroy();
    for (const b of this.butterflies) b.img.destroy();
    this.drops = [];
    this.birds = [];
    this.butterflies = [];
    this.fountains = [];
    this.waters = [];
    this.steamSpots = [];
    this.fires = [];
    this.perches = [];
    this.grounds = [];
  }

  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    this.time += dt;
    this.updateFountains(dt);
    this.updateRipples(dt);
    this.updateSteam(dt);
    this.updateFires(dt);
    this.updateBirds(dt);
    this.updateButterflies();
  }

  // ---------------------------------------------------------------- Fontaine

  private updateFountains(dt: number): void {
    if (this.fountains.length === 0) return;
    this.dropTimer -= dt;
    while (this.dropTimer <= 0) {
      this.dropTimer += this.opts.effects ? 0.07 : 0.15;
      const drop = this.drops.find((d) => !d.alive);
      const f = pick(this.fountains);
      if (drop) {
        const a = rand(0, Math.PI * 2);
        const v = rand(0.15, 0.4);
        Object.assign(drop, {
          x: f.x,
          y: f.y,
          z: 1.2,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          vz: rand(1.1, 1.6),
          alive: true,
        });
        drop.dot.setVisible(true).setDepth(f.depth);
      }
    }
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.vz -= 3.4 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.z < 0.95) {
        d.alive = false;
        d.dot.setVisible(false);
        continue;
      }
      const p = project(d.x, d.y, d.z);
      d.dot.setPosition(p.x, p.y);
    }
  }

  /** Ronds dans l'eau (fontaine et étangs). */
  private updateRipples(dt: number): void {
    if (this.waters.length === 0) return;
    this.rippleTimer -= dt;
    if (this.rippleTimer > 0) return;
    this.rippleTimer = rand(0.6, 1.4);
    const w = pick(this.waters);
    const a = rand(0, Math.PI * 2);
    const r = rand(0.1, w.r);
    const p = project(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r, w.z);
    const ring = this.scene.add
      .ellipse(p.x, p.y, 10, 5)
      .setStrokeStyle(1, 0xe6fbff, 0.7)
      .setDepth(w.depth)
      .setScale(0.3);
    this.scene.tweens.add({
      targets: ring,
      scale: 1.4,
      alpha: 0,
      duration: 1200,
      onComplete: () => ring.destroy(),
    });
  }

  // ---------------------------------------------------------------- Vapeur du café

  private updateSteam(dt: number): void {
    if (this.steamSpots.length === 0) return;
    this.steamTimer -= dt;
    if (this.steamTimer > 0) return;
    this.steamTimer = rand(0.9, 1.6);
    const s = pick(this.steamSpots);
    const p = project(s.x, s.y, s.z);
    const puff = this.scene.add
      .circle(p.x + rand(-1.5, 1.5), p.y, 2.2, 0xffffff, 0.45)
      .setDepth(s.depth);
    this.scene.tweens.add({
      targets: puff,
      y: p.y - 18,
      x: puff.x + rand(-4, 4),
      scale: 2.2,
      alpha: 0,
      duration: 1800,
      onComplete: () => puff.destroy(),
    });
  }

  // ---------------------------------------------------------------- Feu de camp

  private updateFires(dt: number): void {
    if (this.fires.length === 0) return;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = rand(0.15, 0.4);
    for (const f of this.fires) {
      const p = project(f.x, f.y, 0.35);
      const smoke = Math.random() < 0.25;
      const dot = this.scene.add
        .circle(
          p.x + rand(-4, 4),
          p.y,
          smoke ? 3 : 1.3,
          smoke ? 0x9a948a : pick([0xffb347, 0xffd25e, 0xff7a3d]),
          smoke ? 0.35 : 0.95,
        )
        .setDepth(f.depth);
      this.scene.tweens.add({
        targets: dot,
        y: p.y - (smoke ? 40 : rand(14, 26)),
        x: dot.x + rand(-6, 6),
        scale: smoke ? 2.4 : 0.4,
        alpha: 0,
        duration: smoke ? 2200 : rand(600, 1000),
        onComplete: () => dot.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------- Oiseaux

  private updateBirds(dt: number): void {
    const player = this.opts.player();
    for (const b of this.birds) {
      if (b.to) {
        // En vol : arc entre deux points, battements d'ailes.
        b.t += dt / b.dur;
        b.flap += dt;
        const k = Math.min(1, b.t);
        const x = b.from.x + (b.to.x - b.from.x) * k;
        const y = b.from.y + (b.to.y - b.from.y) * k;
        const z = b.from.z + (b.to.z - b.from.z) * k + Math.sin(Math.PI * k) * 1.4;
        const p = project(x, y, z);
        b.img.setPosition(p.x, p.y).setFrame(Math.floor(b.flap / 0.09) % 2 === 0 ? 1 : 2);
        b.img.setDepth(FLY_DEPTH);
        if (k >= 1) {
          b.at = b.to;
          b.to = null;
          b.next = rand(4, 14);
          this.placeBird(b);
        }
        continue;
      }
      // Posé : s'envole si le joueur approche, sinon change de place de temps en temps.
      const near = Math.hypot(player.x - b.at.x, player.y - b.at.y);
      b.next -= dt;
      if (near < (b.at.tree ? 1.3 : 2.2)) this.flyTo(b, pick(this.perches));
      else if (b.next <= 0) {
        if (b.at.tree === null && Math.random() < 0.5) this.hop(b);
        else
          this.flyTo(
            b,
            Math.random() < 0.6 || this.grounds.length === 0
              ? pick(this.perches)
              : pick(this.grounds),
          );
      }
    }
  }

  private placeBird(b: Bird): void {
    const p = project(b.at.x, b.at.y, b.at.z);
    b.img.setPosition(p.x, p.y).setFrame(0);
    const tree = b.at.tree ? this.renderer.objects.get(b.at.tree) : undefined;
    b.img.setDepth(tree ? tree.depth + 0.3 : this.opts.depthAt(b.at.x, b.at.y));
  }

  private flyTo(b: Bird, target: Spot): void {
    const to = { ...target, x: target.x + rand(-0.15, 0.15), y: target.y + rand(-0.15, 0.15) };
    const dist = Math.hypot(to.x - b.at.x, to.y - b.at.y);
    if (dist < 0.3) {
      b.next = rand(3, 8);
      return;
    }
    b.from = b.at;
    b.to = to;
    b.t = 0;
    b.dur = Math.max(0.6, dist / FLY_SPEED);
    b.img.setFlipX(project(to.x, to.y).x < project(b.at.x, b.at.y).x);
  }

  /** Petit saut au sol (picorer). */
  private hop(b: Bird): void {
    const nx = b.at.x + rand(-0.35, 0.35);
    const ny = b.at.y + rand(-0.35, 0.35);
    if (!this.world.grid.isWalkable(Math.floor(nx), Math.floor(ny))) {
      b.next = rand(1, 3);
      return;
    }
    b.img.setFlipX(project(nx, ny).x < project(b.at.x, b.at.y).x);
    b.at = { ...b.at, x: nx, y: ny };
    const p = project(nx, ny);
    this.scene.tweens.add({
      targets: b.img,
      x: p.x,
      y: { from: b.img.y - 4, to: p.y },
      duration: 220,
      onComplete: () => this.placeBird(b),
    });
    b.next = rand(1.5, 5);
  }

  // ---------------------------------------------------------------- Papillons

  private updateButterflies(): void {
    for (const f of this.butterflies) {
      const t = this.time * f.speed + f.phase;
      const x = f.cx + Math.cos(t) * 1.1 + Math.sin(t * 2.3) * 0.3;
      const y = f.cy + Math.sin(t * 0.8) * 0.9;
      const z = 0.7 + Math.sin(t * 3.1) * 0.25;
      const p = project(x, y, z);
      f.img.setPosition(p.x, p.y);
      const k = BUTTERFLY_SCALE / this.opts.texScale;
      f.img.setScale((Math.abs(Math.sin(this.time * 14 + f.phase)) * 0.8 + 0.2) * k, k);
      f.img.setDepth(this.opts.depthAt(x, y) + 0.5);
    }
  }
}
