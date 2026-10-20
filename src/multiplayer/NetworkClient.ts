import type { AvatarAppearance } from '../content/avatars';
import { EventBus } from '../core/eventBus';
import { TokenBucket } from '../core/rateLimiter';
import {
  decodeMessage,
  encodeMessage,
  type ChatScope,
  type Emote,
  type NetMessage,
  type NoticeCode,
  type PeerState,
} from './protocol';
import type { Transport } from './Transport';

export interface RemotePeer extends PeerState {
  id: string;
  name: string;
  look: AvatarAppearance;
  lastSeen: number;
  /** Connecté à son compte (garanti par le serveur temps réel). */
  verified: boolean;
  /** Absent : son onglet est caché depuis un moment. */
  away: boolean;
}

export interface NetworkEvents extends Record<string, unknown> {
  join: RemotePeer;
  update: RemotePeer;
  leave: { id: string };
  look: RemotePeer;
  away: RemotePeer;
  chat: { peer: RemotePeer; text: string; scope: ChatScope };
  emote: { peer: RemotePeer; emote: Emote };
  /** Avis du serveur (salle pleine, maintenance…). */
  notice: { code: NoticeCode };
  /** File d'attente du serveur : place dans la file, 0 quand on entre. */
  queue: { pos: number };
}

export interface NetworkOptions {
  now?: () => number;
  /** Intervalle minimal entre deux envois de position (ms). */
  stateIntervalMs?: number;
  /**
   * Au-delà, un pair silencieux est considéré comme parti (ms). Avec un serveur, mettre
   * `Infinity` : c'est lui qui annonce les départs (un onglet en arrière-plan se tait sans partir).
   */
  peerTimeoutMs?: number;
  /** Clé de session envoyée au serveur pour reprendre sa place après une coupure. */
  sessionKey?: string;
  /** Budget de messages sortants par minute avant dégradation (quota). */
  budgetPerMinute?: number;
}

/**
 * Client réseau : présence, synchronisation des positions, chat.
 * - n'envoie la position que si elle a changé, à fréquence limitée ;
 * - réduit sa fréquence quand le budget de messages est presque atteint ;
 * - ignore les mouvements des joueurs d'autres salles (interest management).
 */
export class NetworkClient {
  readonly events = new EventBus<NetworkEvents>();
  readonly peers = new Map<string, RemotePeer>();
  private readonly now: () => number;
  private readonly baseInterval: number;
  private readonly peerTimeout: number;
  private readonly budget: number;
  private readonly chatLimiter: TokenBucket;
  private lastSent: PeerState | null = null;
  private lastSentAt = -Infinity;
  private sentLog: number[] = [];
  private unsubscribe: (() => void) | null = null;
  private unsubscribeOpen: (() => void) | null = null;
  /** Intervalle minimal imposé par le serveur (quota), en ms. */
  private serverInterval = 0;
  private readonly sessionKey: string | undefined;
  private away = false;
  /** En file d'attente (salle pleine) : on ne transmet rien d'autre que son départ. */
  private queued = false;
  /** Dernière demande de présentation envoyée, par pair inconnu. */
  private helloRequests = new Map<string, number>();
  bytesSent = 0;

  constructor(
    private readonly transport: Transport,
    readonly selfId: string,
    private self: { name: string; look: AvatarAppearance; state: PeerState },
    opts: NetworkOptions = {},
  ) {
    this.now = opts.now ?? (() => Date.now());
    this.baseInterval = opts.stateIntervalMs ?? 100;
    this.peerTimeout = opts.peerTimeoutMs ?? 12000;
    this.budget = opts.budgetPerMinute ?? 900;
    this.chatLimiter = new TokenBucket(5, 0.5, this.now);
    this.sessionKey = opts.sessionKey;
  }

  get transportLabel(): string {
    return this.transport.label;
  }

  get transportKind(): Transport['kind'] {
    return this.transport.kind;
  }

  /** Le serveur nous a mis en file d'attente (salle pleine). */
  get isQueued(): boolean {
    return this.queued;
  }

  async start(): Promise<void> {
    this.unsubscribe = this.transport.onMessage((raw) => this.receive(raw));
    if (this.transport.onOpen) {
      // Transport qui se reconnecte : à chaque connexion, on repart d'une liste de pairs vide
      // (le serveur renvoie les présents) et on se présente.
      this.unsubscribeOpen = this.transport.onOpen(() => {
        this.queued = false;
        for (const id of [...this.peers.keys()]) {
          this.peers.delete(id);
          this.events.emit('leave', { id });
        }
        this.sendHello(false);
      });
      await this.transport.connect();
    } else {
      await this.transport.connect();
      this.sendHello(false);
    }
  }

  stop(): void {
    this.send({ t: 'bye', id: this.selfId });
    this.unsubscribe?.();
    this.unsubscribeOpen?.();
    this.transport.close();
    this.peers.clear();
  }

  /** Intervalle d'envoi courant, doublé puis quadruplé si le quota approche. */
  currentInterval(): number {
    const usage = this.recentCount() / this.budget;
    let interval = this.baseInterval;
    if (usage > 0.9) interval = this.baseInterval * 4;
    else if (usage > 0.7) interval = this.baseInterval * 2;
    return Math.max(interval, this.serverInterval);
  }

  /** À appeler à chaque image : envoie l'état local si nécessaire. */
  updateLocal(state: PeerState): void {
    this.self.state = state;
    const t = this.now();
    const prev = this.lastSent;
    const changed =
      !prev ||
      prev.room !== state.room ||
      prev.f !== state.f ||
      prev.s !== state.s ||
      Math.abs(prev.x - state.x) > 0.01 ||
      Math.abs(prev.y - state.y) > 0.01;
    // Battement de cœur toutes les 4 s pour signaler la présence même immobile.
    const heartbeat = t - this.lastSentAt > 4000;
    if ((changed && t - this.lastSentAt >= this.currentInterval()) || heartbeat) {
      this.send({ t: 'state', id: this.selfId, ...state });
      this.lastSent = { ...state };
      this.lastSentAt = t;
    }
    this.prune(t);
  }

  /** Statut « absent » du joueur local (onglet caché depuis un moment). */
  setAway(on: boolean): void {
    if (this.away === on) return;
    this.away = on;
    this.send({ t: 'away', id: this.selfId, on });
  }

  updateLook(name: string, look: AvatarAppearance): void {
    this.self.name = name;
    this.self.look = look;
    this.send({ t: 'look', id: this.selfId, name, look });
  }

  /** Envoie un message de chat. Renvoie false si l'anti-spam le refuse. */
  sendChat(text: string, scope: ChatScope): boolean {
    if (!this.chatLimiter.tryTake()) return false;
    this.send({ t: 'chat', id: this.selfId, room: this.self.state.room, scope, text });
    return true;
  }

  sendEmote(e: Emote): void {
    this.send({ t: 'emote', id: this.selfId, room: this.self.state.room, e });
  }

  /** Secondes d'attente avant de pouvoir écrire à nouveau. */
  chatCooldown(): number {
    return this.chatLimiter.waitTime();
  }

  private recentCount(): number {
    const cutoff = this.now() - 60000;
    while (this.sentLog.length > 0 && this.sentLog[0]! < cutoff) this.sentLog.shift();
    return this.sentLog.length;
  }

  private send(msg: NetMessage): void {
    if (this.queued && msg.t !== 'bye' && msg.t !== 'hello') return;
    const payload = encodeMessage(msg);
    if (this.transport.kind !== 'offline') this.bytesSent += payload.length;
    this.sentLog.push(this.now());
    this.transport.send(payload);
  }

  private sendHello(reply: boolean): void {
    this.send({
      t: 'hello',
      id: this.selfId,
      name: this.self.name,
      look: this.self.look,
      reply,
      ...this.self.state,
      ...(this.sessionKey ? { k: this.sessionKey } : {}),
      ...(this.away ? { a: true as const } : {}),
    });
    // Le « hello » contient déjà l'état : inutile de le renvoyer aussitôt.
    this.lastSent = { ...this.self.state };
    this.lastSentAt = this.now();
  }

  private requestHello(id: string, t: number): void {
    if (this.transport.kind === 'server') return; // le serveur présente lui-même les joueurs
    if (t - (this.helloRequests.get(id) ?? -Infinity) < 3000) return;
    this.helloRequests.set(id, t);
    this.sendHello(false);
  }

  private prune(t: number): void {
    for (const [id, peer] of this.peers) {
      if (t - peer.lastSeen > this.peerTimeout) {
        this.peers.delete(id);
        this.events.emit('leave', { id });
      }
    }
  }

  /** Traite un message entrant (public pour les tests). */
  receive(raw: unknown): void {
    const msg = decodeMessage(raw);
    if (!msg) return;
    if (msg.t === 'rate') {
      this.serverInterval = msg.ms;
      return;
    }
    if (msg.t === 'notice') {
      this.events.emit('notice', { code: msg.code });
      return;
    }
    if (msg.t === 'queue') {
      this.queued = msg.pos > 0;
      if (!this.queued) {
        // Entrée dans la salle : on renvoie aussitôt sa position actuelle (et son statut).
        this.lastSent = null;
        this.lastSentAt = -Infinity;
        if (this.away) this.send({ t: 'away', id: this.selfId, on: true });
      }
      this.events.emit('queue', { pos: msg.pos });
      return;
    }
    if (msg.id === this.selfId) return;
    const t = this.now();
    const peer = this.peers.get(msg.id);
    switch (msg.t) {
      case 'hello': {
        const { t: _t, reply, v, k: _k, a, ...rest } = msg;
        const next: RemotePeer = { ...rest, lastSeen: t, verified: v === true, away: a === true };
        const isNew = !peer;
        this.helloRequests.delete(msg.id);
        this.peers.set(msg.id, next);
        this.events.emit(isNew ? 'join' : 'update', next);
        if (!reply) this.sendHello(true);
        break;
      }
      case 'state': {
        if (!peer) {
          // Pair inconnu (oublié pendant que cet onglet était en arrière-plan, par exemple) :
          // on se présente sans « reply », ce qui l'invite à se présenter en retour.
          this.requestHello(msg.id, t);
          return;
        }
        Object.assign(peer, {
          room: msg.room,
          x: msg.x,
          y: msg.y,
          f: msg.f,
          s: msg.s,
          lastSeen: t,
        });
        this.events.emit('update', peer);
        break;
      }
      case 'away': {
        if (!peer) return;
        peer.away = msg.on;
        peer.lastSeen = t;
        this.events.emit('away', peer);
        break;
      }
      case 'look': {
        if (!peer) return;
        Object.assign(peer, {
          name: msg.name,
          look: msg.look,
          lastSeen: t,
          verified: msg.v === true,
        });
        this.events.emit('look', peer);
        break;
      }
      case 'chat': {
        if (!peer) return;
        peer.lastSeen = t;
        if (msg.scope === 'local' && msg.room !== this.self.state.room) return;
        this.events.emit('chat', { peer, text: msg.text, scope: msg.scope });
        break;
      }
      case 'emote': {
        if (!peer || msg.room !== this.self.state.room) return;
        peer.lastSeen = t;
        this.events.emit('emote', { peer, emote: msg.e });
        break;
      }
      case 'bye': {
        if (this.peers.delete(msg.id)) this.events.emit('leave', { id: msg.id });
        break;
      }
    }
  }
}
