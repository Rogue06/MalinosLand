import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '../src/content/avatars';
import { NetworkClient } from '../src/multiplayer/NetworkClient';
import { decodeMessage, encodeMessage } from '../src/multiplayer/protocol';
import type { Transport } from '../src/multiplayer/Transport';

/** Bus en mémoire : simule BroadcastChannel entre plusieurs clients. */
class MemoryBus {
  members = new Set<MemoryTransport>();
  sent = 0;
}

class MemoryTransport implements Transport {
  readonly kind = 'local-tabs';
  readonly label = 'test';
  private handlers = new Set<(p: unknown) => void>();
  constructor(private bus: MemoryBus) {}
  async connect() {
    this.bus.members.add(this);
  }
  send(payload: string) {
    this.bus.sent++;
    for (const m of this.bus.members) if (m !== this) for (const h of m.handlers) h(payload);
  }
  onMessage(h: (p: unknown) => void) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  close() {
    this.bus.members.delete(this);
  }
}

const state = (x = 5, y = 5, room = 'hub') => ({ room, x, y, f: 'py' as const, s: 0 as const });

async function pair(now: () => number) {
  const bus = new MemoryBus();
  const a = new NetworkClient(
    new MemoryTransport(bus),
    'aaaaaaaa11',
    { name: 'Alice', look: DEFAULT_APPEARANCE, state: state() },
    { now },
  );
  const b = new NetworkClient(
    new MemoryTransport(bus),
    'bbbbbbbb22',
    { name: 'Bob', look: DEFAULT_APPEARANCE, state: state(8, 8) },
    { now },
  );
  await a.start();
  await b.start();
  return { a, b, bus };
}

describe('protocole', () => {
  it('rejette les messages invalides ou hostiles', () => {
    expect(decodeMessage('pas du json')).toBeNull();
    expect(
      decodeMessage({ t: 'state', id: 'x', room: 'hub', x: 1, y: 1, f: 'py', s: 0 }),
    ).toBeNull();
    expect(
      decodeMessage({ t: 'state', id: 'abcdefgh12', room: 'hub', x: -5, y: 1, f: 'py', s: 0 }),
    ).toBeNull();
    expect(
      decodeMessage({ t: 'state', id: 'abcdefgh12', room: 'hub', x: 1, y: 1, f: 'up', s: 0 }),
    ).toBeNull();
    expect(decodeMessage({ t: 'emote', id: 'abcdefgh12', room: 'hub', e: '<img>' })).toBeNull();
    expect(decodeMessage({ t: 'hack', id: 'abcdefgh12' })).toBeNull();
    expect(decodeMessage('x'.repeat(5000))).toBeNull();
  });

  it('nettoie le chat et l’apparence reçus', () => {
    const msg = decodeMessage({
      t: 'chat',
      id: 'abcdefgh12',
      room: 'hub',
      scope: 'global',
      text: ' salut‮ ' + 'a'.repeat(300),
    });
    expect(msg?.t).toBe('chat');
    if (msg?.t === 'chat') {
      expect(msg.text.startsWith('salut')).toBe(true);
      expect(msg.text.length).toBeLessThanOrEqual(140);
    }
    const hello = decodeMessage({
      t: 'hello',
      id: 'abcdefgh12',
      name: 'Zoé',
      look: { skin: 999, top: 2 },
      reply: false,
      room: 'hub',
      x: 1,
      y: 2,
      f: 'px',
      s: 1,
    });
    expect(hello?.t === 'hello' && hello.look.skin).toBe(DEFAULT_APPEARANCE.skin);
    expect(hello?.t === 'hello' && hello.look.top).toBe(2);
  });

  it('arrondit les positions pour alléger les messages', () => {
    const raw = encodeMessage({
      t: 'state',
      id: 'abcdefgh12',
      room: 'hub',
      x: 1.23456,
      y: 2.98765,
      f: 'py',
      s: 0,
    });
    expect(raw).toContain('"x":1.23');
    expect(raw.length).toBeLessThan(80);
  });
});

describe('NetworkClient', () => {
  it('deux clients se découvrent (hello + réponse)', async () => {
    const { a, b } = await pair(() => 0);
    expect(a.peers.get('bbbbbbbb22')?.name).toBe('Bob');
    expect(b.peers.get('aaaaaaaa11')?.name).toBe('Alice');
  });

  it('synchronise les déplacements à fréquence limitée', async () => {
    let t = 0;
    const { a, b, bus } = await pair(() => t);
    const before = bus.sent;
    for (let i = 0; i < 60; i++) {
      t += 16;
      a.updateLocal(state(5 + i * 0.05, 5));
    }
    const sent = bus.sent - before;
    // ~1 s de mouvement à 60 i/s : au plus ~10 envois (100 ms mini entre deux).
    expect(sent).toBeLessThanOrEqual(11);
    expect(sent).toBeGreaterThan(3);
    expect(b.peers.get('aaaaaaaa11')!.x).toBeGreaterThan(7);
  });

  it('n’envoie rien quand le joueur est immobile (hors battement de cœur)', async () => {
    let t = 0;
    const { a, bus } = await pair(() => t);
    a.updateLocal(state());
    const before = bus.sent;
    for (let i = 0; i < 100; i++) {
      t += 20;
      a.updateLocal(state());
    }
    expect(bus.sent - before).toBe(0);
    t += 5000;
    a.updateLocal(state());
    expect(bus.sent - before).toBe(1);
  });

  it('ralentit les envois quand le budget de messages approche (quota)', async () => {
    let t = 0;
    const bus = new MemoryBus();
    const a = new NetworkClient(
      new MemoryTransport(bus),
      'aaaaaaaa11',
      { name: 'Alice', look: DEFAULT_APPEARANCE, state: state() },
      { now: () => t, budgetPerMinute: 20 },
    );
    await a.start();
    expect(a.currentInterval()).toBe(100);
    for (let i = 0; i < 40; i++) {
      t += 120;
      a.updateLocal(state(5 + i * 0.1, 5));
    }
    expect(a.currentInterval()).toBeGreaterThan(100);
  });

  it('limite le spam de chat', async () => {
    let t = 0;
    const { a } = await pair(() => t);
    const results = Array.from({ length: 8 }, () => a.sendChat('coucou', 'global'));
    expect(results.filter(Boolean)).toHaveLength(5);
    t += 2500;
    expect(a.sendChat('re', 'global')).toBe(true);
  });

  it('ignore le chat de proximité et les émotes d’une autre salle', async () => {
    const { a, b } = await pair(() => 0);
    const received: string[] = [];
    b.events.on('chat', ({ text }) => received.push(text));
    b.events.on('emote', ({ emote }) => received.push(emote));
    b.updateLocal(state(1, 1, 'tour-3'));
    a.sendChat('local', 'local');
    a.sendChat('global', 'global');
    a.sendEmote('👋');
    expect(received).toEqual(['global']);
  });

  it('retire un pair silencieux ou parti', async () => {
    let t = 0;
    const { a, b } = await pair(() => t);
    const left: string[] = [];
    b.events.on('leave', ({ id }) => left.push(id));
    a.stop();
    expect(left).toEqual(['aaaaaaaa11']);
    // Pair fantôme : plus aucun message pendant 12 s.
    const bus = new MemoryBus();
    const c = new NetworkClient(
      new MemoryTransport(bus),
      'cccccccc33',
      { name: 'Cleo', look: DEFAULT_APPEARANCE, state: state() },
      { now: () => t },
    );
    c.receive(
      JSON.stringify({
        t: 'hello',
        id: 'dddddddd44',
        name: 'Dan',
        look: {},
        reply: true,
        ...state(),
      }),
    );
    expect(c.peers.size).toBe(1);
    t += 13000;
    c.updateLocal(state());
    expect(c.peers.size).toBe(0);
  });
});

// ---------------------------------------------------------------- Transport serveur

import { ServerTransport, protocolsFor } from '../src/multiplayer/ServerTransport';
import { parseRealtimeUrl } from '../src/config';
import { vi } from 'vitest';

/** WebSocket factice pilotée par le test. */
class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeSocket.all.push(this);
  }
  send(p: string) {
    this.sent.push(p);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

describe('onglet en arrière-plan', () => {
  it('un pair oublié qui se remet à bouger est redécouvert', async () => {
    let t = 0;
    const { a, b } = await pair(() => t);
    expect(a.peers.has('bbbbbbbb22')).toBe(true);
    // B se tait 20 s (onglet en arrière-plan : boucle de jeu en pause) : A l'oublie.
    t = 20_000;
    a.updateLocal(state());
    expect(a.peers.has('bbbbbbbb22')).toBe(false);
    // B revient et bouge : A demande une présentation, B répond, A le revoit.
    b.updateLocal(state(9, 8));
    expect(a.peers.has('bbbbbbbb22')).toBe(true);
  });

  it('avec un serveur, un joueur silencieux reste visible (le serveur annonce les départs)', () => {
    let t = 0;
    const c = new NetworkClient(
      new MemoryTransport(new MemoryBus()),
      'cccccccc33',
      { name: 'Cleo', look: DEFAULT_APPEARANCE, state: state() },
      { now: () => t, peerTimeoutMs: Infinity },
    );
    c.receive(
      JSON.stringify({
        t: 'hello',
        id: 'dddddddd44',
        name: 'Dan',
        look: {},
        reply: true,
        ...state(),
      }),
    );
    t = 10 * 60_000;
    c.updateLocal(state());
    expect(c.peers.has('dddddddd44')).toBe(true);
  });
});

describe('statut « absent »', () => {
  it('se propage aux autres joueurs, et à ceux qui arrivent ensuite', async () => {
    const { a, b, bus } = await pair(() => 0);
    a.setAway(true);
    expect(b.peers.get('aaaaaaaa11')?.away).toBe(true);
    const c = new NetworkClient(
      new MemoryTransport(bus),
      'cccccccc33',
      { name: 'Cleo', look: DEFAULT_APPEARANCE, state: state() },
      { now: () => 0 },
    );
    await c.start();
    expect(c.peers.get('aaaaaaaa11')?.away).toBe(true);
    a.setAway(false);
    expect(b.peers.get('aaaaaaaa11')?.away).toBe(false);
  });
});

describe('ServerTransport', () => {
  const make = () => {
    FakeSocket.all = [];
    return new ServerTransport('ws://test/ws', () => new FakeSocket() as unknown as WebSocket);
  };

  it('valide l’adresse du serveur', () => {
    expect(parseRealtimeUrl('wss://exemple.workers.dev/ws')).toBe('wss://exemple.workers.dev/ws');
    expect(parseRealtimeUrl('https://exemple.dev')).toBeNull();
    expect(parseRealtimeUrl(undefined)).toBeNull();
  });

  it('se reconnecte après une coupure et se représente au serveur', async () => {
    vi.useFakeTimers();
    try {
      const transport = make();
      const net = new NetworkClient(transport, 'aaaaaaaa11', {
        name: 'Alice',
        look: DEFAULT_APPEARANCE,
        state: state(),
      });
      await net.start();
      FakeSocket.all[0]!.open();
      expect(FakeSocket.all[0]!.sent.some((p) => p.includes('"t":"hello"'))).toBe(true);
      FakeSocket.all[0]!.drop(1006);
      await vi.advanceTimersByTimeAsync(2000);
      expect(FakeSocket.all).toHaveLength(2);
      FakeSocket.all[1]!.open();
      expect(FakeSocket.all[1]!.sent.some((p) => p.includes('"t":"hello"'))).toBe(true);
      net.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('respecte les refus du serveur (déjà connecté : pas de nouvelle tentative)', async () => {
    vi.useFakeTimers();
    try {
      const transport = make();
      await transport.connect();
      FakeSocket.all[0]!.open();
      FakeSocket.all[0]!.drop(4002);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(FakeSocket.all).toHaveLength(1);
      transport.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('propose le jeton du compte en sous-protocole, jamais dans l’adresse', async () => {
    const seen: { url: string; protocols: string[] }[] = [];
    const transport = new ServerTransport(
      'ws://test/ws',
      (url, protocols) => {
        seen.push({ url, protocols });
        return new FakeSocket() as unknown as WebSocket;
      },
      async () => 'aaa.bbb.ccc',
    );
    await transport.connect();
    expect(seen).toEqual([{ url: 'ws://test/ws', protocols: ['malinos.v1', 'jwt.aaa.bbb.ccc'] }]);
    expect(protocolsFor(null)).toEqual(['malinos.v1']);
    transport.close();
  });

  it('se reconnecte à la demande', async () => {
    vi.useFakeTimers();
    try {
      const transport = make();
      await transport.connect();
      const first = FakeSocket.all[0]!;
      first.open();
      first.close = () => first.drop(1000);
      transport.reconnect();
      await vi.advanceTimersByTimeAsync(2000);
      expect(FakeSocket.all).toHaveLength(2);
      transport.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('applique la fréquence imposée par le serveur et transmet ses avis', async () => {
    const { a } = await pair(() => 0);
    const notices: string[] = [];
    a.events.on('notice', ({ code }) => notices.push(code));
    a.receive(JSON.stringify({ t: 'rate', ms: 1000 }));
    a.receive(JSON.stringify({ t: 'notice', code: 'full' }));
    a.receive(JSON.stringify({ t: 'notice', code: 'piratage' }));
    expect(a.currentInterval()).toBe(1000);
    expect(notices).toEqual(['full']);
  });

  it('logements : demande d’entrée, réponse du serveur, jeton renvoyé à la reconnexion', async () => {
    const sent: string[] = [];
    const transport = {
      kind: 'server' as const,
      label: 'test',
      connect: async () => {},
      send: (p: string) => sent.push(p),
      onMessage: () => () => {},
      close: () => {},
    };
    const net = new NetworkClient(transport, 'cccccccc33', {
      name: 'Cleo',
      look: DEFAULT_APPEARANCE,
      state: state(),
    });
    const doors: unknown[] = [];
    net.events.on('door', (d) => doors.push(d));
    const home = `home-${'a'.repeat(32)}`;
    net.requestEnter(home, 'jeton.de.test.valide');
    expect(JSON.parse(sent.at(-1)!)).toEqual({
      t: 'enter',
      id: 'cccccccc33',
      room: home,
      tok: 'jeton.de.test.valide',
    });
    net.receive(JSON.stringify({ t: 'door', room: home, ok: false, why: 'closed' }));
    net.receive(JSON.stringify({ t: 'door', room: home, ok: true, why: 'n’importe quoi' }));
    expect(doors).toEqual([
      { room: home, ok: false, why: 'closed' },
      { room: home, ok: true },
    ]);
    // Dans le logement d'un autre, la présentation (après une coupure) porte le jeton.
    net.updateLocal({ ...state(), room: home });
    await net.start();
    expect(JSON.parse(sent.at(-1)!)).toMatchObject({
      t: 'hello',
      room: home,
      tok: 'jeton.de.test.valide',
    });
  });

  it('file d’attente : silencieux en attendant, renvoie sa position dès son entrée', async () => {
    let t = 0;
    const { a, bus } = await pair(() => t);
    const places: number[] = [];
    a.events.on('queue', ({ pos }) => places.push(pos));
    a.receive(JSON.stringify({ t: 'queue', pos: 2 }));
    expect(a.isQueued).toBe(true);
    const before = bus.sent;
    t = 10_000;
    a.updateLocal(state(3, 3));
    a.setAway(true);
    expect(a.sendChat('coucou', 'global')).toBe(true);
    expect(bus.sent).toBe(before);
    a.receive(JSON.stringify({ t: 'queue', pos: 0 }));
    expect(a.isQueued).toBe(false);
    expect(bus.sent).toBe(before + 1); // statut « absent » renvoyé
    a.updateLocal(state(3, 3));
    expect(bus.sent).toBe(before + 2); // position actuelle renvoyée aussitôt
    expect(places).toEqual([2, 0]);
  });
});
