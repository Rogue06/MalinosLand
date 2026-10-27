import { describe, expect, it } from 'vitest';
import {
  AIR,
  BORNE,
  DIRT,
  FIRE,
  LIGHTER,
  LOG,
  PLANKS,
  STONE,
  WATER,
  WORKBENCH,
} from '../src/sandbox/blocks';
import { RECIPES } from '../src/sandbox/inventory';
import { decodeDown, encode, type Down, type Up } from '../src/sandbox/protocol';
import { SIZE_Z, VoxelWorld, WATER_LEVEL } from '../src/sandbox/world';
import type { Account, QuotaCounter } from '../server/src/hub';
import {
  ChantierHub,
  DECAY_PER_TICK,
  GUEST_MAX_CHANGES,
  REGEN_IDLE,
  REGEN_THRESHOLD,
  SHARED_SEED,
  newChantierData,
  parsePlayerSave,
  parseState,
  type ChantierConn,
  type LogEntry,
  type PlayerSave,
  type SharedState,
} from '../server/src/chantier';
import { ZONE_RADIUS, ZONE_TTL, zoneProblem } from '../src/sandbox/zones';

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
const BOB_ID = '0b1c2d3e000040008000000000000002';
const MODO: Account = {
  id: '0b1c2d3e-0000-4000-8000-000000000003',
  name: 'Modo',
  role: 'mod',
  staff: true,
};

function setup(opts: { saves?: Map<string, PlayerSave>; budget?: number; max?: number } = {}) {
  let t = 1000;
  let count = 0;
  let dirty = 0;
  const conns: FakeConn[] = [];
  const quota: QuotaCounter = { count: () => count, add: (_now, n) => (count += n) };
  const saves = opts.saves ?? new Map<string, PlayerSave>();
  const logs = new Map<string, LogEntry[]>();
  const make = (chunks: Iterable<[number, Uint8Array]> = [], state?: SharedState) =>
    new ChantierHub(
      () => conns.filter((c) => !c.closed),
      {
        now: () => t,
        maxPlayers: opts.max ?? 20,
        dailyBudget: opts.budget ?? 1_000_000,
        quota,
        loadPlayer: async (id) => saves.get(id) ?? null,
        loadLog: async (id) => logs.get(id) ?? [],
        dirty: () => dirty++,
      },
      chunks,
      state,
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
    logs,
    now: () => t,
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
  it('un visiteur construit, mais tout ce qu’il a changé revient à son départ', async () => {
    const s = setup();
    const c = await s.join(null, 'Zoé');
    const bob = await s.join(BOB);
    const w = c.of('welcome')[0]!;
    expect(w.name).toBe('Zoé');
    expect(w.build).toBe(true);
    expect(w.guest).toBe(true);
    expect(w.staff).toBe(false);
    expect(w.inv).toEqual([]);
    expect(w.id).toMatch(/^g[0-9a-f]{15}$/);
    expect(Math.abs(w.x - (s.hub.world.spawn.x + 0.5))).toBeLessThanOrEqual(0.8);
    const g = groundNearSpawn(s.hub.world);
    const before = s.hub.world.get(g.x, g.y, g.z);
    s.advance(2000);
    s.send(c, { t: 'dig', i: g.index, h: 0 });
    expect(s.hub.world.get(g.x, g.y, g.z)).toBe(AIR);
    expect(c.of('inv').at(-1)?.c).toEqual([[DIRT, 1]]);
    await s.hub.onClose(c);
    expect(s.hub.world.get(g.x, g.y, g.z)).toBe(before);
    expect(bob.of('set').at(-1)?.e).toEqual([g.index, before]);
    // Son journal ne sert plus : il est effacé.
    expect(s.hub.flush().droppedLogs).toEqual([w.id]);
  });

  it('un visiteur a une limite de changements ; une borne demande un compte', async () => {
    const s = setup();
    const c = await s.join(null, 'Zoé');
    const id = c.data.id!;
    // Journal plein (simulé) : le prochain changement est refusé.
    const full: LogEntry[] = Array.from({ length: GUEST_MAX_CHANGES }, () => [0, 0, 0, 0]);
    (s.hub as unknown as { logs: Map<string, LogEntry[]> }).logs.set(id, full);
    const g = groundNearSpawn(s.hub.world);
    s.advance(2000);
    s.send(c, { t: 'dig', i: g.index, h: 0 });
    expect(c.of('no').at(-1)?.why).toBe('limit');
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

  it('briquet : le serveur allume le feu pour tous', async () => {
    const saves = new Map<string, PlayerSave>();
    const s = setup({ saves });
    const w = s.hub.world;
    saves.set(ALICE_ID, {
      inv: [[LIGHTER, 1]],
      x: w.spawn.x + 0.5,
      y: w.spawn.y + 0.5,
      z: w.spawn.z,
    });
    const alice = await s.join(ALICE);
    const zoe = await s.join(null, 'Zoé');
    const x = w.spawn.x + 3;
    const y = w.spawn.y;
    const spot = w.index(x, y, w.surface(x, y) + 1);
    // Un visiteur n'a pas de briquet dans son sac.
    s.send(zoe, { t: 'use', i: spot, h: LIGHTER });
    expect(zoe.of('no').at(-1)?.why).toBe('missing');
    s.send(alice, { t: 'use', i: spot, h: LIGHTER });
    expect(zoe.of('set').at(-1)?.e).toEqual([spot, FIRE]);
    expect(alice.of('inv').at(-1)?.c).toEqual([[LIGHTER, 1]]);
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
    await s.hub.onClose(alice);
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

describe('Chantier partagé : protections, entretien et modération', () => {
  /** Un coin libre, loin du départ et du portail, et des sauvegardes pour s'y trouver. */
  function plot(s: ReturnType<typeof setup>) {
    const w = s.hub.world;
    // Un terrain sec (pas d'eau à moins de 10 cubes), assez loin du départ pour une zone.
    const dry = (x: number, y: number) => {
      for (let dy = -10; dy <= 10; dy++)
        for (let dx = -10; dx <= 10; dx++)
          if (w.get(x + dx, y + dy, WATER_LEVEL) === WATER) return false;
      return w.surface(x, y) < 30;
    };
    let bx = w.spawn.x + 24;
    let by = w.spawn.y;
    for (const [x, y] of [
      [w.spawn.x + 24, w.spawn.y],
      [w.spawn.x - 24, w.spawn.y],
      [w.spawn.x, w.spawn.y + 30],
      [w.spawn.x - 30, w.spawn.y + 30],
      [w.spawn.x + 30, w.spawn.y + 30],
    ] as const)
      if (dry(x, y)) {
        [bx, by] = [x, y];
        break;
      }
    expect(dry(bx, by)).toBe(true);
    const bz = w.surface(bx, by) + 1;
    const near = (dx: number, inv: PlayerSave['inv']): PlayerSave => ({
      inv,
      x: bx + dx + 0.5,
      y: by + 2.5,
      z: w.surface(bx + dx, by + 2) + 1,
    });
    return { w, bx, by, bz, borne: w.index(bx, by, bz), near };
  }

  it('borne : une zone protégée pour sa propriétaire, ouverte aux modérateurs', async () => {
    const s = setup();
    const p = plot(s);
    s.saves.set(ALICE_ID, p.near(-2, [[BORNE, 2]]));
    s.saves.set(BOB_ID, p.near(2, []));
    const alice = await s.join(ALICE);
    const bob = await s.join(BOB);
    s.send(alice, { t: 'put', i: p.borne, b: BORNE });
    const zones = bob.of('zones').at(-1)!.z;
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ owner: ALICE_ID, name: 'Alice', x: p.bx, y: p.by });
    // Bob ne touche à rien dans la zone ; Alice, si.
    const cell = p.w.index(p.bx + 1, p.by + 1, p.w.surface(p.bx + 1, p.by + 1));
    s.advance(3000);
    s.send(bob, { t: 'dig', i: cell, h: 0 });
    expect(bob.of('no').at(-1)).toMatchObject({ why: 'zone', who: 'Alice' });
    s.send(bob, { t: 'dig', i: p.borne, h: 0 });
    expect(p.w.get(p.bx, p.by, p.bz)).toBe(BORNE);
    // Deuxième borne trop près : refusée.
    const other = p.w.index(p.bx - 3, p.by, p.w.surface(p.bx - 3, p.by) + 1);
    s.send(alice, { t: 'put', i: other, b: BORNE });
    expect(alice.of('no').at(-1)?.why).toBe('rule');
    s.send(alice, { t: 'dig', i: cell, h: 0 });
    expect(alice.of('no').at(-1)?.why).not.toBe('zone');
    // Un modérateur peut réparer dans la zone.
    s.saves.set('0b1c2d3e000040008000000000000003', p.near(1, []));
    const modo = await s.join(MODO);
    expect(modo.of('welcome')[0]!.staff).toBe(true);
    s.advance(3000);
    const cell2 = p.w.index(p.bx + 2, p.by + 1, p.w.surface(p.bx + 2, p.by + 1));
    s.send(modo, { t: 'dig', i: cell2, h: 0 });
    expect(p.w.get(p.bx + 2, p.by + 1, p.w.cellOf(cell2).z)).toBe(AIR);
    // Alice casse sa borne : la zone disparaît, elle récupère la borne.
    s.advance(5000);
    s.send(alice, { t: 'dig', i: p.borne, h: 0 });
    expect(bob.of('zones').at(-1)!.z).toEqual([]);
    expect(alice.of('inv').at(-1)?.c).toContainEqual([BORNE, 2]);
  });

  it('pas de zone collée à la dalle de départ ni au portail', () => {
    const w = new VoxelWorld(SHARED_SEED);
    expect(zoneProblem([], ALICE_ID, w.spawn.x + 5, w.spawn.y)).toMatch(/tout le monde/);
    expect(zoneProblem([], ALICE_ID, w.spawn.x + ZONE_RADIUS + 8, w.spawn.y)).toBeNull();
  });

  it('modération : annuler la dernière heure d’un joueur, l’exclure une heure', async () => {
    const s = setup();
    const p = plot(s);
    s.saves.set(BOB_ID, p.near(0, []));
    s.saves.set('0b1c2d3e000040008000000000000003', p.near(1, []));
    const bob = await s.join(BOB);
    const modo = await s.join(MODO);
    const alice = await s.join(ALICE);
    const cells = [3, 4].map((dx) =>
      p.w.index(p.bx + dx, p.by + 2, p.w.surface(p.bx + dx, p.by + 2)),
    );
    const before = cells.map((i) =>
      p.w.get(...(Object.values(p.w.cellOf(i)) as [number, number, number])),
    );
    for (const i of cells) {
      s.advance(3000);
      s.send(bob, { t: 'dig', i, h: 0 });
    }
    expect(cells.every((i) => p.w.blocks[i] === AIR)).toBe(true);
    // Un joueur ordinaire ne peut pas modérer.
    s.send(alice, { t: 'mod', a: 'undo', target: BOB_ID });
    expect(cells.every((i) => p.w.blocks[i] === AIR)).toBe(true);
    s.send(modo, { t: 'mod', a: 'undo', target: BOB_ID });
    await new Promise((r) => setTimeout(r, 0));
    expect(cells.map((i) => p.w.blocks[i])).toEqual(before);
    expect(modo.of('done').at(-1)).toEqual({ t: 'done', a: 'undo', n: 2 });
    s.send(modo, { t: 'mod', a: 'kick', target: BOB_ID });
    await new Promise((r) => setTimeout(r, 0));
    expect(bob.closed?.code).toBe(4004);
    const again = await s.join(BOB);
    expect(again.closed?.code).toBe(4004);
    s.advance(3600 * 1000 + 1);
    const later = await s.join(BOB);
    expect(later.closed).toBeNull();
  });

  it('zone abandonnée deux semaines : la protection tombe, puis la maison se défait', async () => {
    const s = setup();
    const p = plot(s);
    s.saves.set(
      ALICE_ID,
      p.near(-2, [
        [BORNE, 1],
        [DIRT, 6],
      ]),
    );
    const alice = await s.join(ALICE);
    s.send(alice, { t: 'put', i: p.borne, b: BORNE });
    for (let dx = 1; dx <= 3; dx++)
      s.send(alice, {
        t: 'put',
        i: p.w.index(p.bx + dx, p.by, p.w.surface(p.bx + dx, p.by) + 1),
        b: DIRT,
      });
    await s.hub.onClose(alice);
    expect(s.hub.zones).toHaveLength(1);
    // Encore protégée juste avant l'échéance.
    s.advance(ZONE_TTL - 1000);
    s.hub.maintain(s.now());
    expect(s.hub.zones).toHaveLength(1);
    s.advance(2000);
    s.hub.maintain(s.now());
    expect(s.hub.zones).toHaveLength(0);
    expect(p.w.get(p.bx, p.by, p.bz)).toBe(AIR);
    // Puis, d'heure en heure, tout revient au terrain de départ.
    for (let k = 0; k < 5; k++) s.hub.maintain(s.now());
    const fresh = new VoxelWorld(SHARED_SEED);
    for (let dx = 1; dx <= 3; dx++) {
      const z = fresh.surface(p.bx + dx, p.by) + 1;
      expect(p.w.get(p.bx + dx, p.by, z)).toBe(fresh.get(p.bx + dx, p.by, z));
    }
    expect(DECAY_PER_TICK).toBeGreaterThan(0);
  });

  it('trop de cubes retirés : les trous de surface se referment, les galeries restent', () => {
    const s = setup();
    const w = s.hub.world;
    // Des galeries profondes (plus que le seuil), et quelques trous en surface ailleurs.
    for (let x = 0; x < 192; x++)
      for (let y = 0; y < 16; y++) for (const z of [1, 2]) w.write(w.index(x, y, z), AIR, false);
    let dug = 0;
    for (const ci of w.changedChunks())
      for (const b of w.chunkChanges(ci).values()) if (b === AIR) dug++;
    expect(dug).toBeGreaterThan(REGEN_THRESHOLD);
    const holes: number[] = [];
    for (let x = 150; x < 154; x++)
      for (let y = 150; y < 154; y++) {
        const i = w.index(x, y, w.surface(x, y));
        w.write(i, AIR, false);
        holes.push(i);
      }
    s.advance(REGEN_IDLE + 1);
    expect(s.hub.maintain(s.now())).toBeGreaterThan(0);
    const fresh = new VoxelWorld(SHARED_SEED);
    for (const i of holes) {
      const c = w.cellOf(i);
      expect(w.get(c.x, c.y, c.z)).toBe(fresh.get(c.x, c.y, c.z));
    }
    // Les galeries profondes (sous la surface d'origine) sont gardées.
    expect(w.get(100, 5, 1)).toBe(AIR);
  });

  it('enregistrements espacés : le sac toutes les deux minutes, et au départ', async () => {
    const s = setup();
    const alice = await s.join(ALICE);
    const g = groundNearSpawn(s.hub.world);
    s.advance(2000);
    s.send(alice, { t: 'dig', i: g.index, h: 0 });
    expect(s.hub.flush().players.has(ALICE_ID)).toBe(true);
    s.advance(3000);
    s.send(alice, { t: 'dig', i: s.hub.world.index(g.x, g.y, g.z - 1), h: 0 });
    const soon = s.hub.flush();
    expect(soon.players.has(ALICE_ID)).toBe(false);
    expect(soon.pending).toBe(true);
    await s.hub.onClose(alice);
    expect(s.hub.flush().players.has(ALICE_ID)).toBe(true);
  });

  it('l’état général se relit prudemment', () => {
    expect(parseState({ zones: [{ id: 'x' }], bans: [['<b>', 1]], touched: [[9999, 1]] })).toEqual({
      zones: [],
      fading: [],
      bans: [],
      touched: [],
    });
  });
});
