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
}

export interface NetworkEvents extends Record<string, unknown> {
  join: RemotePeer;
  update: RemotePeer;
  leave: { id: string };
  look: RemotePeer;
  chat: { peer: RemotePeer; text: string; scope: ChatScope };
  emote: { peer: RemotePeer; emote: Emote };
  /** Avis du serveur (salle pleine, maintenance…). */
  notice: { code: NoticeCode };
}

export interface NetworkOptions {
  now?: () => number;
  /** Intervalle minimal entre deux envois de position (ms). */
  stateIntervalMs?: number;
  /** Au-delà, un pair silencieux est considéré comme parti (ms). */
  peerTimeoutMs?: number;
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
  }

  get transportLabel(): string {
    return this.transport.label;
  }

  get transportKind(): Transport['kind'] {
    return this.transport.kind;
  }

  async start(): Promise<void> {
    this.unsubscribe = this.transport.onMessage((raw) => this.receive(raw));
    if (this.transport.onOpen) {
      // Transport qui se reconnecte : à chaque connexion, on repart d'une liste de pairs vide
      // (le serveur renvoie les présents) et on se présente.
      this.unsubscribeOpen = this.transport.onOpen(() => {
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
    });
    // Le « hello » contient déjà l'état : inutile de le renvoyer aussitôt.
    this.lastSent = { ...this.self.state };
    this.lastSentAt = this.now();
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
    if (msg.id === this.selfId) return;
    const t = this.now();
    const peer = this.peers.get(msg.id);
    switch (msg.t) {
      case 'hello': {
        const { t: _t, reply, ...rest } = msg;
        const next: RemotePeer = { ...rest, lastSeen: t };
        const isNew = !peer;
        this.peers.set(msg.id, next);
        this.events.emit(isNew ? 'join' : 'update', next);
        if (!reply) this.sendHello(true);
        break;
      }
      case 'state': {
        if (!peer) return; // pair inconnu : on attend son « hello »
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
      case 'look': {
        if (!peer) return;
        Object.assign(peer, { name: msg.name, look: msg.look, lastSeen: t });
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
