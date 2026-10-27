import * as THREE from 'three';
import { VersionedStorage } from '../services/storage';
import { AIR, ALL_ITEMS, FURNACE, WORKBENCH, blockDef, breakTime, dropOf, itemDef } from './blocks';
import { DEFAULT_BINDINGS, copyBindings, pressed, type Bindings } from './controls';
import { MAX_DROPS, packDrops, parseDrops, spawnDrop, stepDrops, type Drop } from './drops';
import {
  HOTBAR_SIZE,
  Inventory,
  MAX_STACK,
  RECIPES,
  stationsNear,
  type Station,
} from './inventory';
import { PATTERNS } from './mesh';
import {
  CHUNK,
  buildChunk,
  computeLighting,
  updateLighting,
  type Lighting,
  type MeshData,
} from './mesh';
import { EYE, FALL_LIMIT, HEIGHT, occupies, respawn, stepPlayer, type PlayerState } from './player';
import type { SharedPeer } from './protocol';
import { sfx } from './sfx';
import { buildAtlas } from './textures';
import {
  CHUNKS_X,
  HUB,
  HUB_BEACON,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  VoxelWorld,
  raycast,
  type Cell,
  type RayHit,
} from './world';

/**
 * Moteur du « Chantier des mondes » (prototype B0) : Three.js, chargé seulement sur cette page.
 * Deux vues au choix du joueur sur le même monde : **première personne** (comme les jeux de
 * construction en cubes) et **isométrique** (comme le Hub, avec coupe automatique sous terre).
 */
export type ViewMode = 'first' | 'iso';
/** `shared` : survie partagée, un seul monde pour tous, tenu par le serveur (DEC-045). */
export type GameMode = 'survival' | 'creative' | 'shared';

/**
 * Branchement réseau du monde partagé (main.ts) : le jeu montre tout de suite ce que fait le
 * joueur, puis le serveur confirme ou corrige (il renvoie l'état réel de la case et le sac).
 */
export interface SharedHooks {
  /** Compte connecté et serveur joignable. */
  canBuild(): boolean;
  /** Pourquoi on ne peut pas construire (visiteur, hors ligne). */
  whyNot(): string;
  dig(index: number, held: number): void;
  put(index: number, block: number): void;
  craft(recipe: number): void;
  home(): void;
  move(x: number, y: number, z: number, yaw: number): void;
}

/** Un autre joueur du monde partagé. */
interface Peer {
  name: string;
  body: THREE.Group;
  label: THREE.Sprite;
  target: { x: number; y: number; z: number; a: number };
  phase: number;
}

/** Portée des mains (cubes). */
export const REACH = 5;
export const REACH_ISO = 6.5;
/** 2 : grand monde (192 × 192) ; les parties du petit monde ne sont pas reprises. */
const SAVE_VERSION = 2;
const store = new VersionedStorage();

/** Durée d'un coup de pioche (s) et moment de l'impact dans le geste (0 à 1). */
export const STRIKE = 0.32;
export const IMPACT = 0.6;

/** Angle du bras selon la phase du coup : on lève (0 → IMPACT), on frappe, on revient. */
export function strikeAngle(phase: number): number {
  if (phase < IMPACT) return 0.85 * Math.sin(((phase / IMPACT) * Math.PI) / 2);
  const k = (phase - IMPACT) / (1 - IMPACT);
  return k < 0.35 ? 0.85 - (k / 0.35) * 1.45 : -0.6 * (1 - (k - 0.35) / 0.65);
}

export interface GameEvents {
  /** L'inventaire, l'objet tenu ou la vue ont changé : la barre rapide se redessine. */
  changed(): void;
  toast(text: string): void;
  /** Ouvre l'inventaire (clic droit sur un établi ou un four). */
  openInventory(): void;
  /** La souris a été libérée par le joueur (Échap) : pause, comme dans les jeux de cubes. */
  paused(): void;
}

interface SaveData {
  edits: unknown;
  inv?: unknown;
  drops?: unknown;
  player?: { x: number; y: number; z: number; yaw: number; pitch: number };
  view?: ViewMode;
}

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null;

export class SandboxGame {
  readonly world = new VoxelWorld(1);
  inv = new Inventory();
  readonly player: PlayerState;
  view: ViewMode = 'first';
  yaw = 0;
  pitch = -0.2;
  fly = false;
  /** Monter seul une marche : désactivé par défaut (on saute, comme dans les jeux de cubes). */
  autoStep = false;
  /** Touches choisies par le joueur (voir src/sandbox/controls.ts). */
  bindings: Bindings = copyBindings(DEFAULT_BINDINGS);
  /** Monde partagé : branchement réseau (null : partie solo). */
  shared: SharedHooks | null = null;
  private readonly peers = new Map<string, Peer>();
  /** Modifications reçues du serveur : lumière et dessin à refaire (une fois, à l'image suivante). */
  private relight = false;
  /** Objets tombés au sol, à ramasser. */
  drops: Drop[] = [];
  private readonly dropMeshes = new Map<Drop, THREE.Mesh>();
  private readonly dropGeometries = new Map<number, THREE.BufferGeometry>();
  private dropMaterial!: THREE.MeshBasicMaterial;
  /** Libération de la souris voulue par le jeu (sac, menu, changement de vue) : pas de pause. */
  private unlockExpected = false;
  /** Outil des doigts en vue isométrique : creuser ou poser. */
  touchTool: 'dig' | 'place' = 'dig';
  /** Commandes (clavier, manette tactile). */
  readonly keys = new Set<string>();
  move = { x: 0, y: 0 };
  jumpHeld = false;
  /** Course gardée après un double appui sur « avancer » (comme dans les jeux de cubes). */
  sprintLatch = false;
  mining = false;
  /** Progression du cube en cours de creusage (0 à 1). */
  progress = 0;
  target: RayHit | null = null;
  fps = 0;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly fog = new THREE.Fog('#9fdcf2', 60, 7 * CHUNK);
  /** Distance de vue, en tranches de 16 cubes (le Hub reste toujours visible au loin). */
  viewChunks = 7;
  /** Tranches à (re)construire, les plus proches d'abord, quelques-unes par image. */
  private readonly queue = new Set<string>();
  private readonly fpCam: THREE.PerspectiveCamera;
  private readonly isoCam: THREE.OrthographicCamera;
  private isoRot = 0;
  private isoZoom = 11;
  private readonly chunks = new Map<string, THREE.Mesh[]>();
  private readonly materials: { opaque: THREE.Material; glass: THREE.Material };
  private light: Lighting;
  private cutZ = SIZE_Z - 1;
  private readonly outline: THREE.LineSegments;
  private readonly crack: THREE.Mesh;
  private readonly ghost: THREE.Mesh;
  private readonly avatar: THREE.Group;
  private readonly hand: THREE.Group;
  private readonly handParts: { arm: THREE.Mesh; cube: THREE.Mesh; pick: THREE.Group };
  private torchSticks: THREE.InstancedMesh;
  /** Éclats d'un cube cassé : petits cubes qui retombent (purement décoratif). */
  private readonly bits: THREE.InstancedMesh;
  /** Faisceau au-dessus de la tour du Hub : le repère qu'on voit de loin, à travers la brume. */
  private readonly beacon = new THREE.Group();
  private bitList: Array<{ p: THREE.Vector3; v: THREE.Vector3; life: number; color: THREE.Color }> =
    [];
  /** Coup de pioche en cours : phase de 0 à 1 (le bruit part à l'impact, IMPACT). */
  private strike = 0;
  /** Petit geste du bras quand on pose un cube (1 → 0). */
  private jab = 0;
  /** Pour le tutoriel : regard et marche cumulés, types de cubes posés. */
  looked = 0;
  walked = 0;
  readonly placedTypes = new Set<number>();
  private torchFlames: THREE.InstancedMesh;
  private mineCell: string | null = null;
  private lastBreak = 0;
  private walkPhase = 0;
  private pointer: { x: number; y: number } | null = null;
  private dirty = false;
  private saveTimer = 0;
  private frames = 0;
  private fpsTimer = 0;
  private last = performance.now();
  private running = true;
  readonly atlas: HTMLCanvasElement;

  constructor(
    readonly container: HTMLElement,
    readonly mode: GameMode,
    private readonly events: GameEvents,
  ) {
    this.player = { x: 0, y: 0, z: 0, vz: 0, onGround: false };
    respawn(this.player, this.world);
    this.load();
    if (mode === 'creative') this.creativeInventory();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'sandbox-canvas';
    container.append(this.renderer.domElement);

    this.scene.background = new THREE.Color('#9fdcf2');
    this.fpCam = new THREE.PerspectiveCamera(72, 1, 0.05, 420);
    this.fpCam.rotation.order = 'YXZ';
    this.isoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.scene.add(this.fpCam);

    this.atlas = buildAtlas();
    const tex = new THREE.CanvasTexture(this.atlas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.materials = {
      // Lumière déjà calculée dans les couleurs des sommets : matériau simple, rapide partout.
      opaque: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 }),
      glass: new THREE.MeshBasicMaterial({
        map: tex,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
      }),
    };

    this.dropMaterial = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 });

    // Repères : contour du cube visé, fissures, aperçu du cube à poser.
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)),
      new THREE.LineBasicMaterial({ color: 0x141a2b }),
    );
    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({ color: 0x141a2b, transparent: true, opacity: 0 }),
    );
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x5fe3d0, transparent: true, opacity: 0.28 }),
    );
    this.scene.add(this.outline, this.crack, this.ghost);

    this.avatar = makeAvatar();
    this.scene.add(this.avatar);
    // Bras, cube ou pioche tenus, en bas à droite de l'écran (première personne). Le groupe
    // tourne autour du poignet : c'est lui qui frappe.
    this.handParts = makeHand();
    this.hand = new THREE.Group();
    this.hand.add(this.handParts.arm, this.handParts.cube, this.handParts.pick);
    this.hand.position.set(0.46, -0.5, -0.72);
    this.fpCam.add(this.hand);

    const stick = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    stick.translate(0, 0.275, 0);
    const flame = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    flame.translate(0, 0.62, 0);
    this.torchSticks = new THREE.InstancedMesh(
      stick,
      new THREE.MeshBasicMaterial({ color: 0x8a5a36 }),
      512,
    );
    this.torchFlames = new THREE.InstancedMesh(
      flame,
      new THREE.MeshBasicMaterial({ color: 0xffd36e }),
      512,
    );
    this.scene.add(this.torchSticks, this.torchFlames);
    this.bits = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      96,
    );
    this.bits.count = 0;
    this.scene.add(this.bits);
    for (const [width, opacity] of [
      [0.9, 0.55],
      [2.4, 0.18],
    ] as const) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(width, 70, width).translate(0, 35, 0),
        new THREE.MeshBasicMaterial({
          color: 0x7ff0e0,
          transparent: true,
          opacity,
          depthWrite: false,
          fog: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      this.beacon.add(beam);
    }
    this.beacon.position.set(HUB_BEACON.x, HUB_BEACON.z, HUB_BEACON.y);
    this.scene.add(this.beacon);

    this.light = computeLighting(this.world);
    this.rebuildAll();
    this.bindPointer();
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    document.addEventListener('pointerlockchange', this.onLockChange);
    this.resize();
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ sauvegarde

  private key(): string {
    return `chantier-${this.mode}`;
  }

  private load(): void {
    // Monde partagé : tout vient du serveur (terrain, sac, position).
    if (this.mode === 'shared') return;
    const data = store.read<SaveData>(this.key(), SAVE_VERSION, (raw) =>
      typeof raw === 'object' && raw !== null ? (raw as SaveData) : null,
    );
    if (!data) {
      if (this.mode === 'survival') this.inv = new Inventory();
      return;
    }
    this.world.load(data.edits);
    this.world.clearUndo();
    if (this.mode === 'survival') {
      this.inv = Inventory.parse(data.inv);
      this.drops = parseDrops(data.drops, (id) => !!itemDef(id));
    }
    const p = data.player;
    if (p) {
      const x = num(p.x, 0, SIZE_X);
      const y = num(p.y, 0, SIZE_Y);
      const z = num(p.z, 0, SIZE_Z + 4);
      if (x !== null && y !== null && z !== null) Object.assign(this.player, { x, y, z });
      this.yaw = num(p.yaw, -100, 100) ?? 0;
      this.pitch = num(p.pitch, -1.6, 1.6) ?? -0.2;
    }
    if (data.view === 'iso' || data.view === 'first') this.view = data.view;
  }

  /** Enregistre dans le navigateur (seulement les modifications du terrain). */
  save(): boolean {
    this.dirty = false;
    if (this.mode === 'shared') return true;
    const ok = store.write(this.key(), SAVE_VERSION, {
      edits: this.world.edits(),
      ...(this.mode === 'survival' ? { inv: this.inv.toJSON(), drops: packDrops(this.drops) } : {}),
      player: {
        x: this.player.x,
        y: this.player.y,
        z: this.player.z,
        yaw: this.yaw,
        pitch: this.pitch,
      },
      view: this.view,
    });
    if (!ok)
      this.events.toast('Sauvegarde impossible : le stockage du navigateur est plein ou bloqué.');
    return ok;
  }

  /** Efface ce monde et recommence (le terrain de départ revient). */
  restart(): void {
    if (this.mode === 'shared') return;
    store.remove(this.key());
    this.world.reset();
    this.inv = new Inventory();
    this.drops = [];
    if (this.mode === 'creative') this.creativeInventory();
    respawn(this.player, this.world);
    this.light = computeLighting(this.world);
    this.rebuildAll();
    this.events.changed();
  }

  private onHide = () => {
    if (document.visibilityState === 'hidden' || !document.visibilityState) this.save();
  };

  /** Créatif : tous les cubes, sans limite (rien ne passe dans la partie « survie »). */
  private creativeInventory(): void {
    this.inv = new Inventory();
    for (const item of ALL_ITEMS) this.inv.counts.set(item.id, 999);
    const blocks = ALL_ITEMS.filter((i) => i.block).map((i) => i.id);
    for (let i = 0; i < HOTBAR_SIZE; i++) this.inv.hotbar[i] = blocks[i] ?? null;
  }

  // ------------------------------------------------------------------ rendu du monde

  /** Tout le monde est à (re)construire : les tranches proches viennent en premier. */
  private rebuildAll(): void {
    for (let y = 0; y < SIZE_Y; y += CHUNK)
      for (let x = 0; x < SIZE_X; x += CHUNK) this.queue.add(`${x},${y}`);
    this.rebuildTorches();
  }

  /**
   * Une modification : sa tranche est refaite tout de suite (on voit le cube disparaître),
   * les voisines touchées par la lumière des torches juste après.
   */
  private rebuildAround(c: Cell): void {
    const own = `${Math.floor(c.x / CHUNK) * CHUNK},${Math.floor(c.y / CHUNK) * CHUNK}`;
    const r = 8;
    for (let y = c.y - r; y <= c.y + r; y += 4)
      for (let x = c.x - r; x <= c.x + r; x += 4) {
        const cx = Math.floor(Math.max(0, Math.min(SIZE_X - 1, x)) / CHUNK) * CHUNK;
        const cy = Math.floor(Math.max(0, Math.min(SIZE_Y - 1, y)) / CHUNK) * CHUNK;
        const k = `${cx},${cy}`;
        if (k !== own) this.queue.add(k);
      }
    const [ox, oy] = own.split(',').map(Number) as [number, number];
    this.rebuildChunk(ox, oy);
    this.queue.delete(own);
    this.rebuildTorches();
  }

  /** Construit quelques tranches de la file, les plus proches d'abord (≈ 6 ms par image). */
  private drainQueue(): void {
    if (this.queue.size === 0) return;
    const px = this.player.x;
    const py = this.player.y;
    const list = [...this.queue].map((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      return { k, x, y, d: Math.hypot(x + CHUNK / 2 - px, y + CHUNK / 2 - py) };
    });
    list.sort((a, b) => a.d - b.d);
    const start = performance.now();
    for (const c of list) {
      this.queue.delete(c.k);
      this.rebuildChunk(c.x, c.y);
      if (performance.now() - start > 6) break;
    }
    if (this.queue.size === 0) this.rebuildTorches();
  }

  /** Tranches trop lointaines cachées (le Hub reste visible : c'est le repère au loin). */
  private cullChunks(): void {
    const max = (this.viewChunks + 0.5) * CHUNK;
    for (const [k, meshes] of this.chunks) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const d = Math.hypot(x + CHUNK / 2 - this.player.x, y + CHUNK / 2 - this.player.y);
      const hub =
        x < HUB.x0 + HUB.w && x + CHUNK > HUB.x0 && y < HUB.y0 + HUB.d && y + CHUNK > HUB.y0;
      const visible = this.view === 'iso' || hub || d <= max;
      for (const m of meshes) m.visible = visible;
    }
  }

  /** Change la distance de vue (courte, normale, longue). */
  setViewDistance(chunks: number): void {
    this.viewChunks = Math.max(3, Math.min(CHUNKS_X, chunks));
    this.fog.far = this.viewChunks * CHUNK;
    this.fog.near = this.fog.far * 0.55;
  }

  private rebuildChunk(x0: number, y0: number): void {
    const key = `${x0},${y0}`;
    for (const m of this.chunks.get(key) ?? []) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    const { opaque, glass } = buildChunk(this.world, x0, y0, this.cutZ, this.light);
    const meshes = [
      toMesh(opaque, this.materials.opaque),
      toMesh(glass, this.materials.glass),
    ].filter((m): m is THREE.Mesh => m !== null);
    meshes.forEach((m, i) => {
      m.renderOrder = i;
      this.scene.add(m);
    });
    this.chunks.set(key, meshes);
  }

  private rebuildTorches(): void {
    const m = new THREE.Matrix4();
    let n = 0;
    for (const t of this.light.lights.values()) {
      if (n >= 512 || t.z > this.cutZ || !blockDef(this.world.get(t.x, t.y, t.z)).small) continue;
      m.makeTranslation(t.x + 0.5, t.z, t.y + 0.5);
      this.torchSticks.setMatrixAt(n, m);
      this.torchFlames.setMatrixAt(n, m);
      n++;
    }
    this.torchSticks.count = n;
    this.torchFlames.count = n;
    this.torchSticks.instanceMatrix.needsUpdate = true;
    this.torchFlames.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ actions

  /** Ateliers à portée (établi, four) pour la fabrication. */
  stations(): Set<Station> {
    return stationsNear(this.world, this.player.x, this.player.y, this.player.z);
  }

  /** Fabrique une recette (monde partagé : le serveur la refait et renvoie le sac). */
  craft(recipe: number): boolean {
    const r = RECIPES[recipe];
    if (!r) return false;
    if (this.shared && !this.shared.canBuild()) {
      this.events.toast(this.shared.whyNot());
      return false;
    }
    if (!this.inv.craft(r, this.stations())) return false;
    this.shared?.craft(recipe);
    this.dirty = true;
    return true;
  }

  private changedCell(c: Cell): void {
    updateLighting(this.light, c);
    this.rebuildAround(c);
    this.dirty = true;
  }

  /** Clic droit / bouton « poser » : pose le cube tenu devant la face visée. */
  placeOrUse(sneak = false): void {
    const t = this.target;
    if (!t) return;
    const b = this.world.get(t.cell.x, t.cell.y, t.cell.z);
    // Clic droit sur un établi ou un four : on ouvre la fabrication (comme on s'en sert).
    if (!sneak && (b === WORKBENCH || b === FURNACE)) {
      this.events.openInventory();
      return;
    }
    if (this.shared && !this.shared.canBuild()) return this.events.toast(this.shared.whyNot());
    const held = this.inv.held();
    if (held === null) return this.events.toast('Choisis un cube dans ta barre (1 à 9).');
    if (!itemDef(held)?.block)
      return this.events.toast(
        `${itemDef(held)?.name} ne se pose pas : choisis un cube dans ta barre (1 à 9).`,
      );
    const c = t.before;
    if (occupies(this.player, c))
      return this.events.toast('Recule d’un pas : tu es à l’endroit où tu veux poser ce cube.');
    const problem = this.world.placeProblem(c.x, c.y, c.z, held);
    if (problem) return this.events.toast(problem);
    this.world.place(c.x, c.y, c.z, held);
    if (this.mode !== 'creative') {
      this.inv.remove(held, 1);
      this.world.clearUndo();
    }
    this.shared?.put(this.world.index(c.x, c.y, c.z), held);
    this.jab = 1;
    this.placedTypes.add(held);
    sfx.placed(blockDef(held).sound ?? 'soft');
    this.changedCell(c);
    this.events.changed();
  }

  /** Éclats colorés à l'endroit d'un cube cassé. */
  private burst(c: Cell, color: string): void {
    const col = new THREE.Color(color);
    for (let i = 0; i < 16; i++)
      this.bitList.push({
        p: new THREE.Vector3(
          c.x + 0.2 + Math.random() * 0.6,
          c.z + 0.2 + Math.random() * 0.6,
          c.y + 0.2 + Math.random() * 0.6,
        ),
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          2 + Math.random() * 2.5,
          (Math.random() - 0.5) * 3,
        ),
        life: 0.5 + Math.random() * 0.3,
        color: col.clone().multiplyScalar(0.8 + Math.random() * 0.35),
      });
    if (this.bitList.length > 96) this.bitList.splice(0, this.bitList.length - 96);
  }

  private updateBits(dt: number): void {
    const m = new THREE.Matrix4();
    this.bitList = this.bitList.filter((b) => (b.life -= dt) > 0);
    this.bitList.forEach((b, i) => {
      b.v.y -= 18 * dt;
      b.p.addScaledVector(b.v, dt);
      const s = Math.min(1, b.life * 2.5);
      m.makeScale(s, s, s).setPosition(b.p);
      this.bits.setMatrixAt(i, m);
      this.bits.setColorAt(i, b.color);
    });
    this.bits.count = this.bitList.length;
    this.bits.instanceMatrix.needsUpdate = true;
    if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;
  }

  /** Petit cube d'un objet au sol : texture de la matière (cube) ou couleur (autre objet). */
  private dropGeometry(item: number): THREE.BufferGeometry {
    const known = this.dropGeometries.get(item);
    if (known) return known;
    const g = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const def = itemDef(item);
    const b = blockDef(item);
    const n = PATTERNS.length;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    // Faces de BoxGeometry : +X, -X, +Y (dessus), -Y (dessous), +Z, -Z ; 4 sommets chacune.
    for (let f = 0; f < 6; f++) {
      const pattern = !def?.block
        ? null
        : f === 2
          ? b.tex.top
          : f === 3
            ? b.tex.bottom
            : b.tex.side;
      const tile = pattern ? PATTERNS.indexOf(pattern) : -1;
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        if (tile < 0) uv.setXY(i, 0.5 / (n * 16), 0.5 / 16);
        else uv.setXY(i, (tile + 0.05 + uv.getX(i) * 0.9) / n, 0.05 + uv.getY(i) * 0.9);
      }
    }
    uv.needsUpdate = true;
    this.dropGeometries.set(item, g);
    return g;
  }

  private renderDrops(): void {
    const t = performance.now() / 1000;
    for (const [d, m] of this.dropMeshes)
      if (!this.drops.includes(d)) {
        this.scene.remove(m);
        this.dropMeshes.delete(d);
      }
    for (const d of this.drops) {
      let m = this.dropMeshes.get(d);
      if (!m) {
        const def = itemDef(d.item);
        const material = def?.block
          ? this.dropMaterial
          : new THREE.MeshBasicMaterial({ color: def?.color ?? '#ffffff' });
        m = new THREE.Mesh(this.dropGeometry(d.item), material);
        this.scene.add(m);
        this.dropMeshes.set(d, m);
      }
      const bob = d.vz === 0 ? Math.sin(t * 2.4 + d.x) * 0.06 : 0;
      m.position.set(d.x, d.z + 0.16 + bob, d.y);
      m.rotation.y = t * 1.6 + d.x;
    }
  }

  /** Reprend la souris (après le sac ou le menu) : on rejoue sans recliquer dans le monde. */
  lockPointer(): void {
    if (this.view !== 'first' || document.pointerLockElement) return;
    try {
      const p = this.renderer.domElement.requestPointerLock?.() as unknown;
      if (p instanceof Promise) p.catch(() => {});
    } catch {
      /* refusé par le navigateur (pas de geste du joueur) : un clic suffira */
    }
  }

  /** Libère la souris sans mettre le jeu en pause (sac, menu…). */
  releasePointer(): void {
    if (!document.pointerLockElement) return;
    this.unlockExpected = true;
    document.exitPointerLock();
  }

  private onLockChange = () => {
    if (!document.pointerLockElement && this.wasLocked && !this.unlockExpected)
      this.events.paused();
    this.wasLocked = !!document.pointerLockElement;
    if (!document.pointerLockElement) this.unlockExpected = false;
  };
  private wasLocked = false;

  /** Clic molette : met le cube visé dans la main (s'il est dans le sac, ou en créatif). */
  pickTarget(): void {
    const t = this.target;
    if (!t) return;
    const b = this.world.get(t.cell.x, t.cell.y, t.cell.z);
    if (!itemDef(b)?.block || !this.inv.has(b))
      return this.events.toast(`Tu n’as pas de ${blockDef(b).name.toLowerCase()} dans ton sac.`);
    const slot = this.inv.hotbar.indexOf(b);
    if (slot >= 0) this.inv.selected = slot;
    else this.inv.assign(b);
    this.events.changed();
  }

  undo(): void {
    if (this.mode !== 'creative') return;
    const c = this.world.undo();
    if (c) this.changedCell(c);
  }

  respawn(): void {
    respawn(this.player, this.world);
    this.shared?.home();
  }

  setView(v: ViewMode): void {
    this.view = v;
    this.releasePointer();
    this.updateCut(true);
    this.events.changed();
  }

  rotateIso(dir: number): void {
    this.isoRot = (this.isoRot + dir + 4) % 4;
  }

  zoomIso(factor: number): void {
    this.isoZoom = Math.max(5, Math.min(26, this.isoZoom * factor));
  }

  look(dx: number, dy: number): void {
    this.looked += (Math.abs(dx) + Math.abs(dy)) * 0.0042;
    this.yaw += dx * 0.0042;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * 0.0042));
  }

  /** Coupe automatique en vue isométrique : sous un toit ou sous terre, on voit son étage. */
  private updateCut(force = false): void {
    let cut = SIZE_Z - 1;
    if (this.view === 'iso') {
      const px = Math.floor(this.player.x);
      const py = Math.floor(this.player.y);
      const head = Math.floor(this.player.z + HEIGHT);
      let covered = false;
      for (let z = head; z < SIZE_Z && !covered; z++) {
        const b = this.world.get(px, py, z);
        covered = b !== AIR && !blockDef(b).seeThrough;
      }
      if (covered) cut = Math.floor(this.player.z) + 2;
    }
    if (cut !== this.cutZ || force) {
      this.cutZ = cut;
      this.rebuildAll();
    }
  }

  // ------------------------------------------------------------------ commandes

  private bindPointer(): void {
    const el = this.renderer.domElement;
    let touchLook: { id: number; x: number; y: number } | null = null;
    // Vue isométrique au doigt : deux doigts pour zoomer.
    const touches = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Clic molette : pas de défilement automatique du navigateur.
    el.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.view === 'iso' && touches.size === 2) {
          const [a, b] = [...touches.values()];
          pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
          this.mining = false;
          return;
        }
        if (this.view === 'first') {
          touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
        } else {
          this.updateTarget();
          if (this.touchTool === 'dig') this.mining = true;
          else this.placeOrUse();
        }
        return;
      }
      if (this.view === 'first' && document.pointerLockElement !== el) {
        void el.requestPointerLock?.();
        return;
      }
      if (e.button === 1) {
        e.preventDefault();
        this.updateTarget();
        this.pickTarget();
        return;
      }
      // Ctrl + clic : clic droit des pavés tactiles (Mac).
      const right = e.button === 2 || (e.button === 0 && e.ctrlKey);
      if (e.button === 0 && !right) this.mining = true;
      if (right) {
        this.updateTarget();
        this.placeOrUse(e.shiftKey);
      }
    });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.view === 'iso' && touches.size === 2 && pinch > 0) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        this.zoomIso(pinch / Math.max(1, d));
        pinch = d;
        return;
      }
      if (touchLook && e.pointerId === touchLook.id) {
        this.look((e.clientX - touchLook.x) * 1.4, (e.clientY - touchLook.y) * 1.4);
        touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
      } else if (document.pointerLockElement === el) this.look(e.movementX, e.movementY);
    });
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = 0;
      if (touchLook && e.pointerId === touchLook.id) touchLook = null;
      if (e.button === 0 || e.pointerType === 'touch') this.mining = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.view === 'iso' && !e.shiftKey) this.zoomIso(e.deltaY > 0 ? 1.1 : 1 / 1.1);
        else {
          const n = HOTBAR_SIZE;
          this.inv.selected = (this.inv.selected + (e.deltaY > 0 ? 1 : -1) + n) % n;
          this.events.changed();
        }
      },
      { passive: false },
    );
  }

  /** Direction voulue au sol, d'après le clavier ou la manette tactile, selon la vue. */
  private wish(): { x: number; y: number } {
    const k = this.keys;
    let f = this.move.y;
    let r = this.move.x;
    const b = this.bindings;
    if (pressed(b, 'forward', k)) f += 1;
    if (pressed(b, 'back', k)) f -= 1;
    if (pressed(b, 'right', k)) r += 1;
    if (pressed(b, 'left', k)) r -= 1;
    if (f === 0 && r === 0) return { x: 0, y: 0 };
    let fwd: { x: number; y: number };
    let right: { x: number; y: number };
    if (this.view === 'first') {
      fwd = { x: Math.cos(this.yaw), y: Math.sin(this.yaw) };
      right = { x: -Math.sin(this.yaw), y: Math.cos(this.yaw) };
    } else {
      const a = this.isoAngle();
      fwd = { x: -Math.cos(a), y: -Math.sin(a) };
      right = { x: Math.sin(a), y: -Math.cos(a) };
    }
    return { x: fwd.x * f + right.x * r, y: fwd.y * f + right.y * r };
  }

  private isoAngle(): number {
    return Math.PI / 4 + (this.isoRot * Math.PI) / 2;
  }

  // ------------------------------------------------------------------ boucle

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.render();
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }
    requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    if (this.relight) {
      this.relight = false;
      this.light = computeLighting(this.world);
      this.rebuildAll();
    }
    this.drainQueue();
    this.cullChunks();
    const wish = this.wish();
    const jump = this.jumpHeld || pressed(this.bindings, 'jump', this.keys);
    const before = { x: this.player.x, y: this.player.y };
    stepPlayer(
      this.player,
      {
        wish,
        jump,
        sprint: this.sprintLatch || pressed(this.bindings, 'sprint', this.keys),
        sneak: pressed(this.bindings, 'sneak', this.keys),
        fly: this.fly && this.mode === 'creative',
        down: pressed(this.bindings, 'sneak', this.keys),
        autoStep: this.autoStep,
      },
      dt,
      this.world,
    );
    this.walked += Math.hypot(this.player.x - before.x, this.player.y - before.y);
    if (this.player.z < FALL_LIMIT) this.respawn();
    const moving = Math.hypot(wish.x, wish.y) > 0.01;
    if (moving) this.walkPhase += dt * 9;
    if (moving && this.view === 'iso') this.yaw = Math.atan2(wish.y, wish.x);
    this.updateCut();
    this.updateTarget();
    this.updateMining(dt);
    this.jab = Math.max(0, this.jab - dt * 5);
    if (!this.mining || !this.target) this.strike = 0;
    this.updateBits(dt);
    if (this.drops.length > 0) {
      const picked = stepDrops(
        this.drops,
        this.player,
        this.world,
        dt,
        // Monde partagé : le serveur a déjà mis la récolte dans le sac ; ici, juste le « pop ».
        (item) => this.mode === 'shared' || this.inv.count(item) < MAX_STACK,
      );
      for (const item of picked) {
        if (this.mode !== 'shared') this.inv.add(item, 1);
        sfx.pop();
      }
      if (picked.length > 0) {
        this.dirty = true;
        this.events.changed();
      }
    }

    this.shared?.move(this.player.x, this.player.y, this.player.z, this.yaw);
    this.updatePeers(dt);

    this.saveTimer += dt;
    if (this.dirty && this.saveTimer > 4) {
      this.saveTimer = 0;
      this.save();
    }
  }

  /** Cube visé : au centre de l'écran (première personne) ou sous le pointeur (isométrique). */
  private updateTarget(): void {
    let origin: THREE.Vector3;
    let dir: THREE.Vector3;
    let reach: number;
    if (this.view === 'first') {
      this.placeFpCamera();
      origin = this.fpCam.position.clone();
      dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.fpCam.quaternion);
      reach = REACH;
    } else {
      if (!this.pointer) {
        this.target = null;
        return;
      }
      const r = this.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        (this.pointer.x / r.width) * 2 - 1,
        -(this.pointer.y / r.height) * 2 + 1,
      );
      this.placeIsoCamera();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.isoCam);
      origin = ray.ray.origin;
      dir = ray.ray.direction;
      reach = 400;
    }
    // Repère Three.js → monde : x = X, y = Z, z = Y.
    const hit = raycast(
      this.world,
      { x: origin.x, y: origin.z, z: origin.y },
      { x: dir.x, y: dir.z, z: dir.y },
      reach,
      this.cutZ,
    );
    if (hit && this.view === 'iso') {
      const c = hit.cell;
      const d = Math.hypot(
        c.x + 0.5 - this.player.x,
        c.y + 0.5 - this.player.y,
        c.z + 0.5 - (this.player.z + 1),
      );
      if (d > REACH_ISO) {
        this.target = null;
        return;
      }
    }
    this.target = hit;
  }

  private updateMining(dt: number): void {
    const t = this.target;
    if (!this.mining || !t) {
      this.progress = 0;
      this.mineCell = null;
      return;
    }
    const key = `${t.cell.x},${t.cell.y},${t.cell.z}`;
    if (key !== this.mineCell) {
      this.mineCell = key;
      this.progress = 0;
      // Le premier coup part vite : bras déjà levé.
      this.strike = 0.3;
      const problem =
        this.shared?.canBuild() === false
          ? this.shared.whyNot()
          : this.world.breakProblem(t.cell.x, t.cell.y, t.cell.z);
      if (problem) {
        this.events.toast(problem);
        this.mining = false;
        return;
      }
    }
    const block = this.world.get(t.cell.x, t.cell.y, t.cell.z);
    const held = this.inv.held();
    if (this.mode === 'creative') {
      if (performance.now() - this.lastBreak < 180) return;
      this.progress = 1;
      this.strike = IMPACT;
    } else {
      const time = breakTime(block, held);
      if (time === Infinity) return;
      this.progress += dt / Math.max(0.05, time);
      // Un coup toutes les STRIKE secondes : le bruit part quand le bras touche le cube.
      const before = this.strike;
      this.strike += dt / STRIKE;
      if (before < IMPACT && this.strike >= IMPACT) sfx.hit(blockDef(block).sound ?? 'soft');
      if (this.strike >= 1) this.strike -= 1;
    }
    if (this.progress < 1) return;
    const broken = this.world.dig(t.cell.x, t.cell.y, t.cell.z);
    this.lastBreak = performance.now();
    this.progress = 0;
    this.mineCell = null;
    if (broken === null) return;
    this.shared?.dig(this.world.index(t.cell.x, t.cell.y, t.cell.z), held ?? 0);
    sfx.broken(blockDef(broken).sound ?? 'soft');
    this.burst(t.cell, blockDef(broken).color);
    if (this.mode !== 'creative') {
      this.world.clearUndo();
      const drop = dropOf(broken, held);
      if (drop !== null) {
        // Comme dans les jeux de cubes : un petit cube tombe, on le ramasse en passant.
        if (this.drops.length < MAX_DROPS) this.drops.push(spawnDrop(t.cell, drop));
        else this.inv.add(drop, 1);
      } else if (blockDef(broken).tier > 0)
        this.events.toast(
          `Il te faut une meilleure pioche pour récupérer : ${blockDef(broken).name}.`,
        );
    }
    this.changedCell(t.cell);
    this.events.changed();
  }

  // ------------------------------------------------------------------ caméras et dessin

  private placeFpCamera(): void {
    this.fpCam.position.set(this.player.x, this.player.z + EYE, this.player.y);
    this.fpCam.rotation.y = -this.yaw - Math.PI / 2;
    this.fpCam.rotation.x = this.pitch;
  }

  private placeIsoCamera(): void {
    const a = this.isoAngle();
    const d = 60;
    const target = new THREE.Vector3(this.player.x, this.player.z + 1, this.player.y);
    this.isoCam.position.set(
      target.x + Math.cos(a) * d * 0.8165,
      target.y + d * 0.5774,
      target.z + Math.sin(a) * d * 0.8165,
    );
    this.isoCam.lookAt(target);
    const r = this.renderer.domElement.getBoundingClientRect();
    const aspect = r.width / Math.max(1, r.height);
    this.isoCam.left = -this.isoZoom * aspect;
    this.isoCam.right = this.isoZoom * aspect;
    this.isoCam.top = this.isoZoom;
    this.isoCam.bottom = -this.isoZoom;
    this.isoCam.updateProjectionMatrix();
  }

  private render(): void {
    const first = this.view === 'first';
    const cam = first ? this.fpCam : this.isoCam;
    if (first) this.placeFpCamera();
    else this.placeIsoCamera();
    this.scene.fog = first ? this.fog : null;
    // Le faisceau sert de repère en première personne ; vu de dessus (iso), il gênerait.
    this.beacon.visible = first;
    this.beacon.rotation.y = performance.now() / 4000;

    // Personnage : visible en vue isométrique, la main en première personne.
    this.avatar.visible = !first;
    this.hand.visible = first;
    this.avatar.position.set(this.player.x, this.player.z, this.player.y);
    this.avatar.rotation.y = -this.yaw + Math.PI / 2;
    const swingLegs = Math.sin(this.walkPhase) * 0.6;
    const [legL, legR, armL, armR] = this.avatar.userData.limbs as THREE.Object3D[];
    legL!.rotation.x = swingLegs;
    legR!.rotation.x = -swingLegs;
    armL!.rotation.x = -swingLegs * 0.8;
    // Coup : bras levé puis abattu (a > 0 : levé, a < 0 : frappé), petit geste pour poser.
    const a = this.strike > 0 ? strikeAngle(this.strike) : -0.35 * Math.sin(this.jab * Math.PI);
    const busy = this.strike > 0 || this.jab > 0;
    armR!.rotation.x = busy ? -0.9 - a * 1.3 : swingLegs * 0.8;
    const held = this.inv.held();
    const tool = held !== null ? itemDef(held)?.tool : undefined;
    const { arm, cube, pick } = this.handParts;
    arm.visible = held === null;
    cube.visible = held !== null && !tool;
    pick.visible = !!tool;
    if (cube.visible)
      (cube.material as THREE.MeshBasicMaterial).color.set(itemDef(held!)?.color ?? '#fff');
    if (tool)
      ((pick.userData.head as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(
        itemDef(held!)!.color,
      );
    // Repos : légèrement penché ; le coup fait tourner le poignet vers l'avant.
    this.hand.rotation.set(-0.35 - a * 0.9, 0.35, 0.15);
    const bob =
      Math.hypot(this.move.x, this.move.y) + (this.keys.size ? 1 : 0) > 0 && this.player.onGround;
    this.hand.position.y = -0.5 + (bob ? Math.sin(this.walkPhase * 2) * 0.012 : 0);

    const t = this.target;
    this.outline.visible = !!t;
    this.crack.visible = !!t && this.progress > 0;
    this.ghost.visible = false;
    if (t) {
      this.outline.position.set(t.cell.x + 0.5, t.cell.z + 0.5, t.cell.y + 0.5);
      this.crack.position.copy(this.outline.position);
      (this.crack.material as THREE.MeshBasicMaterial).opacity = 0.15 + this.progress * 0.5;
      const wantsPlace = !first && this.touchTool === 'place';
      if (wantsPlace && held !== null && itemDef(held)?.block) {
        this.ghost.visible = true;
        this.ghost.position.set(t.before.x + 0.5, t.before.z + 0.5, t.before.y + 0.5);
      }
    }
    this.renderDrops();
    this.renderer.render(this.scene, cam);
  }

  private resize = () => {
    const r = this.container.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height);
    this.fpCam.aspect = r.width / Math.max(1, r.height);
    this.fpCam.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ monde partagé

  /** Arrivée (ou retour après une coupure) : on repart de ce que dit le serveur. */
  welcome(x: number, y: number, z: number, inv: ReadonlyArray<readonly [number, number]>): void {
    this.world.reset();
    this.inv.setCounts(inv);
    Object.assign(this.player, { x, y, z, vz: 0 });
    this.drops = [];
    this.clearPeers();
    this.relight = true;
    this.events.changed();
  }

  /** Modifications d'une tranche envoyées par le serveur (à l'arrivée). */
  applyChunk(ci: number, changes: ReadonlyMap<number, number>): void {
    this.world.setChunkChanges(ci, changes);
    this.relight = true;
  }

  /** Cases changées (par soi, confirmé, ou par un autre joueur ; ou refus : état réel). */
  applySet(entries: readonly number[]): void {
    for (let k = 0; k + 1 < entries.length; k += 2) {
      const index = entries[k]!;
      const block = entries[k + 1]!;
      const c = this.world.cellOf(index);
      const before = this.world.get(c.x, c.y, c.z);
      if (before === block) continue;
      this.world.write(index, block, false);
      // Un autre joueur casse un cube près de soi : on voit les éclats.
      const near = Math.hypot(c.x - this.player.x, c.y - this.player.y) < 24;
      if (block === AIR && near) this.burst(c, blockDef(before).color);
      this.changedCell(c);
    }
  }

  /** Le sac tel que le garde le serveur. */
  setInventory(stacks: ReadonlyArray<readonly [number, number]>): void {
    this.inv.setCounts(stacks);
    this.events.changed();
  }

  /** Le serveur replace le joueur (départ, déplacement refusé). */
  teleport(x: number, y: number, z: number): void {
    Object.assign(this.player, { x, y, z, vz: 0 });
  }

  /** Un joueur arrive (ou se présente à nouveau). */
  peerJoin(p: SharedPeer): void {
    const known = this.peers.get(p.id);
    if (known) {
      known.target = { x: p.x, y: p.y, z: p.z, a: p.a };
      return;
    }
    const body = makeAvatar(peerColors(p.id));
    const label = makeLabel(p.name, p.v);
    label.position.y = 2.35;
    body.add(label);
    body.position.set(p.x, p.z, p.y);
    this.scene.add(body);
    this.peers.set(p.id, { name: p.name, body, label, target: { ...p }, phase: 0 });
  }

  peerMove(id: string, x: number, y: number, z: number, a: number): void {
    const peer = this.peers.get(id);
    if (peer) peer.target = { x, y, z, a };
  }

  peerLeft(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.scene.remove(peer.body);
    (peer.label.material as THREE.SpriteMaterial).map?.dispose();
    this.peers.delete(id);
  }

  clearPeers(): void {
    for (const id of [...this.peers.keys()]) this.peerLeft(id);
  }

  /** Joueurs visibles (et leur pseudo), pour l'interface et les tests. */
  peerNames(): string[] {
    return [...this.peers.values()].map((p) => p.name);
  }

  /** Dernières positions connues des autres joueurs (tests de bout en bout). */
  peerPositions(): Array<{ name: string; x: number; y: number; z: number }> {
    return [...this.peers.values()].map((p) => ({ name: p.name, ...p.target }));
  }

  /** Les autres joueurs glissent vers leur dernière position connue et marchent. */
  private updatePeers(dt: number): void {
    const k = 1 - Math.exp(-dt * 12);
    for (const peer of this.peers.values()) {
      const b = peer.body;
      const t = peer.target;
      const dx = t.x - b.position.x;
      const dy = t.y - b.position.z;
      const moving = Math.hypot(dx, dy) > 0.05;
      b.position.set(
        b.position.x + dx * k,
        b.position.y + (t.z - b.position.y) * k,
        b.position.z + dy * k,
      );
      b.rotation.y = -t.a + Math.PI / 2;
      peer.phase = moving ? peer.phase + dt * 9 : 0;
      const swing = Math.sin(peer.phase) * 0.6;
      const [legL, legR, armL, armR] = b.userData.limbs as THREE.Object3D[];
      legL!.rotation.x = swing;
      legR!.rotation.x = -swing;
      armL!.rotation.x = -swing * 0.8;
      armR!.rotation.x = swing * 0.8;
    }
  }

  /** Chiffres pour le panneau des mesures (prototype). */
  stats(): { fps: number; triangles: number; calls: number } {
    return {
      fps: this.fps,
      triangles: this.renderer.info.render.triangles,
      calls: this.renderer.info.render.calls,
    };
  }

  dispose(): void {
    this.running = false;
    this.clearPeers();
    this.save();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function toMesh(d: MeshData, material: THREE.Material): THREE.Mesh | null {
  if (d.faces === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(d.colors, 3));
  g.setIndex(d.indices);
  g.computeBoundingSphere();
  return new THREE.Mesh(g, material);
}

/** Bras (mains nues), petit cube ou pioche, vus en première personne. */
function makeHand(): { arm: THREE.Mesh; cube: THREE.Mesh; pick: THREE.Group } {
  const mat = (c: string) => new THREE.MeshBasicMaterial({ color: c });
  const armGeo = new THREE.BoxGeometry(0.13, 0.13, 0.52);
  armGeo.translate(0, 0, 0.1);
  const arm = new THREE.Mesh(armGeo, mat('#f1c9a5'));
  arm.rotation.x = -0.5;
  const cubeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  cubeGeo.translate(0, 0.12, -0.06);
  const cube = new THREE.Mesh(cubeGeo, mat('#ffffff'));
  cube.rotation.y = 0.6;
  const pick = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.05), mat('#8a5a36'));
  handle.position.y = 0.16;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.08), mat('#8b93a6'));
  head.position.y = 0.38;
  const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.08), head.material);
  tipL.position.set(-0.17, 0.34, 0);
  const tipR = tipL.clone();
  tipR.position.x = 0.17;
  pick.add(handle, head, tipL, tipR);
  pick.userData.head = head;
  pick.rotation.set(0, 0, -0.35);
  pick.scale.setScalar(0.55);
  pick.position.set(0.02, -0.02, -0.04);
  return { arm, cube, pick };
}

interface AvatarColors {
  jacket: string;
  sleeve: string;
  hair: string;
}

const PEER_COLORS: readonly AvatarColors[] = [
  { jacket: '#ff8a6a', sleeve: '#d96a4c', hair: '#2b1d16' },
  { jacket: '#6c8cff', sleeve: '#4f6bd6', hair: '#d9b27a' },
  { jacket: '#ffc857', sleeve: '#d9a63c', hair: '#5a3a26' },
  { jacket: '#b58cff', sleeve: '#8f69d6', hair: '#1d1d24' },
  { jacket: '#5fd38a', sleeve: '#43a86a', hair: '#8a4b2a' },
  { jacket: '#ff7fb6', sleeve: '#d65f93', hair: '#3b2a20' },
];

/** Couleurs d'un autre joueur, toujours les mêmes pour lui. */
function peerColors(id: string): AvatarColors {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length]!;
}

/** Pseudo au-dessus d'un joueur (dessiné dans une image : aucun HTML). */
function makeLabel(name: string, verified: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '600 30px system-ui, sans-serif';
    const text = verified ? name : `${name} (visiteur)`;
    const w = Math.min(248, ctx.measureText(text).width + 24);
    ctx.fillStyle = 'rgba(20, 26, 43, 0.72)';
    ctx.beginPath();
    ctx.roundRect((256 - w) / 2, 10, w, 44, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33, 232);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

/** Petit Malino en cubes (vue isométrique) : jambes, veste turquoise, tête et cheveux. */
function makeAvatar(
  colors: AvatarColors = { jacket: '#22b5a6', sleeve: '#1f9284', hair: '#3b2a20' },
): THREE.Group {
  const g = new THREE.Group();
  const mat = (c: string) => new THREE.MeshBasicMaterial({ color: c });
  const box = (w: number, h: number, d: number, c: string) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  const limb = (x: number, y: number, w: number, h: number, c: string) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = box(w, h, w, c);
    m.position.y = -h / 2;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };
  const legL = limb(-0.13, 0.75, 0.24, 0.75, '#2a3150');
  const legR = limb(0.13, 0.75, 0.24, 0.75, '#2a3150');
  const body = box(0.56, 0.62, 0.32, colors.jacket);
  body.position.y = 1.06;
  g.add(body);
  const armL = limb(-0.37, 1.34, 0.18, 0.6, colors.sleeve);
  const armR = limb(0.37, 1.34, 0.18, 0.6, colors.sleeve);
  const head = box(0.46, 0.44, 0.44, '#f1c9a5');
  head.position.y = 1.6;
  const hair = box(0.5, 0.16, 0.48, colors.hair);
  hair.position.y = 1.86;
  const eyeL = box(0.07, 0.07, 0.02, '#141a2b');
  eyeL.position.set(-0.1, 1.62, 0.23);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  g.add(head, hair, eyeL, eyeR);
  g.userData.limbs = [legL, legR, armL, armR];
  return g;
}
