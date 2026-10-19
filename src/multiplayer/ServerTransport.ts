import type { Transport } from './Transport';

/** Délais de reconnexion selon le motif de fermeture donné par le serveur (codes 4000+). */
const RETRY_AFTER_CLOSE: Record<number, number | null> = {
  4001: 60_000, // salle pleine : on réessaie dans une minute
  4002: null, // déjà connecté ailleurs : on n'insiste pas
  4003: 30 * 60_000, // budget du jour épuisé : maintenance
  4004: null, // exclu
  4005: null, // abus
};
const BACKOFF = [1000, 2000, 4000, 8000, 15_000, 30_000];
const PING_EVERY = 25_000;
/** Sous-protocole attendu par le serveur ; le jeton de connexion suit sous la forme « jwt.… ». */
export const WS_PROTOCOL = 'malinos.v1';

/** Sous-protocoles à proposer : le jeton du compte n'est jamais placé dans l'URL. */
export function protocolsFor(token: string | null): string[] {
  return token ? [WS_PROTOCOL, `jwt.${token}`] : [WS_PROTOCOL];
}

/**
 * Transport vers le serveur temps réel (Cloudflare Worker + Durable Object) par WebSocket.
 * Se reconnecte automatiquement avec un délai croissant ; envoie un « ping » régulier que
 * Cloudflare répond sans réveiller le serveur (ne consomme pas le quota de durée).
 */
export class ServerTransport implements Transport {
  readonly kind = 'server';
  readonly label = 'En ligne';
  private ws: WebSocket | null = null;
  private messageHandlers = new Set<(payload: unknown) => void>();
  private openHandlers = new Set<() => void>();
  private attempt = 0;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  /** Vrai quand la connexion est ouverte. */
  online = false;

  constructor(
    private readonly url: string,
    private readonly createSocket: (url: string, protocols: string[]) => WebSocket = (u, p) =>
      new WebSocket(u, p),
    /** Jeton du compte connecté, relu à chaque connexion (il est renouvelé régulièrement). */
    private readonly getToken: () => Promise<string | null> = async () => null,
  ) {}

  /** Lance la connexion ; ne bloque pas le jeu si le serveur est injoignable. */
  async connect(): Promise<void> {
    this.stopped = false;
    await this.open();
  }

  /** Ferme puis rouvre la connexion (ex. pseudo du compte modifié : le serveur le relit). */
  reconnect(): void {
    if (this.stopped) return;
    this.attempt = 0;
    if (this.ws) this.ws.close(1000, 'reconnexion');
    else void this.open();
  }

  private async open(): Promise<void> {
    if (this.stopped) return;
    let ws: WebSocket;
    try {
      const token = await this.getToken().catch(() => null);
      if (this.stopped) return;
      ws = this.createSocket(this.url, protocolsFor(token));
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.online = true;
      this.pingTimer = setInterval(() => this.send('ping'), PING_EVERY);
      for (const h of this.openHandlers) h();
    };
    ws.onmessage = (ev: MessageEvent) => {
      if (ev.data === 'pong') return;
      for (const h of this.messageHandlers) h(ev.data);
    };
    ws.onclose = (ev: CloseEvent) => {
      this.online = false;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.ws === ws) this.ws = null;
      if (ev.code in RETRY_AFTER_CLOSE) {
        const delay = RETRY_AFTER_CLOSE[ev.code];
        if (delay === null || delay === undefined) this.stopped = true;
        else this.scheduleRetry(delay);
      } else this.scheduleRetry();
    };
    ws.onerror = () => {
      /* suivi d'un « close » qui gère la reconnexion */
    };
  }

  private scheduleRetry(delay?: number): void {
    if (this.stopped || this.retryTimer) return;
    const base = delay ?? BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)]!;
    this.attempt++;
    // Petit aléa pour éviter que tous les joueurs se reconnectent au même instant.
    const wait = base + Math.floor(Math.random() * 500);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.open();
    }, wait);
  }

  send(payload: string): void {
    if (this.ws && this.ws.readyState === 1) this.ws.send(payload);
  }

  onMessage(handler: (payload: unknown) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onOpen(handler: () => void): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  close(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
    this.ws?.close(1000, 'fin de session');
    this.ws = null;
    this.online = false;
    this.messageHandlers.clear();
    this.openHandlers.clear();
  }
}
