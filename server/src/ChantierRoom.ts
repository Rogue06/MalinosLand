import { DurableObject } from 'cloudflare:workers';
import { ACCOUNT_HEADER, WS_PROTOCOL, decodeAccountHeader, readProtocols } from './account';
import {
  ChantierHub,
  MAINTENANCE_EVERY,
  PLAYER_SAVE_EVERY,
  newChantierData,
  parseLog,
  parsePlayerSave,
  parseState,
  type ChantierConn,
  type ChantierData,
  type LogEntry,
  type PlayerSave,
  type SharedState,
} from './chantier';
import { CLOSE_CODES, type QuotaCounter } from './hub';
import { encode } from '../../src/sandbox/protocol';
import type { Env } from './WorldRoom';

interface QuotaState {
  day: string;
  count: number;
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
/** Délai avant d'enregistrer les modifications (regroupées : peu d'écritures par jour). */
const FLUSH_DELAY = 5000;

/**
 * Durable Object du « Chantier des mondes » partagé (DEC-045) : un seul monde pour tous.
 * Comme le Hub, il utilise l'hibernation des WebSockets (pas de durée consommée quand personne
 * ne joue) ; l'état de chaque joueur est donc gardé avec sa WebSocket. Le stockage (SQLite,
 * offre gratuite) garde une ligne par tranche modifiée, une par compte (sac), une par journal
 * d'actions (annulation par les modérateurs, départ d'un visiteur) et une pour l'état général
 * (zones protégées, exclusions), écrites par lots. Une alarme toutes les heures entretient le
 * monde (zones abandonnées, trous de surface, journaux de visiteurs partis sans prévenir).
 */
export class ChantierRoom extends DurableObject<Env> {
  private quota: QuotaState = { day: '', count: 0 };
  private unsaved = 0;
  private hub!: ChantierHub;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    const counter: QuotaCounter = {
      count: (now) => (this.quota.day === dayOf(now) ? this.quota.count : 0),
      add: (now, n) => {
        const day = dayOf(now);
        if (this.quota.day !== day) this.quota = { day, count: 0 };
        this.quota.count += n;
        if (++this.unsaved >= 200) this.persistQuota();
      },
    };
    void ctx.blockConcurrencyWhile(async () => {
      this.quota = (await ctx.storage.get<QuotaState>('quota')) ?? { day: '', count: 0 };
      const chunks = await ctx.storage.list<Uint8Array>({ prefix: 'c:' });
      const state = parseState(await ctx.storage.get('state'));
      const entries: Array<[number, Uint8Array]> = [];
      for (const [k, v] of chunks) {
        const ci = Number(k.slice(2));
        if (Number.isInteger(ci) && v instanceof Uint8Array) entries.push([ci, v]);
      }
      this.hub = new ChantierHub(
        () => this.connections(),
        {
          now: () => Date.now(),
          maxPlayers: Number(env.CHANTIER_MAX_PLAYERS) || 20,
          dailyBudget: Number(env.CHANTIER_DAILY_BUDGET) || 300_000,
          quota: counter,
          loadPlayer: async (id) => parsePlayerSave(await ctx.storage.get(`p:${id}`)),
          loadLog: async (id) => parseLog(await ctx.storage.get(`l:${id}`)),
          dirty: () => void this.scheduleFlush(),
        },
        entries,
        state,
      );
      // Toujours une alarme prévue : l'entretien horaire du monde.
      if ((await ctx.storage.getAlarm()) === null)
        await ctx.storage.setAlarm(Date.now() + MAINTENANCE_EVERY);
    });
  }

  private persistQuota(): void {
    this.unsaved = 0;
    void this.ctx.storage.put('quota', this.quota);
  }

  /** Enregistrement dans quelques secondes (l'alarme est avancée si elle est plus tard). */
  private async scheduleFlush(): Promise<void> {
    const at = Date.now() + FLUSH_DELAY;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > at) await this.ctx.storage.setAlarm(at);
  }

  /**
   * Alarme : enregistre ce qui a changé ; une fois par heure, entretient le monde. Reprogramme
   * la suivante (enregistrements en attente, ou prochain entretien).
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    const next = (await this.ctx.storage.get<number>('maintenance')) ?? 0;
    if (now >= next) {
      this.hub.maintain(now);
      await this.cleanGuestLogs();
      await this.ctx.storage.put('maintenance', now + MAINTENANCE_EVERY);
    }
    const { pending } = await this.save();
    const maintenance = (await this.ctx.storage.get<number>('maintenance')) ?? now;
    await this.ctx.storage.setAlarm(
      Math.min(maintenance, pending ? now + PLAYER_SAVE_EVERY / 2 : Infinity),
    );
  }

  /** Visiteurs partis sans que le serveur le voie (redémarrage) : leurs changements reviennent. */
  private async cleanGuestLogs(): Promise<void> {
    const present = this.hub.presentIds();
    const logs = await this.ctx.storage.list({ prefix: 'l:g' });
    for (const key of logs.keys()) {
      const id = key.slice(2);
      if (!present.has(id)) await this.hub.revertGuest(id);
    }
  }

  /** Écrit un lot : tranches, sacs, journaux, état général (au plus 100 clés par écriture). */
  private async save(): Promise<{ pending: boolean }> {
    const { chunks, players, logs, droppedLogs, state, pending } = this.hub.flush();
    const put: Record<string, Uint8Array | PlayerSave | LogEntry[] | SharedState> = {};
    const remove: string[] = [];
    for (const [ci, bytes] of chunks) {
      if (bytes.length === 0) remove.push(`c:${ci}`);
      else put[`c:${ci}`] = bytes;
    }
    for (const [id, save] of players) put[`p:${id}`] = save;
    for (const [id, entries] of logs) put[`l:${id}`] = entries;
    for (const id of droppedLogs) remove.push(`l:${id}`);
    if (state) put.state = state;
    const keys = Object.keys(put);
    for (let i = 0; i < keys.length; i += 100)
      await this.ctx.storage.put(
        Object.fromEntries(keys.slice(i, i + 100).map((k) => [k, put[k]!])),
      );
    for (let i = 0; i < remove.length; i += 100)
      await this.ctx.storage.delete(remove.slice(i, i + 100));
    if (this.unsaved > 0) this.persistQuota();
    return { pending };
  }

  private wrap(ws: WebSocket): ChantierConn {
    const data = ws.deserializeAttachment() as ChantierData;
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

  private connections(): ChantierConn[] {
    return this.ctx.getWebSockets().map((ws) => this.wrap(ws));
  }

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    const account = decodeAccountHeader(request.headers.get(ACCOUNT_HEADER));
    server.serializeAttachment(newChantierData(crypto.randomUUID(), Date.now(), account));
    const refusal = this.hub.admission();
    if (refusal) {
      server.send(encode({ t: 'notice', code: refusal }));
      server.close(CLOSE_CODES[refusal], refusal);
    }
    const { offered } = readProtocols(request.headers.get('Sec-WebSocket-Protocol'));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: offered ? { 'Sec-WebSocket-Protocol': WS_PROTOCOL } : {},
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.hub.onMessage(this.wrap(ws), message);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.hub.onClose(this.wrap(ws));
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.hub.onClose(this.wrap(ws));
  }
}
