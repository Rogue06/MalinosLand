import { sanitizeName } from '../core/text';
import { AIR, BLOCKS, USABLE, itemDef, placeable } from './blocks';
import { MAX_STACK, RECIPES } from './inventory';
import { CHUNK, CHUNKS_X, CHUNKS_Y, SIZE_X, SIZE_Y, SIZE_Z } from './world';
import { parseZones, type Zone } from './zones';

/**
 * Protocole du « Chantier des mondes » à plusieurs (survie partagée). Logique pure et testée,
 * utilisée par le navigateur et par le serveur (`server/src/chantier.ts`).
 * Tout message reçu est NON FIABLE : il passe par `decodeUp` (serveur) ou `decodeDown`
 * (navigateur). Le serveur décide de tout : le navigateur ne fait que demander.
 */

/** Un objet du sac et sa quantité. */
export type Stack = [item: number, count: number];

/** Joueur vu par les autres. `v` : connecté à son compte (il peut construire). */
export interface SharedPeer {
  id: string;
  name: string;
  v: boolean;
  x: number;
  y: number;
  z: number;
  /** Direction du regard (radians). */
  a: number;
}

/** Raisons d'un refus du serveur (affichées au joueur). */
export const REFUSALS = [
  'guest',
  'far',
  'rule',
  'fast',
  'missing',
  'full',
  'zone',
  'limit',
] as const;
export type Refusal = (typeof REFUSALS)[number];

export const REFUSAL_TEXT: Record<Refusal, string> = {
  guest: 'Connecte-toi à ton compte (dans le Hub) pour construire. Sans compte, tu peux visiter.',
  far: 'Trop loin : approche-toi.',
  rule: 'Ce n’est pas possible ici.',
  fast: 'Doucement : chaque cube prend un peu de temps à casser.',
  missing: 'Il te manque ce qu’il faut dans ton sac.',
  full: 'Le monde partagé a atteint sa limite de constructions pour l’instant.',
  zone: 'Cette zone est protégée par sa propriétaire ou son propriétaire.',
  limit:
    'Sans compte, l’essai est fini : connecte-toi (Google ou GitHub, dans le Hub) pour continuer à construire et tout garder.',
};

/** Avis du serveur : salle pleine, quota du jour épuisé, connecté ailleurs. */
export const SHARED_NOTICES = ['full', 'maintenance', 'duplicate', 'kicked'] as const;
export type SharedNotice = (typeof SHARED_NOTICES)[number];

/** Messages du navigateur vers le serveur. */
export type Up =
  /** Se présenter (le pseudo n'est utilisé que pour un visiteur : un compte garde le sien). */
  | { t: 'hi'; name: string }
  /** Position (pieds) et direction du regard. */
  | { t: 'mv'; x: number; y: number; z: number; a: number }
  /** Casser le cube `i` avec l'objet tenu `h` (0 : mains nues). */
  | { t: 'dig'; i: number; h: number }
  /** Poser le cube `b` dans la case `i`. */
  | { t: 'put'; i: number; b: number }
  /** Fabriquer la recette numéro `r` (voir RECIPES). */
  | { t: 'craft'; r: number }
  /** Utiliser un seau ou le briquet sur la case `i` (voir src/sandbox/rules.ts). */
  | { t: 'use'; i: number; h: number }
  /** Revenir au départ (coincé, tombé). */
  | { t: 'home' }
  /**
   * Modération (comptes de modérateurs seulement, vérifié par le serveur) : annuler les actions
   * d'un joueur de la dernière heure, ou l'exclure du chantier pour une heure.
   */
  | { t: 'mod'; a: ModAction; target: string };

export const MOD_ACTIONS = ['undo', 'kick'] as const;
export type ModAction = (typeof MOD_ACTIONS)[number];

/** Messages du serveur vers le navigateur. */
export type Down =
  | {
      t: 'welcome';
      id: string;
      name: string;
      /** Peut construire. */
      build: boolean;
      /** Sans compte : ce qu'il construit disparaît quand il part. */
      guest: boolean;
      /** Modérateur (ou responsable du site) : outils de modération. */
      staff: boolean;
      inv: Stack[];
      x: number;
      y: number;
      z: number;
      peers: SharedPeer[];
    }
  /** Toutes les modifications d'une tranche (remplacent celles qu'on avait). */
  | { t: 'chunk'; c: number; d: string }
  /** Cubes changés : indice, cube, indice, cube… */
  | { t: 'set'; e: number[] }
  /** Le sac, tel que le serveur le garde. */
  | { t: 'inv'; c: Stack[] }
  | ({ t: 'join' } & SharedPeer)
  | { t: 'p'; id: string; x: number; y: number; z: number; a: number }
  | { t: 'left'; id: string }
  /** Refus ; `who` : pseudo du propriétaire de la zone protégée. */
  | { t: 'no'; why: Refusal; who?: string }
  /** Zones protégées du monde (toutes, à chaque changement). */
  | { t: 'zones'; z: Zone[] }
  /** Modération faite : `n` cases remises en état (annulation). */
  | { t: 'done'; a: ModAction; n: number }
  /** Le serveur replace le joueur (départ, déplacement refusé). */
  | { t: 'pos'; x: number; y: number; z: number }
  | { t: 'notice'; code: SharedNotice }
  /** Délai minimal entre deux envois de position (quota du jour qui baisse). */
  | { t: 'rate'; ms: number };

export const CELLS = SIZE_X * SIZE_Y * SIZE_Z;
const PLAYER_ID_RE = /^[a-z0-9]{8,40}$/;
/** Tranche la plus remplie : 16 × 16 × 48 cases, 3 octets chacune, en base64. */
const MAX_CHUNK_TEXT = Math.ceil((CHUNK * CHUNK * SIZE_Z * 3) / 3) * 4;
const MAX_STACKS = 64;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const int = (v: unknown, lo: number, hi: number): v is number =>
  Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
/** Deux décimales suffisent (messages plus courts). */
const round2 = (v: number) => Math.round(v * 100) / 100;

function parse(raw: unknown, max: number): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length > max) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return isObj(data) ? data : null;
  } catch {
    return null;
  }
}

/** Position plausible dans le monde (un peu de marge au-dessus et au-dessous). */
function position(r: Record<string, unknown>): { x: number; y: number; z: number } | null {
  if (!inRange(r.x, 0, SIZE_X) || !inRange(r.y, 0, SIZE_Y) || !inRange(r.z, -10, SIZE_Z + 8))
    return null;
  return { x: round2(r.x), y: round2(r.y), z: round2(r.z) };
}

const angle = (v: unknown): number => (inRange(v, -1000, 1000) ? round2(v) : 0);

/** Valide un message du navigateur (côté serveur). */
export function decodeUp(raw: unknown): Up | null {
  const r = parse(raw, 512);
  if (!r) return null;
  switch (r.t) {
    case 'hi':
      return { t: 'hi', name: sanitizeName(r.name) ?? 'Visiteur' };
    case 'mv': {
      const p = position(r);
      return p ? { t: 'mv', ...p, a: angle(r.a) } : null;
    }
    case 'dig':
      if (!int(r.i, 0, CELLS - 1) || !int(r.h, 0, 255)) return null;
      return { t: 'dig', i: r.i, h: r.h };
    case 'put':
      if (!int(r.i, 0, CELLS - 1) || !int(r.b, 1, 255) || !itemDef(r.b)?.block) return null;
      return { t: 'put', i: r.i, b: r.b };
    case 'craft':
      return int(r.r, 0, RECIPES.length - 1) ? { t: 'craft', r: r.r } : null;
    case 'use':
      if (!int(r.i, 0, CELLS - 1) || !USABLE.includes(r.h as number)) return null;
      return { t: 'use', i: r.i, h: r.h as number };
    case 'home':
      return { t: 'home' };
    case 'mod':
      if (!MOD_ACTIONS.includes(r.a as ModAction)) return null;
      if (typeof r.target !== 'string' || !PLAYER_ID_RE.test(r.target)) return null;
      return { t: 'mod', a: r.a as ModAction, target: r.target };
    default:
      return null;
  }
}

function peer(r: Record<string, unknown>): SharedPeer | null {
  const p = position(r);
  const name = sanitizeName(r.name);
  if (!p || !name || typeof r.id !== 'string' || !PLAYER_ID_RE.test(r.id)) return null;
  return { id: r.id, name, v: r.v === true, ...p, a: angle(r.a) };
}

/** Sac reçu : objets connus, quantités entières. */
export function parseStacks(raw: unknown): Stack[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_STACKS) return null;
  const out: Stack[] = [];
  for (const e of raw) {
    if (!Array.isArray(e) || e.length !== 2) return null;
    const [item, n] = e as [unknown, unknown];
    if (!int(item, 1, 255) || !itemDef(item) || !int(n, 1, MAX_STACK)) return null;
    out.push([item, n]);
  }
  return out;
}

/** Valide un message du serveur (côté navigateur). */
export function decodeDown(raw: unknown): Down | null {
  const r = parse(raw, 64 * 1024);
  if (!r) return null;
  switch (r.t) {
    case 'welcome': {
      const me = peer({ ...r, a: 0 });
      const inv = parseStacks(r.inv);
      if (!me || !inv || !Array.isArray(r.peers) || r.peers.length > 64) return null;
      const peers = r.peers.map((p) => (isObj(p) ? peer(p) : null));
      if (peers.some((p) => p === null)) return null;
      const { id, name, x, y, z } = me;
      return {
        t: 'welcome',
        id,
        name,
        build: r.build === true,
        guest: r.guest === true,
        staff: r.staff === true,
        inv,
        x,
        y,
        z,
        peers: peers as SharedPeer[],
      };
    }
    case 'chunk':
      if (!int(r.c, 0, CHUNKS_X * CHUNKS_Y - 1)) return null;
      if (typeof r.d !== 'string' || r.d.length > MAX_CHUNK_TEXT) return null;
      return { t: 'chunk', c: r.c, d: r.d };
    case 'set': {
      if (!Array.isArray(r.e) || r.e.length % 2 !== 0 || r.e.length > 64) return null;
      // L'état réel d'une case peut être un cube que l'on ne pose pas (socle, dalle, Hub).
      const ok = r.e.every((v, i) => int(v, 0, i % 2 === 0 ? CELLS - 1 : BLOCKS.length - 1));
      return ok ? { t: 'set', e: r.e as number[] } : null;
    }
    case 'inv': {
      const c = parseStacks(r.c);
      return c ? { t: 'inv', c } : null;
    }
    case 'join': {
      const p = peer(r);
      return p ? { t: 'join', ...p } : null;
    }
    case 'p': {
      const p = typeof r.id === 'string' && PLAYER_ID_RE.test(r.id) ? position(r) : null;
      return p ? { t: 'p', id: r.id as string, ...p, a: angle(r.a) } : null;
    }
    case 'left':
      return typeof r.id === 'string' && PLAYER_ID_RE.test(r.id) ? { t: 'left', id: r.id } : null;
    case 'no': {
      if (!REFUSALS.includes(r.why as Refusal)) return null;
      const who = sanitizeName(r.who);
      return { t: 'no', why: r.why as Refusal, ...(who ? { who } : {}) };
    }
    case 'zones':
      return Array.isArray(r.z) && r.z.length <= 300 ? { t: 'zones', z: parseZones(r.z) } : null;
    case 'done':
      return MOD_ACTIONS.includes(r.a as ModAction) && int(r.n, 0, 100_000)
        ? { t: 'done', a: r.a as ModAction, n: r.n }
        : null;
    case 'pos': {
      const p = position(r);
      return p ? { t: 'pos', ...p } : null;
    }
    case 'notice':
      return SHARED_NOTICES.includes(r.code as SharedNotice)
        ? { t: 'notice', code: r.code as SharedNotice }
        : null;
    case 'rate':
      return int(r.ms, 100, 60_000) ? { t: 'rate', ms: r.ms } : null;
    default:
      return null;
  }
}

export const encode = (msg: Up | Down): string => JSON.stringify(msg);

/** Cube qu'on peut trouver dans une modification (air, cube que l'on pose, eau, feu). */
export function validBlock(b: unknown): b is number {
  return b === AIR || (int(b, 1, 255) && placeable(b));
}

// ------------------------------------------------------------------ tranches

/** Tranche d'une case du monde. */
export function chunkOfIndex(index: number): number {
  const x = index % SIZE_X;
  const y = Math.floor(index / SIZE_X) % SIZE_Y;
  return Math.floor(x / CHUNK) + CHUNKS_X * Math.floor(y / CHUNK);
}

/**
 * Modifications d'une tranche en binaire compact : pour chaque case, sa place dans la tranche
 * (2 octets) et le cube (1 octet). C'est ce que le serveur enregistre et envoie.
 */
export function packChunk(ci: number, changes: ReadonlyMap<number, number>): Uint8Array {
  const out = new Uint8Array(changes.size * 3);
  const ox = (ci % CHUNKS_X) * CHUNK;
  const oy = Math.floor(ci / CHUNKS_X) * CHUNK;
  let k = 0;
  for (const [index, block] of changes) {
    const x = (index % SIZE_X) - ox;
    const y = (Math.floor(index / SIZE_X) % SIZE_Y) - oy;
    const z = Math.floor(index / (SIZE_X * SIZE_Y));
    const local = x + CHUNK * (y + CHUNK * z);
    out[k++] = local & 0xff;
    out[k++] = local >> 8;
    out[k++] = block;
  }
  return out;
}

/** Relit une tranche compacte (null : données invalides). */
export function unpackChunk(ci: number, bytes: Uint8Array): Map<number, number> | null {
  if (!int(ci, 0, CHUNKS_X * CHUNKS_Y - 1) || bytes.length % 3 !== 0) return null;
  const ox = (ci % CHUNKS_X) * CHUNK;
  const oy = Math.floor(ci / CHUNKS_X) * CHUNK;
  const out = new Map<number, number>();
  for (let k = 0; k < bytes.length; k += 3) {
    const local = bytes[k]! | (bytes[k + 1]! << 8);
    const block = bytes[k + 2]!;
    if (local >= CHUNK * CHUNK * SIZE_Z || !validBlock(block)) return null;
    const x = ox + (local % CHUNK);
    const y = oy + (Math.floor(local / CHUNK) % CHUNK);
    const z = Math.floor(local / (CHUNK * CHUNK));
    out.set(x + SIZE_X * (y + SIZE_Y * z), block);
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  try {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
