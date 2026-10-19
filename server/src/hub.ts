/**
 * Cœur du serveur temps réel, en logique pure (aucune dépendance à Cloudflare) : il est donc
 * testé comme le reste du jeu (tests/realtime-hub.test.ts). Le Durable Object (WorldRoom.ts)
 * ne fait que brancher les WebSockets sur cette classe.
 *
 * Règles appliquées côté serveur (le client n'est jamais cru sur parole) :
 * - chaque message est validé par le protocole partagé (`decodeMessage`) puis ré-encodé ;
 * - l'identifiant d'un joueur est fixé à sa première présentation et ne peut pas être usurpé ;
 * - les déplacements trop rapides (téléportation) ou hors de la carte sont ignorés ;
 * - mouvements, émotes et chat de proximité ne sont relayés qu'aux joueurs de la même salle ;
 * - limites de débit (anti-spam), plafond de joueurs par salle, budget quotidien de messages.
 */
import type { AvatarAppearance } from '../../src/content/avatars';
import type { Facing } from '../../src/core/iso';
import {
  decodeMessage,
  encodeMessage,
  type AnimState,
  type NetMessage,
  type NoticeCode,
} from '../../src/multiplayer/protocol';
import { WALK_SPEED } from '../../src/world/PlayerController';

/** Seau à jetons sérialisable (doit survivre à l'hibernation du Durable Object). */
export interface Bucket {
  tokens: number;
  at: number;
}

/** Données d'une connexion, enregistrées avec la WebSocket (« attachment »). */
export interface ConnData {
  /** Clé unique de la connexion (attribuée par le serveur). */
  key: string;
  /** Identifiant du joueur, fixé par son premier « hello ». */
  id: string | null;
  name: string;
  look: AvatarAppearance | null;
  room: string;
  x: number;
  y: number;
  f: Facing;
  s: AnimState;
  movedAt: number;
  messages: Bucket;
  chat: Bucket;
  strikes: number;
}

export interface Conn {
  data: ConnData;
  send(payload: string): void;
  close(code: number, reason: string): void;
  /** Enregistre `data` (persistance pendant l'hibernation). */
  save(): void;
}

/** Compteur du budget quotidien de messages (persisté par le Durable Object). */
export interface QuotaCounter {
  /** Nombre de messages reçus aujourd'hui (UTC). */
  count(now: number): number;
  add(now: number, n: number): void;
}

export interface RoomInfo {
  width: number;
  height: number;
}

export interface HubOptions {
  now: () => number;
  rooms: Record<string, RoomInfo>;
  maxPerRoom: number;
  /** Budget quotidien de messages entrants (fixé sous le quota gratuit réel). */
  dailyBudget: number;
  quota: QuotaCounter;
}

/** Codes de fermeture WebSocket (4000–4999 réservés aux applications). */
export const CLOSE_CODES: Record<NoticeCode | 'abuse', number> = {
  full: 4001,
  duplicate: 4002,
  maintenance: 4003,
  kicked: 4004,
  abuse: 4005,
};

/** Intervalle d'envoi imposé aux clients selon le niveau de consommation du budget. */
export const RATE_BY_LEVEL = [0, 400, 1000, 1000] as const;

const MSG_CAPACITY = 40;
const MSG_REFILL = 20;
const CHAT_CAPACITY = 5;
const CHAT_REFILL = 0.5;
const MAX_STRIKES = 30;

function take(b: Bucket, capacity: number, perSecond: number, now: number): boolean {
  const elapsed = Math.max(0, now - b.at) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * perSecond);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export function newConnData(key: string, now: number): ConnData {
  return {
    key,
    id: null,
    name: '',
    look: null,
    room: 'hub',
    x: 0,
    y: 0,
    f: 'py',
    s: 0,
    movedAt: now,
    messages: { tokens: MSG_CAPACITY, at: now },
    chat: { tokens: CHAT_CAPACITY, at: now },
    strikes: 0,
  };
}

export class RealtimeHub {
  private lastLevel = 0;

  constructor(
    private readonly connections: () => Conn[],
    private readonly opts: HubOptions,
  ) {}

  /**
   * Niveau de consommation du budget du jour : 0 normal, 1 au-delà de 70 % (ralentir),
   * 2 au-delà de 90 % (ralentir fortement), 3 budget épuisé (maintenance).
   */
  level(): 0 | 1 | 2 | 3 {
    const usage = this.opts.quota.count(this.opts.now()) / this.opts.dailyBudget;
    if (usage >= 1) return 3;
    if (usage >= 0.9) return 2;
    if (usage >= 0.7) return 1;
    return 0;
  }

  /** Une nouvelle connexion peut-elle être acceptée ? */
  admission(): NoticeCode | null {
    return this.level() >= 3 ? 'maintenance' : null;
  }

  private others(conn: Conn): Conn[] {
    return this.connections().filter((c) => c.data.key !== conn.data.key && c.data.id !== null);
  }

  private send(targets: Conn[], msg: NetMessage): void {
    const payload = encodeMessage(msg);
    for (const t of targets) t.send(payload);
  }

  private reject(conn: Conn, code: NoticeCode): void {
    conn.send(encodeMessage({ t: 'notice', code }));
    conn.close(CLOSE_CODES[code], code);
  }

  private strike(conn: Conn): void {
    conn.data.strikes++;
    if (conn.data.strikes > MAX_STRIKES) conn.close(CLOSE_CODES.abuse, 'abus');
  }

  /** Informe tout le monde quand le niveau de consommation change. */
  private updateLevel(): void {
    const level = this.level();
    if (level === this.lastLevel) return;
    this.lastLevel = level;
    const ms = RATE_BY_LEVEL[level];
    const all = this.connections().filter((c) => c.data.id !== null);
    if (ms > 0) this.send(all, { t: 'rate', ms });
  }

  private presence(c: ConnData, reply: boolean): NetMessage {
    return {
      t: 'hello',
      id: c.id!,
      name: c.name,
      look: c.look!,
      reply,
      room: c.room,
      x: c.x,
      y: c.y,
      f: c.f,
      s: c.s,
    };
  }

  private inBounds(room: string, x: number, y: number): boolean {
    const info = this.opts.rooms[room];
    return !!info && x >= 0 && y >= 0 && x <= info.width && y <= info.height;
  }

  onMessage(conn: Conn, raw: string | ArrayBuffer): void {
    const now = this.opts.now();
    this.opts.quota.add(now, 1);
    this.updateLevel();
    const d = conn.data;

    if (typeof raw !== 'string' || !take(d.messages, MSG_CAPACITY, MSG_REFILL, now)) {
      this.strike(conn);
      conn.save();
      return;
    }
    const msg = decodeMessage(raw);
    // Les messages « rate » et « notice » ne peuvent venir que du serveur.
    if (!msg || msg.t === 'rate' || msg.t === 'notice') {
      this.strike(conn);
      conn.save();
      return;
    }

    if (msg.t === 'hello') {
      if (d.id === null) {
        if (this.others(conn).some((c) => c.data.id === msg.id))
          return this.reject(conn, 'duplicate');
        if (!this.inBounds(msg.room, msg.x, msg.y)) return this.strike(conn);
        const inRoom = this.others(conn).filter((c) => c.data.room === msg.room).length;
        if (inRoom >= this.opts.maxPerRoom) return this.reject(conn, 'full');
        Object.assign(d, {
          id: msg.id,
          name: msg.name,
          look: msg.look,
          room: msg.room,
          x: msg.x,
          y: msg.y,
          f: msg.f,
          s: msg.s,
          movedAt: now,
        });
        conn.save();
        // Le nouveau venu reçoit les présents ; les présents reçoivent le nouveau venu.
        // reply = true : personne ne répond, le serveur connaît déjà tout le monde.
        for (const other of this.others(conn))
          conn.send(encodeMessage(this.presence(other.data, true)));
        this.send(this.others(conn), this.presence(d, true));
        const ms = RATE_BY_LEVEL[this.level()];
        if (ms > 0) conn.send(encodeMessage({ t: 'rate', ms }));
      }
      return;
    }

    // Tout autre message exige une présentation préalable ; l'identifiant est imposé.
    if (d.id === null) return this.strike(conn);
    if (msg.t !== 'bye' && msg.id !== d.id) return this.strike(conn);

    switch (msg.t) {
      case 'state': {
        if (!this.inBounds(msg.room, msg.x, msg.y)) return this.strike(conn);
        const sameRoom = msg.room === d.room;
        if (sameRoom) {
          const dt = Math.max(0.05, (now - d.movedAt) / 1000);
          const maxDist = WALK_SPEED * 1.6 * dt + 1.2;
          if (Math.hypot(msg.x - d.x, msg.y - d.y) > maxDist) {
            this.strike(conn);
            conn.save();
            return;
          }
        }
        if (this.level() >= 3) return; // budget épuisé : plus de relais des mouvements
        const previousRoom = d.room;
        Object.assign(d, { room: msg.room, x: msg.x, y: msg.y, f: msg.f, s: msg.s, movedAt: now });
        conn.save();
        const targets = this.others(conn).filter(
          (c) => c.data.room === d.room || c.data.room === previousRoom,
        );
        this.send(targets, { t: 'state', id: d.id, room: d.room, x: d.x, y: d.y, f: d.f, s: d.s });
        return;
      }
      case 'chat': {
        if (!take(d.chat, CHAT_CAPACITY, CHAT_REFILL, now)) {
          conn.save();
          return;
        }
        conn.save();
        const targets =
          msg.scope === 'global'
            ? this.others(conn)
            : this.others(conn).filter((c) => c.data.room === d.room);
        this.send(targets, { t: 'chat', id: d.id, room: d.room, scope: msg.scope, text: msg.text });
        return;
      }
      case 'emote': {
        if (this.level() >= 2 || !take(d.chat, CHAT_CAPACITY, CHAT_REFILL, now)) {
          conn.save();
          return;
        }
        conn.save();
        this.send(
          this.others(conn).filter((c) => c.data.room === d.room),
          { t: 'emote', id: d.id, room: d.room, e: msg.e },
        );
        return;
      }
      case 'look': {
        Object.assign(d, { name: msg.name, look: msg.look });
        conn.save();
        this.send(this.others(conn), { t: 'look', id: d.id, name: d.name, look: msg.look });
        return;
      }
      case 'bye':
        conn.close(1000, 'au revoir');
        return;
    }
  }

  /** Fermeture d'une connexion : les autres sont prévenus. */
  onClose(conn: Conn): void {
    const id = conn.data.id;
    if (id === null) return;
    this.send(this.others(conn), { t: 'bye', id });
    conn.data.id = null;
  }
}
