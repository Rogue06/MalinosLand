/**
 * Couche de transport interchangeable. Le jeu ne connaît que cette interface :
 * on peut passer du mode hors ligne à BroadcastChannel (démo locale) puis à un
 * serveur temps réel (v0.2, Cloudflare Durable Objects envisagé) sans toucher
 * au moteur graphique. Voir docs/REALTIME_NETWORK.md.
 */
export interface Transport {
  readonly kind: 'offline' | 'local-tabs' | 'server';
  /** Libellé honnête affiché au joueur. */
  readonly label: string;
  connect(): Promise<void>;
  /** Envoie un message déjà encodé. */
  send(payload: string): void;
  onMessage(handler: (payload: unknown) => void): () => void;
  /**
   * Facultatif : appelé à chaque (re)connexion réussie. Les transports qui se reconnectent
   * (serveur) l'implémentent pour que le client renvoie son « hello ».
   */
  onOpen?(handler: () => void): () => void;
  close(): void;
}

/** Aucun réseau : le joueur est seul. */
export class OfflineTransport implements Transport {
  readonly kind = 'offline';
  readonly label = 'Hors ligne (solo)';
  async connect(): Promise<void> {}
  send(): void {}
  onMessage(): () => void {
    return () => {};
  }
  close(): void {}
}

/**
 * Démo multijoueur LOCALE : relie les onglets d'un même navigateur via
 * BroadcastChannel. Aucun serveur, aucune donnée ne quitte l'ordinateur.
 */
export class BroadcastChannelTransport implements Transport {
  readonly kind = 'local-tabs';
  readonly label = 'Démo multi-onglets (locale)';
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<(payload: unknown) => void>();

  constructor(private readonly channelName = 'malinosland-v1') {}

  static isSupported(): boolean {
    return typeof BroadcastChannel !== 'undefined';
  }

  async connect(): Promise<void> {
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (ev: MessageEvent) => {
      for (const h of this.handlers) h(ev.data);
    };
  }

  send(payload: string): void {
    this.channel?.postMessage(payload);
  }

  onMessage(handler: (payload: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  close(): void {
    this.channel?.close();
    this.channel = null;
    this.handlers.clear();
  }
}
