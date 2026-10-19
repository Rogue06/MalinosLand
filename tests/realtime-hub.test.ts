import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '../src/content/avatars';
import { accountPlayerId, decodeMessage, type NetMessage } from '../src/multiplayer/protocol';
import {
  CLOSE_CODES,
  RealtimeHub,
  newConnData,
  type Account,
  type Conn,
  type QuotaCounter,
} from '../server/src/hub';

/** Connexion factice : enregistre ce qu'elle reçoit. */
class FakeConn implements Conn {
  inbox: NetMessage[] = [];
  closed: { code: number; reason: string } | null = null;
  constructor(public data = newConnData(Math.random().toString(36).slice(2), 0)) {}
  send(payload: string) {
    const msg = decodeMessage(payload);
    if (msg) this.inbox.push(msg);
  }
  close(code: number, reason: string) {
    this.closed = { code, reason };
  }
  save() {}
  of<T extends NetMessage['t']>(t: T) {
    return this.inbox.filter((m) => m.t === t) as Extract<NetMessage, { t: T }>[];
  }
}

function setup(opts: { maxPerRoom?: number; budget?: number } = {}) {
  let t = 1000;
  let count = 0;
  const conns: FakeConn[] = [];
  const quota: QuotaCounter = { count: () => count, add: (_now, n) => (count += n) };
  const hub = new RealtimeHub(() => conns.filter((c) => !c.closed), {
    now: () => t,
    rooms: { hub: { width: 34, height: 30 }, 'tour-1': { width: 20, height: 20 } },
    maxPerRoom: opts.maxPerRoom ?? 40,
    dailyBudget: opts.budget ?? 1_000_000,
    quota,
  });
  const join = (id: string, x = 12, y = 21, room = 'hub', account: Account | null = null) => {
    const c = new FakeConn(newConnData(Math.random().toString(36).slice(2), 0, account));
    conns.push(c);
    hub.onMessage(
      c,
      JSON.stringify({
        t: 'hello',
        id,
        name: `Joueur ${id.slice(0, 3)}`,
        look: DEFAULT_APPEARANCE,
        reply: false,
        room,
        x,
        y,
        f: 'py',
        s: 0,
      }),
    );
    return c;
  };
  const say = (c: FakeConn, msg: object) => hub.onMessage(c, JSON.stringify(msg));
  /** Nouvelle connexion sans présentation. */
  const connect = () => {
    const c = new FakeConn();
    conns.push(c);
    return c;
  };
  return {
    hub,
    join,
    connect,
    say,
    advance: (ms: number) => (t += ms),
    setCount: (n: number) => (count = n),
  };
}

describe('serveur temps réel', () => {
  it('présente les joueurs les uns aux autres sans réponse en écho', () => {
    const { join } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    expect(a.of('hello').map((m) => m.id)).toEqual(['bbbbbbbb22']);
    expect(b.of('hello').map((m) => m.id)).toEqual(['aaaaaaaa11']);
    // reply = true : les clients ne répondent pas, le serveur connaît déjà tout le monde.
    expect([...a.of('hello'), ...b.of('hello')].every((m) => m.reply)).toBe(true);
  });

  it('relaie les déplacements seulement aux joueurs de la même salle', () => {
    const { join, say, advance } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    const c = join('cccccccc33', 5, 5, 'tour-1');
    advance(500);
    say(a, { t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 13, y: 21, f: 'px', s: 1 });
    expect(b.of('state')).toHaveLength(1);
    expect(c.of('state')).toHaveLength(0);
  });

  it('ignore une téléportation et un identifiant usurpé', () => {
    const { join, say, advance } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    advance(100);
    say(a, { t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 30, y: 2, f: 'px', s: 1 });
    say(a, { t: 'state', id: 'bbbbbbbb22', room: 'hub', x: 12.2, y: 21, f: 'px', s: 1 });
    expect(b.of('state')).toHaveLength(0);
  });

  it('refuse les positions hors carte et les salles inconnues', () => {
    const { join, say, advance } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    advance(500);
    say(a, { t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 40, y: 21, f: 'px', s: 1 });
    say(a, { t: 'state', id: 'aaaaaaaa11', room: 'cave-secrete', x: 1, y: 1, f: 'px', s: 1 });
    expect(b.of('state')).toHaveLength(0);
  });

  it('chat de proximité dans la salle, chat général pour tous', () => {
    const { join, say } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    const c = join('cccccccc33', 5, 5, 'tour-1');
    say(a, { t: 'chat', id: 'aaaaaaaa11', room: 'hub', scope: 'local', text: 'coucou' });
    say(a, { t: 'chat', id: 'aaaaaaaa11', room: 'hub', scope: 'global', text: 'bonjour à tous' });
    expect(b.of('chat').map((m) => m.text)).toEqual(['coucou', 'bonjour à tous']);
    expect(c.of('chat').map((m) => m.text)).toEqual(['bonjour à tous']);
  });

  it('limite le spam de chat', () => {
    const { join, say } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    for (let i = 0; i < 10; i++)
      say(a, { t: 'chat', id: 'aaaaaaaa11', room: 'hub', scope: 'global', text: `msg ${i}` });
    expect(b.of('chat')).toHaveLength(5);
  });

  it('refuse un joueur quand la salle est pleine, ou un identifiant déjà connecté', () => {
    const { join } = setup({ maxPerRoom: 2 });
    join('aaaaaaaa11');
    join('bbbbbbbb22');
    const c = join('cccccccc33');
    expect(c.of('notice').map((m) => m.code)).toEqual(['full']);
    expect(c.closed?.code).toBe(CLOSE_CODES.full);
    const d = join('aaaaaaaa11', 5, 5, 'tour-1');
    expect(d.closed?.code).toBe(CLOSE_CODES.duplicate);
  });

  it('ferme une connexion qui inonde le serveur', () => {
    const { join, say } = setup();
    const a = join('aaaaaaaa11');
    for (let i = 0; i < 200 && !a.closed; i++)
      say(a, { t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 12, y: 21, f: 'px', s: 1 });
    expect(a.closed?.code).toBe(CLOSE_CODES.abuse);
  });

  it('ralentit puis passe en maintenance quand le budget du jour s’épuise', () => {
    const { hub, join, say, setCount, advance } = setup({ budget: 1000 });
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    setCount(750);
    advance(200);
    say(a, { t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 12.3, y: 21, f: 'px', s: 1 });
    expect(b.of('rate').at(-1)?.ms).toBe(400);
    setCount(1000);
    advance(200);
    say(a, { t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 12.6, y: 21, f: 'px', s: 1 });
    expect(hub.admission()).toBe('maintenance');
    // Plus de relais des mouvements, mais le chat passe encore.
    const statesBefore = b.of('state').length;
    advance(200);
    say(a, { t: 'state', id: 'aaaaaaaa11', room: 'hub', x: 12.9, y: 21, f: 'px', s: 1 });
    expect(b.of('state')).toHaveLength(statesBefore);
    say(a, { t: 'chat', id: 'aaaaaaaa11', room: 'hub', scope: 'global', text: 'toujours là' });
    expect(b.of('chat').at(-1)?.text).toBe('toujours là');
  });

  it('prévient les autres au départ d’un joueur', () => {
    const { hub, join } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    hub.onClose(a);
    expect(b.of('bye').map((m) => m.id)).toEqual(['aaaaaaaa11']);
  });

  it('refuse qu’un client envoie des messages réservés au serveur', () => {
    const { join, say } = setup();
    const a = join('aaaaaaaa11');
    const b = join('bbbbbbbb22');
    say(a, { t: 'notice', code: 'maintenance' });
    say(a, { t: 'rate', ms: 60000 });
    expect(b.of('notice')).toHaveLength(0);
    expect(b.of('rate')).toHaveLength(0);
  });

  describe('comptes vérifiés', () => {
    const ALICE: Account = { id: 'A1B2C3D4-0000-4000-8000-00000000000A', name: 'Alice' };
    const aliceId = accountPlayerId(ALICE.id)!;

    it('impose le pseudo du compte et ajoute la marque « vérifié »', () => {
      const { join, say } = setup();
      const a = join(aliceId, 12, 21, 'hub', ALICE);
      const b = join('bbbbbbbb22');
      const hello = b.of('hello').find((m) => m.id === aliceId);
      expect(hello?.name).toBe('Alice');
      expect(hello?.v).toBe(true);
      expect(a.of('hello').find((m) => m.id === 'bbbbbbbb22')?.v).toBeUndefined();
      say(a, { t: 'look', id: aliceId, name: 'Usurpé', look: DEFAULT_APPEARANCE });
      expect(b.of('look').at(-1)).toMatchObject({ name: 'Alice', v: true });
    });

    it('refuse un autre identifiant que celui du compte', () => {
      const { join } = setup();
      join('cccccccc33', 12, 21, 'hub', ALICE);
      const b = join('bbbbbbbb22');
      expect(b.of('hello')).toHaveLength(0);
    });

    it('un visiteur ne peut pas prendre un identifiant de compte', () => {
      const { join } = setup();
      const b = join('bbbbbbbb22');
      join(aliceId);
      expect(b.of('hello')).toHaveLength(0);
    });

    it('un client ne peut pas se déclarer vérifié lui-même', () => {
      const { join, say } = setup();
      const a = join('aaaaaaaa11');
      const b = join('bbbbbbbb22');
      say(a, { t: 'look', id: 'aaaaaaaa11', name: 'Malin', look: DEFAULT_APPEARANCE, v: true });
      expect(b.of('look').at(-1)?.v).toBeUndefined();
    });
  });

  describe('reconnexion (onglet revenu au premier plan)', () => {
    const helloWithKey = (k: string | undefined) => ({
      t: 'hello',
      id: 'aaaaaaaa11',
      name: 'Alice',
      look: DEFAULT_APPEARANCE,
      reply: false,
      room: 'hub',
      x: 12,
      y: 21,
      f: 'py',
      s: 0,
      ...(k ? { k } : {}),
    });

    it('la même session remplace son ancienne connexion, sans annoncer de départ', () => {
      const { hub, join, connect } = setup();
      const b = join('bbbbbbbb22');
      const first = connect();
      const second = connect();
      hub.onMessage(first, JSON.stringify(helloWithKey('cle0session0alice')));
      hub.onMessage(second, JSON.stringify(helloWithKey('cle0session0alice')));
      expect(first.closed?.code).toBe(CLOSE_CODES.duplicate);
      expect(second.closed).toBeNull();
      hub.onClose(first);
      expect(b.of('bye')).toHaveLength(0);
      expect(second.of('hello').map((m) => m.id)).toContain('bbbbbbbb22');
    });

    it('sans la bonne clé, impossible de prendre la place d’un autre', () => {
      const { join, say } = setup();
      const alice = join('aaaaaaaa11');
      say(alice, helloWithKey('cle0session0alice'));
      const thief = join('aaaaaaaa11');
      expect(thief.closed?.code).toBe(CLOSE_CODES.duplicate);
      expect(alice.closed).toBeNull();
    });

    it('la clé de session n’est jamais transmise aux autres joueurs', () => {
      const { join, hub, connect } = setup();
      const b = join('bbbbbbbb22');
      const a = connect();
      hub.onMessage(a, JSON.stringify(helloWithKey('cle0session0alice')));
      expect(b.of('hello').find((m) => m.id === 'aaaaaaaa11')?.k).toBeUndefined();
    });
  });

  describe('statut « absent »', () => {
    it('est relayé aux autres et transmis aux nouveaux venus', () => {
      const { join, say } = setup();
      const a = join('aaaaaaaa11');
      const b = join('bbbbbbbb22');
      say(a, { t: 'away', id: 'aaaaaaaa11', on: true });
      expect(b.of('away').at(-1)).toEqual({ t: 'away', id: 'aaaaaaaa11', on: true });
      const c = join('cccccccc33');
      expect(c.of('hello').find((m) => m.id === 'aaaaaaaa11')?.a).toBe(true);
      say(a, { t: 'away', id: 'aaaaaaaa11', on: true });
      expect(b.of('away')).toHaveLength(1); // pas de répétition inutile
      say(a, { t: 'away', id: 'aaaaaaaa11', on: false });
      expect(b.of('away').at(-1)?.on).toBe(false);
    });

    it('impossible de changer le statut d’un autre', () => {
      const { join, say } = setup();
      const a = join('aaaaaaaa11');
      const b = join('bbbbbbbb22');
      say(a, { t: 'away', id: 'bbbbbbbb22', on: true });
      expect(b.of('away')).toHaveLength(0);
    });
  });
});
