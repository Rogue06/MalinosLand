/**
 * « Chantier des mondes » à plusieurs : survie partagée (DEC-045), protections et modération
 * (DEC-048). Logique pure, sans Cloudflare, testée comme le reste du jeu
 * (tests/chantier-server.test.ts). Le Durable Object (ChantierRoom.ts) ne fait que brancher les
 * WebSockets et le stockage sur cette classe.
 *
 * Le serveur décide de tout, le navigateur ne fait que demander :
 * - un seul monde pour tous ; le terrain de départ est recalculé à l'identique à partir de la
 *   graine, tranche par tranche et seulement là où l'on joue (≈ 5 ms par tranche) ; seules les
 *   modifications sont gardées ;
 * - casser, poser et fabriquer sont vérifiés avec les règles du jeu (`src/sandbox/`) : zone
 *   protégée, portée, temps pour casser selon l'outil, objets réellement dans le sac, atelier à
 *   côté ; le sac de chaque compte est gardé par le serveur ;
 * - un compte connecté construit pour de bon et peut protéger sa maison avec une borne ; un
 *   visiteur sans compte construit aussi, mais tout ce qu'il a changé revient à son départ ;
 * - une zone sans visite ni modification pendant deux semaines perd sa protection, puis se défait
 *   petit à petit ; quand trop de cubes ont été retirés, les trous de surface se referment peu à
 *   peu (les galeries restent) ;
 * - les modérateurs annulent les actions d'un joueur et peuvent l'exclure une heure ;
 * - déplacements trop rapides refusés (le joueur est replacé), limites de débit, plafond de
 *   joueurs, budget quotidien de messages sous le quota gratuit.
 */
import { AIR, BORNE, breakTime, dropOf } from '../../src/sandbox/blocks';
import { Inventory, RECIPES, stationsNear } from '../../src/sandbox/inventory';
import { occupies, SPRINT_SPEED } from '../../src/sandbox/player';
import { useItem } from '../../src/sandbox/rules';
import {
  decodeUp,
  encode,
  packChunk,
  toBase64,
  unpackChunk,
  type Down,
  type Refusal,
  type SharedNotice,
  type SharedPeer,
  type Stack,
  type Up,
} from '../../src/sandbox/protocol';
import {
  CHUNK,
  CHUNKS_X,
  CHUNKS_Y,
  MAX_EDITS,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  VoxelWorld,
  columnHeight,
} from '../../src/sandbox/world';
import {
  ZONE_RADIUS,
  ZONE_TTL,
  blockingZone,
  parseZones,
  zoneAt,
  zoneProblem,
  type Zone,
} from '../../src/sandbox/zones';
import { accountPlayerId } from '../../src/multiplayer/protocol';
import {
  CLOSE_CODES,
  RATE_BY_LEVEL,
  take,
  type Account,
  type Bucket,
  type QuotaCounter,
} from './hub';

/** Graine du monde partagé (la même que le monde solo : on y retrouve ses repères). */
export const SHARED_SEED = 1;
/** Portée des mains vérifiée par le serveur (un peu plus large que dans le jeu : latence). */
export const SERVER_REACH = 8;
/** Temps de creusage gardé en réserve au plus (s) : on ne casse pas vingt cubes d'un coup. */
export const CREDIT_MAX = 5;
/** Part du temps de creusage exigée (le réseau peut rapprocher deux demandes). */
export const CREDIT_COST = 0.7;
/** Un visiteur sans compte change au plus ce nombre de cases (tout revient à son départ). */
export const GUEST_MAX_CHANGES = 60;
/** Actions gardées par joueur, pour que les modérateurs puissent les annuler. */
export const LOG_MAX = 400;
/** Les modérateurs annulent la dernière heure d'actions ; une exclusion dure une heure. */
export const UNDO_WINDOW = 3600 * 1000;
export const BAN_TIME = 3600 * 1000;
/** Entretien du monde (zones expirées, trous de surface) : une fois par heure. */
export const MAINTENANCE_EVERY = 3600 * 1000;
/** Cases défaites par heure dans une zone dont la protection est tombée. */
export const DECAY_PER_TICK = 40;
/** Au-delà de ce nombre de cubes retirés du monde, les trous de surface se referment… */
export const REGEN_THRESHOLD = 4000;
/** … à ce rythme (cases par heure), dans les tranches que personne n'a touchées depuis… */
export const REGEN_PER_TICK = 80;
/** … deux jours. */
export const REGEN_IDLE = 2 * 24 * 3600 * 1000;
/**
 * Écritures espacées (quota gratuit : 100 000 lignes écrites par jour). Les cubes sont enregistrés
 * en quelques secondes ; le sac d'un compte toutes les 2 minutes et à son départ (il est aussi
 * gardé avec la connexion) ; les journaux d'actions toutes les minutes (visiteur) ou 3 (compte).
 */
export const PLAYER_SAVE_EVERY = 120 * 1000;
export const GUEST_LOG_EVERY = 60 * 1000;
export const ACCOUNT_LOG_EVERY = 180 * 1000;
/** Une zone n'est « revisitée » qu'une fois par heure (moins d'écritures). */
const ACTIVITY_STEP = 3600 * 1000;
const MSG_CAPACITY = 40;
const MSG_REFILL = 20;
const MAX_STRIKES = 30;
/** Cases par message « set » (le navigateur en accepte 32). */
const SET_BATCH = 32;

/** Une action gardée : date (s), case, cube avant, cube après. */
export type LogEntry = [t: number, index: number, before: number, after: number];

/** Données d'une connexion, enregistrées avec la WebSocket (survivent à la mise en veille). */
export interface ChantierData {
  key: string;
  account: Account | null;
  /** Fixé à la présentation (« hi »). */
  id: string | null;
  name: string;
  x: number;
  y: number;
  z: number;
  a: number;
  movedAt: number;
  inv: Stack[];
  /** Temps de creusage accumulé (s) et date de la dernière mise à jour. */
  credit: number;
  creditAt: number;
  messages: Bucket;
  strikes: number;
  /** Présentation en cours (sac du compte en lecture). */
  loading: boolean;
}

export interface ChantierConn {
  data: ChantierData;
  send(payload: string): void;
  close(code: number, reason: string): void;
  save(): void;
}

/** Ce que le serveur garde d'un compte : son sac et sa position. */
export interface PlayerSave {
  inv: Stack[];
  x: number;
  y: number;
  z: number;
}

/** État général gardé en une seule ligne : zones, zones qui se défont, exclusions, activité. */
export interface SharedState {
  zones: Zone[];
  /** Zones dont la protection est tombée : elles se défont petit à petit. */
  fading: Array<{ x: number; y: number }>;
  /** Exclusions en cours : identifiant → fin (ms). */
  bans: Array<[string, number]>;
  /** Dernière modification par un joueur, par tranche (ms). */
  touched: Array<[number, number]>;
}

export interface ChantierOptions {
  now(): number;
  maxPlayers: number;
  dailyBudget: number;
  quota: QuotaCounter;
  /** Lit la sauvegarde d'un compte (null : nouveau joueur). */
  loadPlayer(id: string): Promise<PlayerSave | null>;
  /** Lit le journal d'actions enregistré d'un joueur (vide s'il n'y en a pas). */
  loadLog(id: string): Promise<LogEntry[]>;
  /** Quelque chose est à enregistrer : le Durable Object appellera `flush` sous peu. */
  dirty(): void;
}

export function newChantierData(
  key: string,
  now: number,
  account: Account | null = null,
): ChantierData {
  return {
    key,
    account,
    id: null,
    name: '',
    x: 0,
    y: 0,
    z: 0,
    a: 0,
    movedAt: now,
    inv: [],
    credit: 0,
    creditAt: now,
    messages: { tokens: MSG_CAPACITY, at: now },
    strikes: 0,
    loading: false,
  };
}

/** Relit une sauvegarde de joueur prudemment. */
export function parsePlayerSave(raw: unknown): PlayerSave | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const ok = (v: unknown, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= hi;
  if (!ok(r.x, SIZE_X) || !ok(r.y, SIZE_Y) || !ok(r.z, SIZE_Z + 4)) return null;
  const inv = Inventory.parse({ counts: r.inv }).stacks();
  return { inv, x: r.x as number, y: r.y as number, z: r.z as number };
}

const CELLS = SIZE_X * SIZE_Y * SIZE_Z;
const isInt = (v: unknown, lo: number, hi: number): v is number =>
  Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** Relit un journal d'actions prudemment. */
export function parseLog(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-LOG_MAX)
    .filter(
      (e): e is LogEntry =>
        Array.isArray(e) &&
        e.length === 4 &&
        isInt(e[0], 0, 2 ** 40) &&
        isInt(e[1], 0, CELLS - 1) &&
        isInt(e[2], 0, 255) &&
        isInt(e[3], 0, 255),
    );
}

/** Relit l'état général prudemment. */
export function parseState(raw: unknown): SharedState {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const pairs = (v: unknown) => (Array.isArray(v) ? v.slice(0, 2000) : []);
  return {
    zones: parseZones(r.zones),
    fading: pairs(r.fading).filter(
      (f): f is { x: number; y: number } =>
        typeof f === 'object' &&
        f !== null &&
        isInt((f as Record<string, unknown>).x, 0, SIZE_X - 1) &&
        isInt((f as Record<string, unknown>).y, 0, SIZE_Y - 1),
    ),
    bans: pairs(r.bans).filter(
      (b): b is [string, number] =>
        Array.isArray(b) &&
        typeof b[0] === 'string' &&
        /^[a-z0-9]{8,40}$/.test(b[0]) &&
        typeof b[1] === 'number',
    ),
    touched: pairs(r.touched).filter(
      (t): t is [number, number] =>
        Array.isArray(t) && isInt(t[0], 0, CHUNKS_X * CHUNKS_Y - 1) && typeof t[1] === 'number',
    ),
  };
}

export class ChantierHub {
  readonly world = new VoxelWorld(SHARED_SEED);
  zones: Zone[];
  private fading: Array<{ x: number; y: number }>;
  private readonly bans: Map<string, number>;
  private readonly touched: Map<number, number>;
  private readonly logs = new Map<string, LogEntry[]>();
  private readonly dirtyChunks = new Set<number>();
  private readonly dirtyPlayers = new Map<string, PlayerSave>();
  private readonly dirtyLogs = new Set<string>();
  private readonly droppedLogs = new Set<string>();
  /** Dernier enregistrement d'un sac (« p:… ») ou d'un journal (« l:… »), et départs à enregistrer. */
  private readonly savedAt = new Map<string, number>();
  private readonly urgent = new Set<string>();
  private stateDirty = false;
  private lastLevel = 0;

  /**
   * `chunks` : modifications enregistrées (tranche → binaire compact) ; `state` : zones,
   * exclusions et activité, relus au réveil.
   */
  constructor(
    private readonly connections: () => ChantierConn[],
    private readonly opts: ChantierOptions,
    chunks: Iterable<[number, Uint8Array]> = [],
    state: SharedState = parseState(null),
  ) {
    for (const [ci, bytes] of chunks) {
      const m = unpackChunk(ci, bytes);
      if (m) this.world.setChunkChanges(ci, m);
    }
    this.zones = state.zones;
    this.fading = state.fading;
    this.bans = new Map(state.bans);
    this.touched = new Map(state.touched);
  }

  // ------------------------------------------------------------------ quotas et admission

  level(): 0 | 1 | 2 | 3 {
    const usage = this.opts.quota.count(this.opts.now()) / this.opts.dailyBudget;
    if (usage >= 1) return 3;
    if (usage >= 0.9) return 2;
    if (usage >= 0.7) return 1;
    return 0;
  }

  /** Une nouvelle connexion peut-elle entrer ? */
  admission(): SharedNotice | null {
    if (this.level() >= 3) return 'maintenance';
    return this.players().length >= this.opts.maxPlayers ? 'full' : null;
  }

  private players(): ChantierConn[] {
    return this.connections().filter((c) => c.data.id !== null);
  }

  private others(conn: ChantierConn): ChantierConn[] {
    return this.players().filter((c) => c.data.key !== conn.data.key);
  }

  /** Identifiants des joueurs présents (le Durable Object nettoie les journaux des absents). */
  presentIds(): Set<string> {
    return new Set(this.players().map((c) => c.data.id!));
  }

  private send(targets: ChantierConn[], msg: Down): void {
    const payload = encode(msg);
    for (const t of targets) t.send(payload);
  }

  private reject(conn: ChantierConn, code: SharedNotice): void {
    conn.send(encode({ t: 'notice', code }));
    conn.close(CLOSE_CODES[code], code);
  }

  private strike(conn: ChantierConn): void {
    conn.data.strikes++;
    conn.save();
    if (conn.data.strikes > MAX_STRIKES) conn.close(CLOSE_CODES.abuse, 'abus');
  }

  private updateLevel(): void {
    const level = this.level();
    if (level === this.lastLevel) return;
    this.lastLevel = level;
    if (level >= 3) {
      // Budget du jour épuisé : tout le monde repasse en solo jusqu'à demain.
      for (const c of this.connections()) this.reject(c, 'maintenance');
      return;
    }
    const ms = RATE_BY_LEVEL[level];
    if (ms > 0) this.send(this.players(), { t: 'rate', ms });
  }

  // ------------------------------------------------------------------ messages

  onMessage(conn: ChantierConn, raw: string | ArrayBuffer): void {
    const now = this.opts.now();
    this.opts.quota.add(now, 1);
    this.updateLevel();
    if (this.lastLevel >= 3) return;
    const d = conn.data;
    if (typeof raw !== 'string' || !take(d.messages, MSG_CAPACITY, MSG_REFILL, now)) {
      return this.strike(conn);
    }
    const msg = decodeUp(raw);
    if (!msg) return this.strike(conn);
    if (msg.t === 'hi') {
      if (d.id === null && !d.loading) void this.hello(conn, msg.name);
      return;
    }
    if (d.id === null) return;
    switch (msg.t) {
      case 'mv':
        return this.move(conn, msg, now);
      case 'dig':
        return this.dig(conn, msg, now);
      case 'put':
        return this.put(conn, msg);
      case 'craft':
        return this.craft(conn, msg.r);
      case 'use':
        return this.use(conn, msg);
      case 'home':
        return this.home(conn);
      case 'mod':
        void this.moderate(conn, msg);
        return;
    }
  }

  /** Départ d'un joueur. Un visiteur sans compte : tout ce qu'il a changé revient. */
  async onClose(conn: ChantierConn): Promise<void> {
    const d = conn.data;
    if (d.id === null) return;
    const id = d.id;
    this.send(this.others(conn), { t: 'left', id });
    if (d.account) {
      this.remember(d);
      this.urgent.add(id);
    }
    d.id = null;
    conn.save();
    if (!d.account) await this.revertGuest(id);
  }

  /** Remet le monde comme avant le passage d'un visiteur (journal en mémoire ou enregistré). */
  async revertGuest(id: string): Promise<number> {
    const entries = this.logs.get(id) ?? (await this.opts.loadLog(id).catch(() => []));
    const changes = this.revertEntries(entries, 0);
    this.logs.delete(id);
    this.dirtyLogs.delete(id);
    this.droppedLogs.add(id);
    this.opts.dirty();
    if (changes.length > 0) this.commit(changes);
    return changes.length / 2;
  }

  /**
   * Données à enregistrer depuis le dernier appel (puis oubliées). Les sacs et les journaux
   * attendent leur tour (voir PLAYER_SAVE_EVERY…) ; `pending` : il en reste à enregistrer plus
   * tard. `all` : tout, tout de suite.
   */
  flush(all = false): {
    chunks: Map<number, Uint8Array>;
    players: Map<string, PlayerSave>;
    logs: Map<string, LogEntry[]>;
    droppedLogs: string[];
    state: SharedState | null;
    pending: boolean;
  } {
    const now = this.opts.now();
    const due = (key: string, every: number, id: string) =>
      all || this.urgent.has(id) || now - (this.savedAt.get(key) ?? -Infinity) >= every;
    const chunks = new Map<number, Uint8Array>();
    for (const ci of this.dirtyChunks) chunks.set(ci, packChunk(ci, this.world.chunkChanges(ci)));
    const players = new Map<string, PlayerSave>();
    for (const [id, save] of this.dirtyPlayers)
      if (due(`p:${id}`, PLAYER_SAVE_EVERY, id)) {
        players.set(id, save);
        this.savedAt.set(`p:${id}`, now);
        this.dirtyPlayers.delete(id);
      }
    const logs = new Map<string, LogEntry[]>();
    for (const id of this.dirtyLogs) {
      const every = id.startsWith('g') ? GUEST_LOG_EVERY : ACCOUNT_LOG_EVERY;
      if (!due(`l:${id}`, every, id)) continue;
      logs.set(id, this.logs.get(id) ?? []);
      this.savedAt.set(`l:${id}`, now);
      this.dirtyLogs.delete(id);
    }
    const droppedLogs = [...this.droppedLogs];
    const state = this.stateDirty ? this.state() : null;
    this.dirtyChunks.clear();
    this.droppedLogs.clear();
    this.urgent.clear();
    this.stateDirty = false;
    return {
      chunks,
      players,
      logs,
      droppedLogs,
      state,
      pending: this.dirtyPlayers.size + this.dirtyLogs.size > 0,
    };
  }

  state(): SharedState {
    return {
      zones: this.zones,
      fading: this.fading,
      bans: [...this.bans],
      touched: [...this.touched],
    };
  }

  private markState(): void {
    this.stateDirty = true;
    this.opts.dirty();
  }

  private remember(d: ChantierData): void {
    if (!d.account || !d.id) return;
    this.dirtyPlayers.set(d.id, { inv: d.inv, x: d.x, y: d.y, z: d.z });
    this.opts.dirty();
  }

  private peerOf(d: ChantierData): SharedPeer {
    return { id: d.id!, name: d.name, v: !!d.account, x: d.x, y: d.y, z: d.z, a: d.a };
  }

  private async hello(conn: ChantierConn, guestName: string): Promise<void> {
    const d = conn.data;
    const id = d.account
      ? accountPlayerId(d.account.id)
      : `g${d.key.replace(/-/g, '')}`.slice(0, 16);
    if (!id) return this.reject(conn, 'duplicate');
    const now = this.opts.now();
    if ((this.bans.get(id) ?? 0) > now) return this.reject(conn, 'kicked');
    let save: PlayerSave = { inv: [], ...this.arrival() };
    if (d.account) {
      // Même compte déjà là (autre onglet) : la nouvelle connexion le remplace et reprend son
      // sac tel qu'il est (il n'est peut-être pas encore enregistré).
      const holder = this.others(conn).find((c) => c.data.id === id);
      if (holder) {
        save = { inv: holder.data.inv, x: holder.data.x, y: holder.data.y, z: holder.data.z };
        holder.data.id = null;
        holder.save();
        this.reject(holder, 'duplicate');
      } else {
        d.loading = true;
        conn.save();
        const stored = await this.opts.loadPlayer(id).catch(() => null);
        if (stored) save = stored;
        // Parti pendant la lecture : rien à annoncer.
        if (!this.connections().some((c) => c.data.key === d.key)) return;
      }
      // Une visite renouvelle la protection de ses zones.
      let renewed = false;
      for (const z of this.zones)
        if (z.owner === id && now - z.active > ACTIVITY_STEP) {
          z.active = now;
          renewed = true;
        }
      if (renewed) this.markState();
    }
    Object.assign(d, {
      id,
      name: d.account?.name ?? guestName,
      inv: d.account ? save.inv : [],
      x: save.x,
      y: save.y,
      z: save.z,
      movedAt: now,
      creditAt: now,
      credit: 0,
      loading: false,
    });
    conn.save();
    this.send([conn], {
      t: 'welcome',
      id,
      name: d.name,
      build: true,
      guest: !d.account,
      staff: !!d.account?.staff,
      inv: d.inv,
      x: d.x,
      y: d.y,
      z: d.z,
      peers: this.others(conn).map((c) => this.peerOf(c.data)),
    });
    this.send([conn], { t: 'zones', z: this.zones });
    for (const ci of this.world.changedChunks())
      this.send([conn], {
        t: 'chunk',
        c: ci,
        d: toBase64(packChunk(ci, this.world.chunkChanges(ci))),
      });
    const ms = RATE_BY_LEVEL[this.level()];
    if (ms > 0) this.send([conn], { t: 'rate', ms });
    this.send(this.others(conn), { t: 'join', ...this.peerOf(d) });
  }

  private move(conn: ChantierConn, m: Extract<Up, { t: 'mv' }>, now: number): void {
    const d = conn.data;
    const dt = Math.min(1, Math.max(0.05, (now - d.movedAt) / 1000));
    const horizontal = Math.hypot(m.x - d.x, m.y - d.y);
    const up = m.z - d.z;
    if (horizontal > SPRINT_SPEED * 1.3 * dt + 1.5 || up > 10 * dt + 1.5) {
      // Trop rapide (ou téléportation) : le joueur est replacé là où le serveur l'a vu.
      d.movedAt = now;
      conn.save();
      return this.send([conn], { t: 'pos', x: d.x, y: d.y, z: d.z });
    }
    Object.assign(d, { x: m.x, y: m.y, z: m.z, a: m.a, movedAt: now });
    conn.save();
    this.send(this.others(conn), { t: 'p', id: d.id!, x: m.x, y: m.y, z: m.z, a: m.a });
    this.warm(d);
  }

  /** Prépare une tranche autour du joueur (au plus une par message : temps de calcul limité). */
  private warm(d: ChantierData): void {
    const cx = Math.floor(d.x / CHUNK);
    const cy = Math.floor(d.y / CHUNK);
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++) {
        if (x < 0 || y < 0 || x >= CHUNKS_X || y >= CHUNKS_Y || this.world.isGenerated(x, y))
          continue;
        this.world.ensureChunk(x, y);
        return;
      }
  }

  /** Une place sur la dalle de départ (3 × 3 cases dégagées) : on n'arrive pas les uns dans les autres. */
  private arrival(): { x: number; y: number; z: number } {
    const s = this.world.spawn;
    const spread = () => Math.round((Math.random() * 2 - 1) * 80) / 100;
    return { x: s.x + 0.5 + spread(), y: s.y + 0.5 + spread(), z: s.z };
  }

  private home(conn: ChantierConn): void {
    const d = conn.data;
    Object.assign(d, { ...this.arrival(), movedAt: this.opts.now() });
    conn.save();
    this.send([conn], { t: 'pos', x: d.x, y: d.y, z: d.z });
    this.send(this.others(conn), { t: 'p', id: d.id!, x: d.x, y: d.y, z: d.z, a: d.a });
  }

  private inReach(d: ChantierData, index: number): boolean {
    const c = this.world.cellOf(index);
    return Math.hypot(c.x + 0.5 - d.x, c.y + 0.5 - d.y, c.z + 0.5 - (d.z + 1.6)) <= SERVER_REACH;
  }

  /** Refus : la raison, et l'état réel de la case (le navigateur annule ce qu'il a prévu). */
  private refuse(conn: ChantierConn, why: Refusal, index?: number, who?: string): void {
    this.send([conn], { t: 'no', why, ...(who ? { who } : {}) });
    if (index !== undefined) {
      const c = this.world.cellOf(index);
      this.send([conn], { t: 'set', e: [index, this.world.get(c.x, c.y, c.z)] });
    }
    this.send([conn], { t: 'inv', c: conn.data.inv });
  }

  /**
   * Contrôles communs avant de changer la case `index` : portée, zone protégée, limite d'un
   * visiteur, place dans le monde. Renvoie true si l'action est refusée (le refus est envoyé).
   */
  private denied(conn: ChantierConn, index: number): boolean {
    const d = conn.data;
    const c = this.world.cellOf(index);
    const zone = blockingZone(this.zones, this.actor(d), c.x, c.y);
    const why: Refusal | null = !this.inReach(d, index)
      ? 'far'
      : zone
        ? 'zone'
        : !d.account && (this.logs.get(d.id!)?.length ?? 0) >= GUEST_MAX_CHANGES
          ? 'limit'
          : !this.roomForEdit()
            ? 'full'
            : null;
    if (why) this.refuse(conn, why, index, zone?.name);
    return why !== null;
  }

  private actor(d: ChantierData): { id: string; staff: boolean } {
    return { id: d.id!, staff: !!d.account?.staff };
  }

  private bag(d: ChantierData): Inventory {
    const inv = new Inventory();
    inv.setCounts(d.inv);
    return inv;
  }

  /** Le monde accepte-t-il encore une modification ? */
  private roomForEdit(): boolean {
    return this.world.editCount < MAX_EDITS;
  }

  /** État de quelques cases avant une action (pour le journal et l'annonce). */
  private snapshot(indices: number[]): Map<number, number> {
    const out = new Map<number, number>();
    for (const i of indices) {
      if (i < 0 || i >= CELLS) continue;
      const c = this.world.cellOf(i);
      out.set(i, this.world.get(c.x, c.y, c.z));
    }
    return out;
  }

  /**
   * Après une action d'un joueur : cases réellement changées, journal (annulation par un
   * modérateur, départ d'un visiteur), activité des zones, annonce à tous.
   */
  private finish(conn: ChantierConn, before: Map<number, number>): void {
    const d = conn.data;
    const now = this.opts.now();
    const changes: number[] = [];
    let log = this.logs.get(d.id!);
    if (!log) this.logs.set(d.id!, (log = []));
    for (const [i, b] of before) {
      const c = this.world.cellOf(i);
      const after = this.world.get(c.x, c.y, c.z);
      if (after === b) continue;
      changes.push(i, after);
      log.push([Math.floor(now / 1000), i, b, after]);
      this.touched.set(this.world.chunkOf(i), now);
      // Modifier sa propre zone la garde protégée.
      const zone = zoneAt(this.zones, c.x, c.y);
      if (zone && zone.owner === d.id && now - zone.active > ACTIVITY_STEP) zone.active = now;
    }
    // Un compte garde ses dernières actions ; un visiteur toutes (elles seront défaites).
    if (d.account && log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
    this.dirtyLogs.add(d.id!);
    this.stateDirty = true;
    if (changes.length > 0) this.commit(changes);
  }

  /** Change des cases : enregistrement prévu et annonce à tout le monde (par petits lots). */
  private commit(changes: number[]): void {
    for (let i = 0; i < changes.length; i += 2)
      this.dirtyChunks.add(this.world.chunkOf(changes[i]!));
    this.world.clearUndo();
    this.opts.dirty();
    const all = this.players();
    for (let i = 0; i < changes.length; i += SET_BATCH * 2)
      this.send(all, { t: 'set', e: changes.slice(i, i + SET_BATCH * 2) });
    // Une borne disparue (cassée, annulée, défaite) : sa zone aussi.
    this.syncZones();
  }

  /** Retire les zones dont la borne n'est plus là, et prévient tout le monde. */
  private syncZones(): void {
    const kept = this.zones.filter((z) => this.world.get(z.x, z.y, z.z) === BORNE);
    if (kept.length === this.zones.length) return;
    this.zones = kept;
    this.markState();
    this.send(this.players(), { t: 'zones', z: this.zones });
  }

  private dig(conn: ChantierConn, m: Extract<Up, { t: 'dig' }>, now: number): void {
    const d = conn.data;
    if (this.denied(conn, m.i)) return;
    const c = this.world.cellOf(m.i);
    if (this.world.breakProblem(c.x, c.y, c.z)) return this.refuse(conn, 'rule', m.i);
    const inv = this.bag(d);
    const held = m.h !== 0 && inv.has(m.h) ? m.h : null;
    const block = this.world.get(c.x, c.y, c.z);
    // Temps pour casser selon l'outil : le joueur doit l'avoir « mérité ».
    d.credit = Math.min(CREDIT_MAX, d.credit + Math.max(0, now - d.creditAt) / 1000);
    d.creditAt = now;
    const cost = breakTime(block, held) * CREDIT_COST;
    if (d.credit < cost) {
      conn.save();
      return this.refuse(conn, 'fast', m.i);
    }
    d.credit -= cost;
    const above = c.z + 1 < SIZE_Z ? this.world.index(c.x, c.y, c.z + 1) : -1;
    const before = this.snapshot([m.i, above]);
    // La case devient de l'air, ou de l'eau si un lac est à côté (voir VoxelWorld.dig) ; une
    // torche ou un feu posé dessus tombe avec elle.
    if (this.world.dig(c.x, c.y, c.z) === null) return this.refuse(conn, 'rule', m.i);
    const drop = dropOf(block, held);
    if (drop !== null) inv.add(drop, 1);
    d.inv = inv.stacks();
    conn.save();
    this.finish(conn, before);
    this.send([conn], { t: 'inv', c: d.inv });
    this.remember(d);
  }

  private put(conn: ChantierConn, m: Extract<Up, { t: 'put' }>): void {
    const d = conn.data;
    if (this.denied(conn, m.i)) return;
    const inv = this.bag(d);
    if (!inv.has(m.b)) return this.refuse(conn, 'missing', m.i);
    const c = this.world.cellOf(m.i);
    if (this.world.placeProblem(c.x, c.y, c.z, m.b)) return this.refuse(conn, 'rule', m.i);
    // Pas de cube dans un joueur (soi-même compris).
    const body = (p: ChantierData) => ({ x: p.x, y: p.y, z: p.z, vz: 0, onGround: true });
    if (this.players().some((p) => occupies(body(p.data), c)))
      return this.refuse(conn, 'rule', m.i);
    // Une borne de protection : seulement un compte, et là où une zone est possible.
    if (m.b === BORNE) {
      if (!d.account) return this.refuse(conn, 'guest', m.i);
      if (zoneProblem(this.zones, d.id!, c.x, c.y)) return this.refuse(conn, 'rule', m.i);
    }
    const before = this.snapshot([m.i]);
    this.world.place(c.x, c.y, c.z, m.b);
    inv.remove(m.b, 1);
    d.inv = inv.stacks();
    conn.save();
    if (m.b === BORNE) {
      const now = this.opts.now();
      this.zones.push({
        id: `${d.id!.slice(0, 24)}${now.toString(36)}`.slice(0, 40),
        owner: d.id!,
        name: d.name,
        x: c.x,
        y: c.y,
        z: c.z,
        active: now,
      });
      this.markState();
      this.send(this.players(), { t: 'zones', z: this.zones });
    }
    this.finish(conn, before);
    this.send([conn], { t: 'inv', c: d.inv });
    this.remember(d);
  }

  /** Seau (prendre ou verser de l'eau) ou briquet (allumer un feu). */
  private use(conn: ChantierConn, m: Extract<Up, { t: 'use' }>): void {
    const d = conn.data;
    if (this.denied(conn, m.i)) return;
    const inv = this.bag(d);
    if (!inv.has(m.h)) return this.refuse(conn, 'missing', m.i);
    const before = this.snapshot([m.i]);
    const result = useItem(this.world, inv, m.h, m.i);
    if ('problem' in result) return this.refuse(conn, 'rule', m.i);
    d.inv = inv.stacks();
    conn.save();
    this.finish(conn, before);
    this.send([conn], { t: 'inv', c: d.inv });
    this.remember(d);
  }

  private craft(conn: ChantierConn, r: number): void {
    const d = conn.data;
    const inv = this.bag(d);
    const recipe = RECIPES[r]!;
    if (!inv.craft(recipe, stationsNear(this.world, d.x, d.y, d.z)))
      return this.refuse(conn, 'missing');
    d.inv = inv.stacks();
    conn.save();
    this.send([conn], { t: 'inv', c: d.inv });
    this.remember(d);
  }

  // ------------------------------------------------------------------ modération

  /** Défait des actions (les plus récentes d'abord) si personne n'a retouché la case depuis. */
  private revertEntries(entries: readonly LogEntry[], sinceSeconds: number): number[] {
    const changes: number[] = [];
    for (let k = entries.length - 1; k >= 0; k--) {
      const [t, index, before, after] = entries[k]!;
      if (t < sinceSeconds) break;
      const c = this.world.cellOf(index);
      if (this.world.get(c.x, c.y, c.z) !== after) continue;
      this.world.write(index, before, false);
      changes.push(index, before);
    }
    return changes;
  }

  private async moderate(conn: ChantierConn, m: Extract<Up, { t: 'mod' }>): Promise<void> {
    const d = conn.data;
    // Vérifié ici, jamais seulement dans l'interface.
    if (!d.account?.staff) return this.strike(conn);
    const now = this.opts.now();
    if (m.a === 'kick') {
      if (m.target === d.id) return;
      this.bans.set(m.target, now + BAN_TIME);
      this.markState();
      for (const t of this.players().filter((c) => c.data.id === m.target))
        this.reject(t, 'kicked');
      this.send([conn], { t: 'done', a: 'kick', n: 1 });
      return;
    }
    // Annuler la dernière heure d'actions du joueur (présent ou parti).
    const entries = this.logs.get(m.target) ?? (await this.opts.loadLog(m.target).catch(() => []));
    const changes = this.revertEntries(entries, Math.floor((now - UNDO_WINDOW) / 1000));
    // Ce qui est annulé ne l'est qu'une fois : le journal est vidé de ces actions.
    const since = Math.floor((now - UNDO_WINDOW) / 1000);
    this.logs.set(
      m.target,
      entries.filter(([t]) => t < since),
    );
    this.dirtyLogs.add(m.target);
    if (changes.length > 0) this.commit(changes);
    this.send([conn], { t: 'done', a: 'undo', n: changes.length / 2 });
  }

  // ------------------------------------------------------------------ entretien du monde

  /**
   * Une fois par heure : les zones abandonnées perdent leur protection et se défont petit à petit ;
   * quand trop de cubes ont été retirés du monde, les trous de surface se referment peu à peu,
   * loin des joueurs et dans les tranches que personne n'a touchées depuis deux jours. Les
   * galeries creusées en profondeur restent.
   */
  maintain(now: number): number {
    const changes: number[] = [];
    // Temps de calcul limité : au plus une tranche de terrain à recalculer par passage (≈ 5 ms) ;
    // le reste attendra l'heure suivante.
    let fresh = 0;
    const ready = (i: number) => {
      const c = this.world.cellOf(i);
      const cx = Math.floor(c.x / CHUNK);
      const cy = Math.floor(c.y / CHUNK);
      if (this.world.isGenerated(cx, cy)) return true;
      if (fresh >= 1) return false;
      fresh++;
      this.world.ensureChunk(cx, cy);
      return true;
    };
    // 1. Zones abandonnées : la borne s'éteint, la zone se défera petit à petit.
    const expired = this.zones.filter((z) => now - z.active > ZONE_TTL);
    if (expired.length > 0) {
      for (const z of expired) {
        this.fading.push({ x: z.x, y: z.y });
        this.world.write(this.world.index(z.x, z.y, z.z), AIR, false);
        changes.push(this.world.index(z.x, z.y, z.z), AIR);
      }
      this.zones = this.zones.filter((z) => !expired.includes(z));
      this.send(this.players(), { t: 'zones', z: this.zones });
    }
    // 2. Zones qui se défont : quelques cases par heure, jusqu'au terrain de départ.
    this.fading = this.fading.filter((f) => {
      const cells = this.editsIn(f.x - ZONE_RADIUS, f.y - ZONE_RADIUS, 2 * ZONE_RADIUS + 1);
      let done = 0;
      for (const i of cells) {
        if (done >= DECAY_PER_TICK) break;
        if (!ready(i)) continue;
        changes.push(i, this.world.revert(i));
        done++;
      }
      return cells.length > done;
    });
    // 3. Trous de surface, si le monde a perdu beaucoup de cubes.
    if (this.dugCount() > REGEN_THRESHOLD) {
      const near = this.players().map((c) => c.data);
      const candidates: number[] = [];
      for (const ci of this.world.changedChunks()) {
        if (now - (this.touched.get(ci) ?? 0) < REGEN_IDLE) continue;
        for (const [i, b] of this.world.chunkChanges(ci)) {
          if (b !== AIR) continue;
          const c = this.world.cellOf(i);
          if (c.z < columnHeight(SHARED_SEED, c.x, c.y) - 2) continue; // galerie : on la garde
          if (zoneAt(this.zones, c.x, c.y)) continue;
          if (near.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 24)) continue;
          candidates.push(i);
        }
        if (candidates.length >= REGEN_PER_TICK * 4) break;
      }
      // Les trous se referment par le fond.
      candidates.sort((a, b) => this.world.cellOf(a).z - this.world.cellOf(b).z);
      let done = 0;
      for (const i of candidates) {
        if (done >= REGEN_PER_TICK) break;
        if (!ready(i)) continue;
        changes.push(i, this.world.revert(i));
        done++;
      }
    }
    if (changes.length > 0) this.commit(changes);
    this.markState();
    // Exclusions terminées.
    for (const [id, until] of this.bans) if (until <= now) this.bans.delete(id);
    return changes.length / 2;
  }

  /** Cases modifiées dans un carré de colonnes. */
  private editsIn(x0: number, y0: number, size: number): number[] {
    const out: number[] = [];
    for (const ci of this.world.changedChunks())
      for (const i of this.world.chunkChanges(ci).keys()) {
        const c = this.world.cellOf(i);
        if (c.x >= x0 && c.x < x0 + size && c.y >= y0 && c.y < y0 + size) out.push(i);
      }
    return out;
  }

  /** Cubes retirés du terrain de départ (cases devenues de l'air). */
  private dugCount(): number {
    let n = 0;
    for (const ci of this.world.changedChunks())
      for (const b of this.world.chunkChanges(ci).values()) if (b === AIR) n++;
    return n;
  }
}
