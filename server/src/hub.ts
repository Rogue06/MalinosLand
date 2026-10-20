/**
 * Cœur du serveur temps réel, en logique pure (aucune dépendance à Cloudflare) : il est donc
 * testé comme le reste du jeu (tests/realtime-hub.test.ts). Le Durable Object (WorldRoom.ts)
 * ne fait que brancher les WebSockets sur cette classe.
 *
 * Règles appliquées côté serveur (le client n'est jamais cru sur parole) :
 * - chaque message est validé par le protocole partagé (`decodeMessage`) puis ré-encodé ;
 * - l'identifiant d'un joueur est fixé à sa première présentation et ne peut pas être usurpé ;
 * - un joueur connecté à son compte (jeton vérifié par la base) garde l'identifiant et le pseudo
 *   de son compte, et porte la marque « vérifié » ; un visiteur ne peut pas prendre un
 *   identifiant réservé aux comptes ;
 * - les déplacements trop rapides (téléportation) ou hors de la carte sont ignorés ;
 * - mouvements, émotes et chat de proximité ne sont relayés qu'aux joueurs de la même salle ;
 * - limites de débit (anti-spam), plafond de joueurs par salle, budget quotidien de messages ;
 * - salle pleine : file d'attente, le joueur entre tout seul dès qu'une place se libère ;
 * - logements (`home-…`) : on n'y entre que si la base l'autorise (propriétaire, invité, ou
 *   logement ouvert), le propriétaire peut faire sortir un joueur, et ce qui s'y écrit n'est lu
 *   que par les personnes présentes.
 */
import type { AvatarAppearance } from '../../src/content/avatars';
import type { Facing } from '../../src/core/iso';
import {
  ACCOUNT_ID_LENGTH,
  accountPlayerId,
  accountUuid,
  decodeMessage,
  encodeMessage,
  homeOwner,
  type AnimState,
  type DoorRefusal,
  type NetMessage,
  type NoticeCode,
} from '../../src/multiplayer/protocol';
import { WALK_SPEED } from '../../src/world/PlayerController';

/** Seau à jetons sérialisable (doit survivre à l'hibernation du Durable Object). */
export interface Bucket {
  tokens: number;
  at: number;
}

type HelloMessage = Extract<NetMessage, { t: 'hello' }>;

/** Compte vérifié d'une connexion (identifiant du compte et pseudo enregistré). */
export interface Account {
  id: string;
  name: string;
}

/** Données d'une connexion, enregistrées avec la WebSocket (« attachment »). */
export interface ConnData {
  /** Clé unique de la connexion (attribuée par le serveur). */
  key: string;
  /** Compte vérifié à l'ouverture de la connexion, ou null pour un visiteur. */
  account: Account | null;
  /** Clé de session d'un visiteur (prouve qu'une reconnexion vient du même onglet). */
  secret: string | null;
  /** Statut « absent » (onglet caché). */
  away: boolean;
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
  /** En file d'attente (salle pleine) : sa présentation, gardée jusqu'à son entrée. */
  queued: { hello: HelloMessage; at: number } | null;
  /** Sort de la file : sa prochaine position est acceptée sans contrôle de vitesse. */
  resync: boolean;
  /** Logement dans lequel la base l'autorise à entrer (vérifié à sa demande). */
  grant: string | null;
  /** Présentation en attente de la vérification de la base (reconnexion dans un logement). */
  pending: boolean;
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
  /** Dimensions d'un logement (même gabarit pour tous en v0.3). */
  homeRoom: RoomInfo;
  /** Nombre maximal de personnes dans un logement. */
  maxPerHome: number;
  /** Où va un joueur refusé ou mis à la porte d'un logement (devant l'ascenseur du Hub). */
  exit: { room: string; x: number; y: number };
  /**
   * La base autorise-t-elle ce joueur à entrer chez `ownerUuid` ? `token` : jeton de connexion
   * du joueur (null pour un visiteur). En cas d'erreur, l'entrée est refusée.
   */
  checkHomeAccess(ownerUuid: string, token: string | null): Promise<boolean>;
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
/** Taille maximale de la file d'attente d'une salle (au-delà : « salle pleine »). */
export const MAX_QUEUE = 50;

function take(b: Bucket, capacity: number, perSecond: number, now: number): boolean {
  const elapsed = Math.max(0, now - b.at) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * perSecond);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export function newConnData(key: string, now: number, account: Account | null = null): ConnData {
  return {
    key,
    account,
    secret: null,
    away: false,
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
    queued: null,
    resync: false,
    grant: null,
    pending: false,
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
      ...(c.account ? { v: true as const } : {}),
      ...(c.away ? { a: true as const } : {}),
    };
  }

  private inBounds(room: string, x: number, y: number): boolean {
    const info = homeOwner(room) ? this.opts.homeRoom : this.opts.rooms[room];
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
    // Les messages « rate », « notice » et « queue » ne peuvent venir que du serveur.
    if (!msg || msg.t === 'rate' || msg.t === 'notice' || msg.t === 'queue' || msg.t === 'door') {
      this.strike(conn);
      conn.save();
      return;
    }

    if (msg.t === 'hello') {
      if (d.id === null) {
        // Compte : identifiant imposé. Visiteur : identifiants de compte interdits.
        if (d.account) {
          if (msg.id !== accountPlayerId(d.account.id)) return this.strike(conn);
        } else if (msg.id.length === ACCOUNT_ID_LENGTH) return this.strike(conn);
        const holder = this.others(conn).find((c) => c.data.id === msg.id);
        if (holder) {
          // Même joueur (onglet revenu au premier plan, connexion relancée) : la nouvelle
          // connexion remplace l'ancienne, restée ouverte côté serveur. Sinon : refus.
          const same = d.account
            ? holder.data.account?.id === d.account.id
            : !!msg.k && holder.data.secret === msg.k;
          if (!same) return this.reject(conn, 'duplicate');
          holder.data.id = null; // pas d'annonce de départ : le joueur reste là
          holder.save();
          this.reject(holder, 'duplicate');
        }
        if (!this.inBounds(msg.room, msg.x, msg.y)) return this.strike(conn);
        if (d.queued || d.pending) return; // déjà dans la file, ou vérification en cours
        const owner = homeOwner(msg.room);
        if (owner) return this.helloInHome(conn, msg, owner, now);
        if (this.inRoom(msg.room, d.key) >= this.opts.maxPerRoom) {
          // Salle pleine : on attend son tour (sauf si la file elle-même est pleine).
          const waiting = this.waiting(msg.room).length;
          if (waiting >= MAX_QUEUE) return this.reject(conn, 'full');
          d.queued = { hello: msg, at: now };
          conn.save();
          conn.send(encodeMessage({ t: 'queue', pos: waiting + 1 }));
          return;
        }
        this.admit(conn, msg, now);
      }
      return;
    }

    // En file d'attente : rien n'est relayé (seul le départ est pris en compte).
    if (d.id === null && (d.queued || d.pending)) {
      if (msg.t === 'bye') conn.close(1000, 'au revoir');
      return;
    }

    // Tout autre message exige une présentation préalable ; l'identifiant est imposé.
    if (d.id === null) return this.strike(conn);
    if (msg.t !== 'bye' && msg.id !== d.id) return this.strike(conn);

    switch (msg.t) {
      case 'state': {
        if (!this.inBounds(msg.room, msg.x, msg.y)) return this.strike(conn);
        const sameRoom = msg.room === d.room;
        if (!sameRoom && !this.mayMove(d, msg.room, msg.x, msg.y)) return;
        if (d.resync) {
          // Première position après la file d'attente : le joueur a pu bouger en solo.
          d.resync = false;
        } else if (sameRoom) {
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
        if (previousRoom !== d.room && homeOwner(previousRoom)) d.grant = null;
        conn.save();
        const targets = this.others(conn).filter(
          (c) => c.data.room === d.room || c.data.room === previousRoom,
        );
        this.send(targets, { t: 'state', id: d.id, room: d.room, x: d.x, y: d.y, f: d.f, s: d.s });
        if (previousRoom !== d.room) this.admitWaiting(previousRoom);
        return;
      }
      case 'chat': {
        if (!take(d.chat, CHAT_CAPACITY, CHAT_REFILL, now)) {
          conn.save();
          return;
        }
        conn.save();
        // Dans un logement, tout reste entre ses murs : même un message « général » n'est lu
        // que par les personnes présentes.
        const scope = homeOwner(d.room) ? 'local' : msg.scope;
        const targets =
          scope === 'global'
            ? this.others(conn)
            : this.others(conn).filter((c) => c.data.room === d.room);
        this.send(targets, { t: 'chat', id: d.id, room: d.room, scope, text: msg.text });
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
        // Le pseudo d'un compte ne change qu'en base (nouvelle connexion ensuite).
        Object.assign(d, { name: d.account?.name ?? msg.name, look: msg.look });
        conn.save();
        this.send(this.others(conn), {
          t: 'look',
          id: d.id,
          name: d.name,
          look: msg.look,
          ...(d.account ? { v: true as const } : {}),
        });
        return;
      }
      case 'away': {
        if (d.away === msg.on) return;
        d.away = msg.on;
        conn.save();
        this.send(this.others(conn), { t: 'away', id: d.id, on: msg.on });
        return;
      }
      case 'enter': {
        // Une demande coûte comme un message de chat (la base n'est pas interrogée en rafale).
        if (!take(d.chat, CHAT_CAPACITY, CHAT_REFILL, now)) {
          conn.save();
          return;
        }
        conn.save();
        const owner = homeOwner(msg.room)!;
        if (this.isFull(msg.room, d)) return this.door(conn, msg.room, false, 'full');
        if (owner === d.id) {
          d.grant = msg.room;
          conn.save();
          return this.door(conn, msg.room, true);
        }
        this.askAccess(conn, owner, msg.tok ?? null, (c, ok) => {
          if (ok) {
            c.data.grant = msg.room;
            c.save();
          }
          this.door(c, msg.room, ok, ok ? undefined : 'closed');
        });
        return;
      }
      case 'evict': {
        // Seul le propriétaire, chez lui, peut faire sortir quelqu'un.
        const target = this.others(conn).find((c) => c.data.id === msg.target);
        if (!target || homeOwner(target.data.room) !== d.id) return;
        this.evict(target);
        return;
      }
      case 'bye':
        conn.close(1000, 'au revoir');
        return;
    }
  }

  /** Changement de salle permis ? (logement : propriétaire ou autorisé ; sortie par l'ascenseur) */
  private mayMove(d: ConnData, room: string, x: number, y: number): boolean {
    const owner = homeOwner(room);
    if (owner) return (owner === d.id || d.grant === room) && !this.isFull(room, d);
    if (homeOwner(d.room)) {
      // On sort d'un logement par l'ascenseur : arrivée devant lui, pas n'importe où.
      const exit = this.opts.exit;
      return room === exit.room && Math.hypot(x - exit.x, y - exit.y) <= 3;
    }
    return true;
  }

  /** Logement plein (le propriétaire entre toujours chez lui) ? */
  private isFull(room: string, d: ConnData): boolean {
    if (homeOwner(room) === d.id) return false;
    return this.inRoom(room, d.key) >= this.opts.maxPerHome;
  }

  private door(conn: Conn, room: string, ok: boolean, why?: DoorRefusal): void {
    conn.send(encodeMessage({ t: 'door', room, ok, ...(why ? { why } : {}) }));
  }

  /**
   * Demande à la base si le joueur peut entrer chez `owner`. La réponse arrive plus tard : on
   * retrouve alors la connexion (ses données ont pu changer entre-temps), si elle existe encore.
   */
  private askAccess(
    conn: Conn,
    owner: string,
    token: string | null,
    then: (conn: Conn, ok: boolean) => void,
  ): void {
    const key = conn.data.key;
    const uuid = accountUuid(owner);
    const check = uuid
      ? this.opts.checkHomeAccess(uuid, conn.data.account ? token : null).catch(() => false)
      : Promise.resolve(false);
    void check.then((ok) => {
      const current = this.connections().find((c) => c.data.key === key);
      if (current) then(current, ok === true);
    });
  }

  /** Présentation dans un logement (reconnexion) : vérifiée avant d'entrer. */
  private helloInHome(conn: Conn, msg: HelloMessage, owner: string, now: number): void {
    const d = conn.data;
    if (owner === msg.id && d.account) {
      d.grant = msg.room;
      return this.admit(conn, msg, now);
    }
    d.pending = true;
    conn.save();
    this.askAccess(conn, owner, msg.tok ?? null, (c, ok) => {
      c.data.pending = false;
      if (ok && !this.isFull(msg.room, c.data)) {
        c.data.grant = msg.room;
        this.admit(c, msg, this.opts.now());
        return;
      }
      // Refusé : il arrive devant l'ascenseur du Hub, et le jeu l'y conduit.
      const exit = this.opts.exit;
      this.admit(c, { ...msg, room: exit.room, x: exit.x, y: exit.y }, this.opts.now());
      this.door(c, exit.room, false, 'closed');
    });
  }

  /** Met un joueur à la porte d'un logement : il est replacé devant l'ascenseur du Hub. */
  private evict(target: Conn): void {
    const t = target.data;
    const previousRoom = t.room;
    const exit = this.opts.exit;
    Object.assign(t, { room: exit.room, x: exit.x, y: exit.y, grant: null, resync: true });
    t.movedAt = this.opts.now();
    target.save();
    this.door(target, exit.room, false, 'evicted');
    const targets = this.others(target).filter(
      (c) => c.data.room === exit.room || c.data.room === previousRoom,
    );
    this.send(targets, { t: 'state', id: t.id!, room: t.room, x: t.x, y: t.y, f: t.f, s: 0 });
  }

  /** Fermeture d'une connexion : les autres sont prévenus, la file d'attente avance. */
  onClose(conn: Conn): void {
    const d = conn.data;
    if (d.id === null) {
      // Départ d'un joueur qui attendait : les suivants avancent d'une place.
      if (d.queued) {
        const room = d.queued.hello.room;
        d.queued = null;
        this.updateQueue(room);
      }
      return;
    }
    const id = d.id;
    this.send(this.others(conn), { t: 'bye', id });
    d.id = null;
    this.admitWaiting(d.room, d.key);
  }

  /** Joueurs présents dans une salle (hors connexion `except`). */
  private inRoom(room: string, except?: string): number {
    return this.connections().filter(
      (c) => c.data.id !== null && c.data.key !== except && c.data.room === room,
    ).length;
  }

  /** File d'attente d'une salle, dans l'ordre d'arrivée. */
  private waiting(room: string): Conn[] {
    return this.connections()
      .filter((c) => c.data.id === null && c.data.queued?.hello.room === room)
      .sort((a, b) => a.data.queued!.at - b.data.queued!.at);
  }

  /** Indique à chacun sa place dans la file. */
  private updateQueue(room: string): void {
    this.waiting(room).forEach((c, i) => c.send(encodeMessage({ t: 'queue', pos: i + 1 })));
  }

  /** Une place s'est libérée : on fait entrer les premiers de la file. */
  private admitWaiting(room: string, leaving?: string): void {
    const queue = this.waiting(room);
    if (queue.length === 0) return;
    let free = this.opts.maxPerRoom - this.inRoom(room, leaving);
    for (const conn of queue) {
      if (free <= 0) break;
      const hello = conn.data.queued!.hello;
      conn.data.queued = null;
      // Entre-temps, le même identifiant a pu se connecter ailleurs.
      if (this.others(conn).some((c) => c.data.id === hello.id)) {
        conn.save();
        this.reject(conn, 'duplicate');
        continue;
      }
      conn.data.resync = true;
      conn.send(encodeMessage({ t: 'queue', pos: 0 }));
      this.admit(conn, hello, this.opts.now());
      free--;
    }
    this.updateQueue(room);
  }

  /** Entrée dans la salle : présentation aux présents, et des présents au nouveau venu. */
  private admit(conn: Conn, msg: HelloMessage, now: number): void {
    const d = conn.data;
    Object.assign(d, {
      id: msg.id,
      secret: d.account ? null : (msg.k ?? null),
      away: msg.a === true,
      name: d.account?.name ?? msg.name,
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
}
