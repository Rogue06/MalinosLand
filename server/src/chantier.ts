/**
 * « Chantier des mondes » à plusieurs : survie partagée (DEC-045). Logique pure, sans
 * Cloudflare, testée comme le reste du jeu (tests/chantier-server.test.ts). Le Durable Object
 * (ChantierRoom.ts) ne fait que brancher les WebSockets et le stockage sur cette classe.
 *
 * Le serveur décide de tout, le navigateur ne fait que demander :
 * - un seul monde pour tous ; le terrain de départ est recalculé à l'identique à partir de la
 *   graine, tranche par tranche et seulement là où l'on joue (≈ 5 ms par tranche) ; seules les
 *   modifications sont gardées ;
 * - casser, poser et fabriquer sont vérifiés avec les règles du jeu (`src/sandbox/`) : zone
 *   protégée, portée, temps pour casser selon l'outil, objets réellement dans le sac, atelier à
 *   côté ; le sac de chaque compte est gardé par le serveur ;
 * - seuls les comptes connectés construisent ; un visiteur se promène et regarde ;
 * - déplacements trop rapides refusés (le joueur est replacé), limites de débit, plafond de
 *   joueurs, budget quotidien de messages sous le quota gratuit.
 */
import { AIR, breakTime, dropOf } from '../../src/sandbox/blocks';
import { Inventory, RECIPES, stationsNear } from '../../src/sandbox/inventory';
import { occupies, SPRINT_SPEED } from '../../src/sandbox/player';
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
} from '../../src/sandbox/world';
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
const MSG_CAPACITY = 40;
const MSG_REFILL = 20;
const MAX_STRIKES = 30;

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

export interface ChantierOptions {
  now(): number;
  maxPlayers: number;
  dailyBudget: number;
  quota: QuotaCounter;
  /** Lit la sauvegarde d'un compte (null : nouveau joueur). */
  loadPlayer(id: string): Promise<PlayerSave | null>;
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

export class ChantierHub {
  readonly world = new VoxelWorld(SHARED_SEED);
  private readonly dirtyChunks = new Set<number>();
  private readonly dirtyPlayers = new Map<string, PlayerSave>();
  private lastLevel = 0;

  /** `chunks` : modifications enregistrées (tranche → binaire compact), relues au réveil. */
  constructor(
    private readonly connections: () => ChantierConn[],
    private readonly opts: ChantierOptions,
    chunks: Iterable<[number, Uint8Array]> = [],
  ) {
    for (const [ci, bytes] of chunks) {
      const m = unpackChunk(ci, bytes);
      if (m) this.world.setChunkChanges(ci, m);
    }
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
      case 'home':
        return this.home(conn);
    }
  }

  onClose(conn: ChantierConn): void {
    const d = conn.data;
    if (d.id === null) return;
    this.send(this.others(conn), { t: 'left', id: d.id });
    if (d.account) this.remember(d);
    d.id = null;
    conn.save();
  }

  /** Données à enregistrer depuis le dernier appel (puis oubliées). */
  flush(): { chunks: Map<number, Uint8Array>; players: Map<string, PlayerSave> } {
    const chunks = new Map<number, Uint8Array>();
    for (const ci of this.dirtyChunks) chunks.set(ci, packChunk(ci, this.world.chunkChanges(ci)));
    const players = new Map(this.dirtyPlayers);
    this.dirtyChunks.clear();
    this.dirtyPlayers.clear();
    return { chunks, players };
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
    }
    const now = this.opts.now();
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
      build: !!d.account,
      inv: d.inv,
      x: d.x,
      y: d.y,
      z: d.z,
      peers: this.others(conn).map((c) => this.peerOf(c.data)),
    });
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
  private refuse(conn: ChantierConn, why: Refusal, index?: number): void {
    this.send([conn], { t: 'no', why });
    if (index !== undefined) {
      const c = this.world.cellOf(index);
      this.send([conn], { t: 'set', e: [index, this.world.get(c.x, c.y, c.z)] });
    }
    this.send([conn], { t: 'inv', c: conn.data.inv });
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

  /** Change des cases : enregistrement prévu et annonce à tout le monde. */
  private commit(changes: number[]): void {
    for (let i = 0; i < changes.length; i += 2)
      this.dirtyChunks.add(this.world.chunkOf(changes[i]!));
    this.world.clearUndo();
    this.opts.dirty();
    this.send(this.players(), { t: 'set', e: changes });
  }

  private dig(conn: ChantierConn, m: Extract<Up, { t: 'dig' }>, now: number): void {
    const d = conn.data;
    if (!d.account) return this.refuse(conn, 'guest', m.i);
    if (!this.inReach(d, m.i)) return this.refuse(conn, 'far', m.i);
    const c = this.world.cellOf(m.i);
    if (this.world.breakProblem(c.x, c.y, c.z)) return this.refuse(conn, 'rule', m.i);
    if (!this.roomForEdit()) return this.refuse(conn, 'full', m.i);
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
    const aboveBefore = above >= 0 ? this.world.get(c.x, c.y, c.z + 1) : AIR;
    if (this.world.dig(c.x, c.y, c.z) === null) return this.refuse(conn, 'rule', m.i);
    const changes = [m.i, AIR];
    if (above >= 0 && aboveBefore !== AIR && this.world.get(c.x, c.y, c.z + 1) === AIR)
      changes.push(above, AIR);
    const drop = dropOf(block, held);
    if (drop !== null) inv.add(drop, 1);
    d.inv = inv.stacks();
    conn.save();
    this.commit(changes);
    this.send([conn], { t: 'inv', c: d.inv });
    this.remember(d);
  }

  private put(conn: ChantierConn, m: Extract<Up, { t: 'put' }>): void {
    const d = conn.data;
    if (!d.account) return this.refuse(conn, 'guest', m.i);
    if (!this.inReach(d, m.i)) return this.refuse(conn, 'far', m.i);
    const inv = this.bag(d);
    if (!inv.has(m.b)) return this.refuse(conn, 'missing', m.i);
    const c = this.world.cellOf(m.i);
    if (this.world.placeProblem(c.x, c.y, c.z, m.b)) return this.refuse(conn, 'rule', m.i);
    // Pas de cube dans un joueur (soi-même compris).
    const body = (p: ChantierData) => ({ x: p.x, y: p.y, z: p.z, vz: 0, onGround: true });
    if (this.players().some((p) => occupies(body(p.data), c)))
      return this.refuse(conn, 'rule', m.i);
    if (!this.roomForEdit()) return this.refuse(conn, 'full', m.i);
    this.world.place(c.x, c.y, c.z, m.b);
    inv.remove(m.b, 1);
    d.inv = inv.stacks();
    conn.save();
    this.commit([m.i, m.b]);
    this.send([conn], { t: 'inv', c: d.inv });
    this.remember(d);
  }

  private craft(conn: ChantierConn, r: number): void {
    const d = conn.data;
    if (!d.account) return this.refuse(conn, 'guest');
    const inv = this.bag(d);
    const recipe = RECIPES[r]!;
    if (!inv.craft(recipe, stationsNear(this.world, d.x, d.y, d.z)))
      return this.refuse(conn, 'missing');
    d.inv = inv.stacks();
    conn.save();
    this.send([conn], { t: 'inv', c: d.inv });
    this.remember(d);
  }
}
