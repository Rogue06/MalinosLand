import { describe, expect, it } from 'vitest';
import { AIR, DIRT, HUB_WALL, PAD, STONE, WOOD_PICK } from '../src/sandbox/blocks';
import { Inventory } from '../src/sandbox/inventory';
import {
  CELLS,
  chunkOfIndex,
  decodeDown,
  decodeUp,
  encode,
  fromBase64,
  packChunk,
  toBase64,
  unpackChunk,
} from '../src/sandbox/protocol';
import { CHUNK, CHUNKS_X, SIZE_Z, VoxelWorld } from '../src/sandbox/world';
import { chantierUrl } from '../src/sandbox/online';

describe('Chantier partagé : protocole', () => {
  it('valide les demandes du navigateur', () => {
    expect(decodeUp(encode({ t: 'dig', i: 5, h: 0 }))).toEqual({ t: 'dig', i: 5, h: 0 });
    expect(decodeUp('{"t":"dig","i":-1,"h":0}')).toBeNull();
    expect(decodeUp(`{"t":"dig","i":${CELLS},"h":0}`)).toBeNull();
    expect(decodeUp('{"t":"put","i":5,"b":12}')).toBeNull(); // socle : ne se pose pas
    expect(decodeUp('{"t":"put","i":5,"b":101}')).toBeNull(); // pioche : pas un cube
    expect(decodeUp('{"t":"craft","r":999}')).toBeNull();
    expect(decodeUp('{"t":"mv","x":1e9,"y":2,"z":3,"a":0}')).toBeNull();
    expect(decodeUp('{"t":"mv","x":1.23456,"y":2,"z":3,"a":0.5}')).toEqual({
      t: 'mv',
      x: 1.23,
      y: 2,
      z: 3,
      a: 0.5,
    });
    expect(decodeUp('{"t":"hi","name":"<b>"}')).toEqual({ t: 'hi', name: 'Visiteur' });
    expect(decodeUp('{"t":"welcome"}')).toBeNull(); // message du serveur
    expect(decodeUp('x'.repeat(600))).toBeNull();
  });

  it('valide les messages du serveur', () => {
    expect(decodeDown('{"t":"no","why":"guest"}')).toEqual({ t: 'no', why: 'guest' });
    expect(decodeDown('{"t":"no","why":"autre"}')).toBeNull();
    expect(decodeDown(encode({ t: 'set', e: [10, PAD] }))).toEqual({ t: 'set', e: [10, PAD] });
    expect(decodeDown('{"t":"set","e":[10]}')).toBeNull();
    expect(decodeDown('{"t":"inv","c":[[2,5],[9999,1]]}')).toBeNull();
    expect(
      decodeDown('{"t":"join","id":"ab","name":"Alice","v":true,"x":1,"y":1,"z":1,"a":0}'),
    ).toBeNull();
    const welcome = decodeDown(
      encode({
        t: 'welcome',
        id: 'g0123456789abcde',
        name: 'Zoé',
        build: false,
        inv: [[DIRT, 2]],
        x: 1,
        y: 2,
        z: 3,
        peers: [
          { id: '0123456789abcdef0123456789abcdef', name: 'Bob', v: true, x: 4, y: 5, z: 6, a: 1 },
        ],
      }),
    );
    expect(welcome).toMatchObject({ t: 'welcome', name: 'Zoé', peers: [{ name: 'Bob', v: true }] });
  });

  it('tranches compactes : aller-retour, données invalides refusées', () => {
    const ci = 3 + CHUNKS_X * 7;
    const w = new VoxelWorld(1);
    const ox = 3 * CHUNK;
    const oy = 7 * CHUNK;
    const changes = new Map([
      [w.index(ox, oy, 0), STONE],
      [w.index(ox + 15, oy + 15, SIZE_Z - 1), AIR],
      [w.index(ox + 4, oy + 9, 20), DIRT],
    ]);
    const bytes = packChunk(ci, changes);
    expect(bytes.length).toBe(9);
    for (const i of changes.keys()) expect(chunkOfIndex(i)).toBe(ci);
    const text = toBase64(bytes);
    expect(unpackChunk(ci, fromBase64(text)!)).toEqual(changes);
    expect(fromBase64('pas du base64 !')).toBeNull();
    expect(unpackChunk(ci, new Uint8Array([0, 0]))).toBeNull();
    expect(unpackChunk(ci, new Uint8Array([0, 0, HUB_WALL]))).toBeNull();
    expect(unpackChunk(ci, new Uint8Array([0xff, 0xff, DIRT]))).toBeNull();
  });

  it('le monde reçoit les modifications d’une tranche sans recalculer le terrain', () => {
    const w = new VoxelWorld(1);
    const x = w.spawn.x + 5;
    const y = w.spawn.y;
    const z = 30;
    const i = w.index(x, y, z);
    const ci = w.chunkOf(i);
    expect(w.setChunkChanges(ci, new Map([[i, STONE]]))).toBe(1);
    expect(w.isGenerated(Math.floor(x / CHUNK), Math.floor(y / CHUNK))).toBe(false);
    expect(w.get(x, y, z)).toBe(STONE);
    // Remplacer : l'ancienne modification disparaît, le terrain de départ revient.
    const before = new VoxelWorld(1).get(x, y, z);
    w.setChunkChanges(ci, new Map());
    expect(w.get(x, y, z)).toBe(before);
    // Case d'une autre tranche, ou zone protégée : ignorées.
    const other = w.index(x + CHUNK, y, z);
    const spawn = w.index(w.spawn.x, w.spawn.y, w.spawn.z);
    expect(w.setChunkChanges(ci, new Map([[other, STONE]]))).toBe(0);
    expect(w.setChunkChanges(w.chunkOf(spawn), new Map([[spawn, STONE]]))).toBe(0);
    expect(w.changedChunks()).toEqual([]);
  });

  it('le sac suit le serveur en gardant l’ordre de la barre rapide', () => {
    const inv = new Inventory();
    inv.add(DIRT, 3);
    inv.add(WOOD_PICK, 1);
    inv.assign(WOOD_PICK, 4);
    inv.setCounts([
      [WOOD_PICK, 1],
      [STONE, 2],
    ]);
    expect(inv.hotbar[4]).toBe(WOOD_PICK);
    expect(inv.hotbar.includes(DIRT)).toBe(false);
    expect(inv.hotbar.includes(STONE)).toBe(true);
    expect(inv.stacks()).toEqual([
      [WOOD_PICK, 1],
      [STONE, 2],
    ]);
  });

  it('adresse du Chantier partagé à partir de celle du serveur temps réel', () => {
    expect(chantierUrl('wss://serveur.exemple/ws')).toBe('wss://serveur.exemple/chantier');
    expect(chantierUrl('ws://localhost:8787/ws')).toBe('ws://localhost:8787/chantier');
    expect(chantierUrl(null)).toBeNull();
  });
});
