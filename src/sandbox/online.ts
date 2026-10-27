import { AUTH_STORAGE_KEY, REALTIME_URL, SUPABASE_KEY, SUPABASE_URL } from '../config';
import { ServerTransport } from '../multiplayer/ServerTransport';
import { decodeDown, encode, type Down, type Up } from './protocol';

/**
 * Connexion du navigateur au « Chantier des mondes » partagé (DEC-045). Même serveur que le Hub
 * (adresse `/chantier` au lieu de `/ws`), même façon de prouver son compte : le jeton de
 * connexion voyage dans les sous-protocoles de la WebSocket, jamais dans l'adresse.
 */

/** Adresse du Chantier partagé, déduite de celle du serveur temps réel (null : pas de serveur). */
export function chantierUrl(realtime: string | null): string | null {
  if (!realtime) return null;
  try {
    const url = new URL(realtime);
    url.pathname = '/chantier';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export const SHARED_URL = chantierUrl(REALTIME_URL);

let auth: Promise<{
  getSession(): Promise<{ data: { session: { access_token: string } | null } }>;
}> | null = null;

/**
 * Jeton du compte connecté dans le jeu (même site, même session), ou null pour un visiteur.
 * Les modules des comptes ne sont chargés que si une session existe dans ce navigateur.
 */
export async function sharedToken(): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    if (localStorage.getItem(AUTH_STORAGE_KEY) === null) return null;
  } catch {
    return null;
  }
  auth ??= import('../services/supabaseClients').then(
    (m) => m.createClients(SUPABASE_URL!, SUPABASE_KEY!, AUTH_STORAGE_KEY).auth,
  );
  const { data } = await (await auth).getSession();
  return data.session?.access_token ?? null;
}

/** Envoi des positions : au plus 5 fois par seconde, et seulement quand on bouge. */
const BASE_RATE = 200;

export class SharedLink {
  private readonly transport: ServerTransport;
  private rate = BASE_RATE;
  private lastSent = 0;
  private lastKey = '';

  constructor(
    url: string,
    private readonly name: string,
    private readonly onDown: (msg: Down) => void,
    getToken: () => Promise<string | null> = sharedToken,
  ) {
    this.transport = new ServerTransport(url, undefined, getToken);
    this.transport.onOpen(() => {
      this.lastKey = '';
      this.send({ t: 'hi', name: this.name });
    });
    this.transport.onMessage((raw) => {
      const msg = decodeDown(raw);
      if (!msg) return;
      if (msg.t === 'rate') this.rate = Math.max(BASE_RATE, msg.ms);
      this.onDown(msg);
    });
    void this.transport.connect();
  }

  get online(): boolean {
    return this.transport.online;
  }

  send(msg: Up): void {
    this.transport.send(encode(msg));
  }

  /** Position du joueur (appelée à chaque image ; envoyée au rythme permis). */
  move(x: number, y: number, z: number, a: number, now = performance.now()): void {
    if (now - this.lastSent < this.rate) return;
    const r = (v: number) => Math.round(v * 100) / 100;
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const key = `${r(x)},${r(y)},${r(z)},${Math.round(a * 20)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.lastSent = now;
    this.send({ t: 'mv', x: r(x), y: r(y), z: r(z), a: r(a) });
  }

  close(): void {
    this.transport.close();
  }
}
