import { describe, expect, it } from 'vitest';
import { AIR, DIRT, LOG, PLANKS, STONE, WORKBENCH } from '../src/sandbox/blocks';
import { RECIPES } from '../src/sandbox/inventory';
import { decodeDown, encode, type Down, type Up } from '../src/sandbox/protocol';
import { SIZE_Z, VoxelWorld } from '../src/sandbox/world';
import type { Account, QuotaCounter } from '../server/src/hub';
import {
  ChantierHub,
  SHARED_SEED,
  newChantierData,
  parsePlayerSave,
  type ChantierConn,
  type PlayerSave,
} from '../server/src/chantier';

/** Connexion factice : enregistre ce qu'elle reçoit. */
class FakeConn implements ChantierConn {
  inbox: Down[] = [];
  closed: { code: number; reason: string } | null = null;
  constructor(public data = newChantierData(crypto.randomUUID(), 0)) {}
  send(payload: string) {
    const msg = decodeDown(payload);
    if (msg) this.inbox.push(msg);
  }
  close(code: number, reason: string) {
    this.closed = { code, reason };
  }
  save() {}
  of<T extends Down['t']>(t: T) {
    return this.inbox.filter((m) => m.t === t) as Extract<Down, { t: T }>[];
  }
}

const ALICE: Account = { id: '0b1c2d3e-0000-4000-8000-000000000001', name: 'Alice' };
const ALICE_ID = '0b1c2d3e000040008000000000000001';
const BOB: Account = { id: '0b1c2d3e-0000-4000-8000-000000000002', name: 'Bob' };

function setup(opts: { saves?: Map<string, PlayerSave>; budget?: number; max?: number } = {}) {
  let t = 1000;
  let count = 0;
  let dirty = 0;
  const conns: FakeConn[] = [];
  const quota: QuotaCounter = { count: () => count, add: (_now, n) => (count += n) };
  const saves = opts.saves ?? new Map<string, PlayerSave>();
  const make = (chunks: Iterable<[number, Uint8Array]> = []) =>
    new ChantierHub(
      () => conns.filter((c) => !c.closed),
      {
        now: () => t,
        maxPlayers: opts.max ?? 20,
        dailyBudget: opts.budget ?? 1_000_000,
        quota,
        loadPlayer: async (id) => saves.get(id) ?? null,
        dirty: () => dirty++,
      },
      chunks,
    );
  const hub = make();
  const send = (c: FakeConn, msg: Up) => hub.onMessage(c, encode(msg));
  const join = async (account: Account | null = null, name = 'Visiteur') => {
    const c = new FakeConn(newChantierData(crypto.randomUUID(), t, account));
    conns.push(c);
    send(c, { t: 'hi', name });
    await new Promise((r) => setTimeout(r, 0));
    return c;
  };
  return {
    hub,
    make,
    send,
    join,
    conns,
    saves,
    advance: (ms: number) => (t += ms),
    count: () => count,
    dirty: () => dirty,
  };
}

/** Une case de terre (ou d'herbe) près du départ, hors de la zone protégée, et l'index voisin. */
function groundNearSpawn(world: VoxelWorld) {
  const x = world.spawn.x + 4;
  const y = world.spawn.y;
  const z = world.surface(x, y);
  return { x, y, z, index: world.index(x, y, z) };
}

describe('Chantier partagé : serveur', () => {
  it('accueille un visiteur : identifiant, départ, sac vide, il ne peut pas construire', async () => {
    const s = setup();
    const c = await s.join(null, 'Zoé');
    const w = c.of('welcome')[0]!;
    expect(w.name).toBe('Zoé');
    expect(w.build).toBe(false);
    expect(w.inv).toEqual([]);
    expect(w.id).toMatch(/^g[0-9a-f]{15}$/);
    expect(Math.abs(w.x - (s.hub.world.spawn.x + 0.5))).toBeLessThanOrEqual(0.8);
    const g = groundNearSpawn(s.hub.world);
    s.send(c, { t: 'dig', i: g.index, h: 0 });
    expect(c.of('no').at(-1)?.why).toBe('guest');
    expect(s.hub.world.get(g.x, g.y, g.z)).not.toBe(AIR);
  });

  it('un compte garde son pseudo, ne peut pas en prendre un autre et voit les autres', async () => {
    const s = setup();
    const bob = await s.join(BOB);
    const alice = await s.join(ALICE, 'Faux nom');
    const w = alice.of('welcome')[0]!;
    expect(w.name).toBe('Alice');
    expect(w.id).toBe(ALICE_ID);
    expect(w.build).toBe(true);
    expect(w.peers.map((p) => p.name)).toEqual(['Bob']);
    expect(bob.of('join')[0]).toMatchObject({ name: 'Alice', v: true });
  });

  it('casser : il faut du temps, la case change pour tous, le sac reçoit la récolte', async () => {
    const s = setup();
    const alice = await s.join(ALICE);
    const bob = await s.join(BOB);
    const g = groundNearSpawn(s.hub.world);
    const block = s.hub.world.get(g.x, g.y, g.z);
    // Tout de suite : trop rapide (le temps pour casser n'a pas passé).
    s.send(alice, { t: 'dig', i: g.index, h: 0 });
    expect(alice.of('no').at(-1)?.why).toBe('fast');
    expect(s.hub.world.get(g.x, g.y, g.z)).toBe(block);
    s.advance(1500);
    s.send(alice, { t: 'dig', i: g.index, h: 0 });
    expect(s.hub.world.get(g.x, g.y, g.z)).toBe(AIR);
    expect(bob.of('set').at(-1)?.e).toEqual([g.index, AIR]);
    expect(alice.of('inv').at(-1)?.c).toEqual([[DIRT, 1]]);
    expect(s.dirty()).toBeGreaterThan(0);
  });

  it('refuse ce qui est trop loin, protégé, ou absent du sac', async () => {
    const s = setup();
    const alice = await s.join(ALICE);
    s.advance(5000);
    const w = s.hub.world;
    const far = w.index(w.spawn.x + 30, w.spawn.y, w.surface(w.spawn.x + 30, w.spawn.y));
    s.send(alice, { t: 'dig', i: far, h: 0 });
    expect(alice.of('no').at(-1)?.why).toBe('far');
    const pad = w.index(w.spawn.x, w.spawn.y, w.spawn.z - 1);
    s.send(alice, { t: 'dig', i: pad, h: 0 });
    expect(alice.of('no').at(-1)?.why).toBe('rule');
    // Le serveur renvoie l'état réel de la case refusée.
    expect(alice.of('set').at(-1)?.e).toEqual([pad, w.get(w.spawn.x, w.spawn.y, w.spawn.z - 1)]);
    const g = groundNearSpawn(w);
    s.send(alice, { t: 'put', i: w.index(g.x, g.y, g.z + 1), b: STONE });
    expect(alice.of('no').at(-1)?.why).toBe('missing');
  });

  it('poser un cube du sac ; pas dans un joueur', async () => {
    const saves = new Map([[ALICE_ID, { inv: [[DIRT, 3]], x: 0, y: 0, z: 0 } as PlayerSave]]);
    const s = setup({ saves });
    const w = s.hub.world;
    const g = groundNearSpawn(w);
    saves.set(ALICE_ID, { inv: [[DIRT, 3]], x: g.x - 2 + 0.5, y: g.y + 0.5, z: g.z + 1 });
    const alice = await s.join(ALICE);
    expect(alice.of('welcome')[0]!.inv).toEqual([[DIRT, 3]]);
    const above = w.index(g.x, g.y, g.z + 1);
    s.send(alice, { t: 'put', i: above, b: DIRT });
    expect(w.get(g.x, g.y, g.z + 1)).toBe(DIRT);
    expect(alice.of('inv').at(-1)?.c).toEqual([[DIRT, 2]]);
    // La case où se tient Alice : refusée.
    const feet = w.index(g.x - 2, g.y, g.z + 1);
    s.send(alice, { t: 'put', i: feet, b: DIRT });
    expect(alice.of('no').at(-1)?.why).toBe('rule');
  });

  it('fabriquer : recette vérifiée, établi exigé pour la pioche', async () => {
    const saves = new Map<string, PlayerSave>();
    const s = setup({ saves });
    const w = s.hub.world;
    saves.set(ALICE_ID, { inv: [[LOG, 3]], x: w.spawn.x + 0.5, y: w.spawn.y + 0.5, z: w.spawn.z });
    const alice = await s.join(ALICE);
    const planks = RECIPES.findIndex((r) => r.out[0] === PLANKS);
    s.send(alice, { t: 'craft', r: planks });
    const after = new Map(alice.of('inv').at(-1)!.c);
    expect(after.get(LOG)).toBe(2);
    expect(after.get(PLANKS)).toBeGreaterThan(0);
    const pick = RECIPES.findIndex((r) => r.station === 'workbench');
    s.send(alice, { t: 'craft', r: pick });
    expect(alice.of('no').at(-1)?.why).toBe('missing');
    expect(w.get(0, 0, 0)).not.toBe(WORKBENCH);
  });

  it('un déplacement trop rapide est refusé : le joueur est replacé', async () => {
    const s = setup();
    const alice = await s.join(ALICE);
    const bob = await s.join(BOB);
    const w = alice.of('welcome')[0]!;
    s.advance(200);
    s.send(alice, { t: 'mv', x: w.x + 1, y: w.y, z: w.z, a: 1 });
    expect(bob.of('p').at(-1)).toMatchObject({ x: w.x + 1, a: 1 });
    s.advance(200);
    s.send(alice, { t: 'mv', x: w.x + 40, y: w.y, z: w.z, a: 1 });
    expect(alice.of('pos').at(-1)).toMatchObject({ x: w.x + 1 });
    expect(bob.of('p').at(-1)?.x).toBe(w.x + 1);
    s.send(alice, { t: 'home' });
    expect(Math.abs(alice.of('pos').at(-1)!.x - (s.hub.world.spawn.x + 0.5))).toBeLessThanOrEqual(
      0.8,
    );
  });

  it('enregistre les tranches modifiées et les sacs ; le monde revient au réveil', async () => {
    const s = setup();
    const alice = await s.join(ALICE);
    s.advance(2000);
    const g = groundNearSpawn(s.hub.world);
    s.send(alice, { t: 'dig', i: g.index, h: 0 });
    s.hub.onClose(alice);
    const { chunks, players } = s.hub.flush();
    expect(players.get(ALICE_ID)?.inv).toEqual([[DIRT, 1]]);
    expect(chunks.size).toBe(1);
    // Rien de nouveau : rien à écrire.
    expect(s.hub.flush().chunks.size).toBe(0);
    const again = s.make(chunks);
    expect(again.world.get(g.x, g.y, g.z)).toBe(AIR);
    const fresh = new VoxelWorld(SHARED_SEED);
    expect(fresh.get(g.x, g.y, g.z)).not.toBe(AIR);
    // Un nouvel arrivant reçoit les modifications.
    const bob = new FakeConn(newChantierData(crypto.randomUUID(), 0, BOB));
    s.conns.push(bob);
    again.onMessage(bob, encode({ t: 'hi', name: 'x' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(bob.of('chunk').length).toBe(1);
  });

  it('même compte dans un autre onglet : la nouvelle connexion remplace l’ancienne', async () => {
    const s = setup();
    const first = await s.join(ALICE);
    const bob = await s.join(BOB);
    const second = await s.join(ALICE);
    expect(first.closed?.code).toBe(4002);
    expect(second.of('welcome')[0]!.id).toBe(ALICE_ID);
    expect(bob.of('left').length).toBe(0);
  });

  it('plafond de joueurs et budget du jour', async () => {
    const s = setup({ max: 1, budget: 10 });
    await s.join(ALICE);
    expect(s.hub.admission()).toBe('full');
    const bob = await s.join(BOB);
    for (let i = 0; i < 12; i++) s.send(bob, { t: 'home' });
    expect(s.hub.admission()).toBe('maintenance');
    expect(s.conns.every((c) => c.closed?.code === 4003)).toBe(true);
  });

  it('messages invalides ignorés ; sauvegarde de joueur relue prudemment', async () => {
    const s = setup();
    const alice = await s.join(ALICE);
    s.hub.onMessage(alice, '{"t":"dig","i":-4,"h":0}');
    s.hub.onMessage(alice, '{"t":"put","i":5,"b":12}');
    s.hub.onMessage(alice, 'pas du json');
    expect(alice.data.strikes).toBe(3);
    expect(
      parsePlayerSave({
        inv: [
          [DIRT, 2],
          [9999, 1],
        ],
        x: 3,
        y: 4,
        z: 5,
      }),
    ).toEqual({
      inv: [[DIRT, 2]],
      x: 3,
      y: 4,
      z: 5,
    });
    expect(parsePlayerSave({ inv: [], x: -1, y: 4, z: SIZE_Z })).toBeNull();
  });
});
