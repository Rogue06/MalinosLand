import { sanitizeAppearance, type AvatarAppearance } from '../content/avatars';
import { FACINGS, type Facing } from '../core/iso';
import { CHAT_MAX_LENGTH, sanitizeName, sanitizeText } from '../core/text';

/**
 * Protocole multijoueur v1 (indépendant du transport).
 * Tout message reçu est considéré comme NON FIABLE et passe par `decodeMessage`.
 * Les messages sont volontairement courts (clés d'une lettre) pour limiter le trafic.
 */
export const PROTOCOL_VERSION = 1;

/** État d'animation : 0 immobile, 1 marche, 2 assis. */
export type AnimState = 0 | 1 | 2;

export const EMOTES = ['👋', '☕', '✨', '😄', '👍', '❤️', '🎉', '🤔'] as const;
export type Emote = (typeof EMOTES)[number];

export type ChatScope = 'local' | 'global';

export interface PeerState {
  room: string;
  x: number;
  y: number;
  f: Facing;
  s: AnimState;
}

export type NetMessage =
  | ({ t: 'hello'; id: string; name: string; look: AvatarAppearance; reply: boolean } & PeerState)
  | ({ t: 'state'; id: string } & PeerState)
  | { t: 'chat'; id: string; room: string; scope: ChatScope; text: string }
  | { t: 'emote'; id: string; room: string; e: Emote }
  | { t: 'look'; id: string; name: string; look: AvatarAppearance }
  | { t: 'bye'; id: string };

const ID_RE = /^[a-z0-9]{8,32}$/;
const ROOM_RE = /^[a-z0-9-]{1,48}$/;
const MAX_COORD = 512;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const coord = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_COORD ? v : null;

function decodeState(r: Record<string, unknown>): PeerState | null {
  const x = coord(r.x);
  const y = coord(r.y);
  if (x === null || y === null) return null;
  if (typeof r.room !== 'string' || !ROOM_RE.test(r.room)) return null;
  if (!FACINGS.includes(r.f as Facing)) return null;
  if (r.s !== 0 && r.s !== 1 && r.s !== 2) return null;
  return { room: r.room, x, y, f: r.f as Facing, s: r.s };
}

/** Valide et normalise un message brut. Renvoie null s'il est invalide. */
export function decodeMessage(raw: unknown): NetMessage | null {
  let data = raw;
  if (typeof raw === 'string') {
    if (raw.length > 2048) return null;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isObj(data) || typeof data.id !== 'string' || !ID_RE.test(data.id)) return null;
  const id = data.id;
  switch (data.t) {
    case 'hello': {
      const st = decodeState(data);
      const name = sanitizeName(data.name);
      if (!st || !name) return null;
      return {
        t: 'hello',
        id,
        name,
        look: sanitizeAppearance(data.look),
        reply: data.reply === true,
        ...st,
      };
    }
    case 'state': {
      const st = decodeState(data);
      return st ? { t: 'state', id, ...st } : null;
    }
    case 'chat': {
      const text = sanitizeText(data.text, CHAT_MAX_LENGTH);
      if (!text || typeof data.room !== 'string' || !ROOM_RE.test(data.room)) return null;
      const scope: ChatScope = data.scope === 'global' ? 'global' : 'local';
      return { t: 'chat', id, room: data.room, scope, text };
    }
    case 'emote': {
      if (!EMOTES.includes(data.e as Emote)) return null;
      if (typeof data.room !== 'string' || !ROOM_RE.test(data.room)) return null;
      return { t: 'emote', id, room: data.room, e: data.e as Emote };
    }
    case 'look': {
      const name = sanitizeName(data.name);
      return name ? { t: 'look', id, name, look: sanitizeAppearance(data.look) } : null;
    }
    case 'bye':
      return { t: 'bye', id };
    default:
      return null;
  }
}

/** Arrondit les positions au centième de tuile : précision suffisante, messages plus courts. */
export function encodeMessage(msg: NetMessage): string {
  if ('x' in msg) {
    return JSON.stringify({
      ...msg,
      x: Math.round(msg.x * 100) / 100,
      y: Math.round(msg.y * 100) / 100,
    });
  }
  return JSON.stringify(msg);
}

export function randomId(rnd: () => number = Math.random): string {
  let id = '';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(rnd() * chars.length)];
  return id;
}
