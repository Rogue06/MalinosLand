import { DurableObject } from 'cloudflare:workers';
import hub from '../../src/content/maps/hub.json';
import {
  CLOSE_CODES,
  RealtimeHub,
  newConnData,
  type Conn,
  type ConnData,
  type QuotaCounter,
} from './hub';
import { encodeMessage } from '../../src/multiplayer/protocol';

export interface Env {
  WORLD: DurableObjectNamespace<WorldRoom>;
  /** Origines autorisées, séparées par des virgules (« * » : toutes, à réserver au développement). */
  ALLOWED_ORIGINS: string;
  MAX_PLAYERS_PER_ROOM: string;
  /** Budget quotidien de messages entrants, fixé sous le quota gratuit (voir FREE_INFRASTRUCTURE.md). */
  DAILY_MESSAGE_BUDGET: string;
}

interface QuotaState {
  day: string;
  count: number;
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

/**
 * Durable Object « monde » : une instance relie tous les joueurs connectés. Il utilise
 * l'hibernation des WebSockets : quand personne n'envoie de message, l'objet est mis en veille
 * et ne consomme pas de durée facturable (quota gratuit). L'état de chaque joueur est donc
 * enregistré avec sa WebSocket (« attachment ») et non en mémoire.
 */
export class WorldRoom extends DurableObject<Env> {
  private quota: QuotaState = { day: '', count: 0 };
  private unsaved = 0;
  private readonly hub: RealtimeHub;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.quota = (await ctx.storage.get<QuotaState>('quota')) ?? { day: '', count: 0 };
    });
    // « ping » → « pong » répondu par Cloudflare sans réveiller l'objet (gratuit).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    const counter: QuotaCounter = {
      count: (now) => (this.quota.day === dayOf(now) ? this.quota.count : 0),
      add: (now, n) => {
        const day = dayOf(now);
        if (this.quota.day !== day) this.quota = { day, count: 0 };
        this.quota.count += n;
        // Écriture groupée pour ne pas multiplier les opérations de stockage.
        if (++this.unsaved >= 200) this.persistQuota();
      },
    };
    this.hub = new RealtimeHub(() => this.connections(), {
      now: () => Date.now(),
      rooms: { [hub.id]: { width: hub.width, height: hub.height } },
      maxPerRoom: Number(env.MAX_PLAYERS_PER_ROOM) || 40,
      dailyBudget: Number(env.DAILY_MESSAGE_BUDGET) || 1_400_000,
      quota: counter,
    });
  }

  private persistQuota(): void {
    this.unsaved = 0;
    void this.ctx.storage.put('quota', this.quota);
  }

  private wrap(ws: WebSocket): Conn {
    const data = ws.deserializeAttachment() as ConnData;
    return {
      data,
      send: (payload) => {
        try {
          ws.send(payload);
        } catch {
          /* connexion déjà fermée */
        }
      },
      close: (code, reason) => {
        try {
          ws.close(code, reason);
        } catch {
          /* déjà fermée */
        }
      },
      save: () => ws.serializeAttachment(data),
    };
  }

  private connections(): Conn[] {
    return this.ctx.getWebSockets().map((ws) => this.wrap(ws));
  }

  async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(newConnData(crypto.randomUUID(), Date.now()));
    const refusal = this.hub.admission();
    if (refusal) {
      server.send(encodeMessage({ t: 'notice', code: refusal }));
      server.close(CLOSE_CODES[refusal], refusal);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.hub.onMessage(this.wrap(ws), message);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.hub.onClose(this.wrap(ws));
    if (this.unsaved > 0) this.persistQuota();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.hub.onClose(this.wrap(ws));
  }
}
