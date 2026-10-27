import { describe, expect, it } from 'vitest';
import {
  AIR,
  BUCKET,
  CLAY,
  COAL,
  DIRT,
  FIRE,
  FLINT,
  GRAVEL,
  IRON_INGOT,
  IRON_ORE,
  LIGHTER,
  STONE,
  WATER,
  WATER_BUCKET,
  dropOf,
  itemDef,
  placeable,
} from '../src/sandbox/blocks';
import { Inventory, RECIPES } from '../src/sandbox/inventory';
import { inWater, stepPlayer, type PlayerState } from '../src/sandbox/player';
import { decodeUp, packChunk, unpackChunk } from '../src/sandbox/protocol';
import { useItem } from '../src/sandbox/rules';
import { SIZE_X, SIZE_Y, VoxelWorld, WATER_LEVEL, raycast } from '../src/sandbox/world';

/** Monde de départ entièrement calculé (une fois pour tout le fichier). */
const full = new VoxelWorld(1);
full.ensureAll();

/** Une case d'eau en surface d'un lac, loin des bords. */
function lakeCell(w: VoxelWorld) {
  for (let y = 10; y < SIZE_Y - 10; y++)
    for (let x = 10; x < SIZE_X - 10; x++)
      if (
        w.get(x, y, WATER_LEVEL) === WATER &&
        w.get(x, y, WATER_LEVEL - 1) === WATER &&
        !w.protectedCell(x, y, WATER_LEVEL)
      )
        return { x, y, z: WATER_LEVEL };
  throw new Error('aucun lac');
}

const count = (w: VoxelWorld, block: number) => {
  let n = 0;
  for (let i = 0; i < w.blocks.length; i++) if (w.blocks[i] === block) n++;
  return n;
};

describe('Chantier : eau, feu et matériaux', () => {
  it('le monde a des lacs (eau jusqu’au niveau de l’eau), de l’argile au fond et du fer', () => {
    expect(count(full, WATER)).toBeGreaterThan(500);
    expect(count(full, CLAY)).toBeGreaterThan(20);
    expect(count(full, IRON_ORE)).toBeGreaterThan(100);
    const c = lakeCell(full);
    expect(full.get(c.x, c.y, WATER_LEVEL + 1)).toBe(AIR);
    // Pas de grotte sous un lac : l'eau repose toujours sur du plein.
    let z = WATER_LEVEL;
    while (full.get(c.x, c.y, z) === WATER) z--;
    expect(full.solidAt(c.x, c.y, z)).toBe(true);
  });

  it('on vise à travers l’eau, sauf avec un seau ; on construit dans l’eau', () => {
    const w = new VoxelWorld(1);
    const c = lakeCell(full);
    const from = { x: c.x + 0.5, y: c.y + 0.5, z: WATER_LEVEL + 3 };
    const down = { x: 0, y: 0, z: -1 };
    expect(w.get(raycast(w, from, down)!.cell.x, c.y, raycast(w, from, down)!.cell.z)).not.toBe(
      WATER,
    );
    expect(raycast(w, from, down, 80, 47, true)!.cell.z).toBe(WATER_LEVEL);
    // Un cube peut prendre la place de l'eau (contre le fond) ; de l'eau sur de l'eau, non.
    let z = WATER_LEVEL;
    while (w.get(c.x, c.y, z - 1) === WATER) z--;
    expect(w.placeProblem(c.x, c.y, z, STONE)).toBeNull();
    expect(w.placeProblem(c.x, c.y, z, WATER)).toMatch(/déjà de l’eau/);
    expect(w.breakProblem(c.x, c.y, WATER_LEVEL)).toMatch(/seau/);
  });

  it('creuser à côté de l’eau : elle vient remplir le trou (une case)', () => {
    const w = new VoxelWorld(1);
    const x = w.spawn.x + 6;
    const y = w.spawn.y + 4;
    const z = w.surface(x, y);
    // Une case d'eau versée juste à côté du cube que l'on creuse.
    w.write(w.index(x + 1, y, z), WATER);
    expect(w.dig(x, y, z)).not.toBeNull();
    expect(w.get(x, y, z)).toBe(WATER);
    // Loin de l'eau : un trou sec.
    const z2 = w.surface(x - 3, y);
    w.dig(x - 3, y, z2);
    expect(w.get(x - 3, y, z2)).toBe(AIR);
  });

  it('nager : on coule doucement, on remonte avec le saut, on sort contre un bord', () => {
    const w = new VoxelWorld(1);
    const c = lakeCell(full);
    let floor = WATER_LEVEL;
    while (w.get(c.x, c.y, floor) === WATER) floor--;
    const p: PlayerState = {
      x: c.x + 0.5,
      y: c.y + 0.5,
      z: WATER_LEVEL - 0.5,
      vz: 0,
      onGround: false,
    };
    expect(inWater(w, p)).toBe(true);
    stepPlayer(p, { wish: { x: 0, y: 0 }, jump: false, sprint: false }, 0.5, w);
    // En une demi-seconde, on n'est pas tombé comme une pierre.
    expect(p.z).toBeGreaterThan(WATER_LEVEL - 0.5 - 1.5);
    const before = p.z;
    for (let i = 0; i < 10; i++)
      stepPlayer(p, { wish: { x: 0, y: 0 }, jump: true, sprint: false }, 0.05, w);
    expect(p.z).toBeGreaterThan(before);
    expect(p.z).toBeGreaterThan(floor);
  });

  it('seau : l’eau des lacs ne s’épuise pas ; l’eau versée se reprend', () => {
    const w = new VoxelWorld(1);
    const c = lakeCell(full);
    const inv = new Inventory();
    inv.add(BUCKET, 1);
    const lake = w.index(c.x, c.y, c.z);
    expect(useItem(w, inv, BUCKET, lake)).toEqual({ changes: [] });
    expect(w.get(c.x, c.y, c.z)).toBe(WATER);
    expect(inv.has(WATER_BUCKET)).toBe(true);
    expect(inv.has(BUCKET)).toBe(false);
    // Verser sur la terre ferme, à côté du départ.
    const x = w.spawn.x + 5;
    const y = w.spawn.y + 3;
    const top = w.surface(x, y);
    const spot = w.index(x, y, top + 1);
    expect(useItem(w, inv, WATER_BUCKET, spot)).toEqual({ changes: [[spot, WATER]] });
    expect(inv.has(BUCKET)).toBe(true);
    // Reprise : la case redevient de l'air.
    expect(useItem(w, inv, BUCKET, spot)).toEqual({ changes: [[spot, AIR]] });
    expect(w.get(x, y, top + 1)).toBe(AIR);
    expect('problem' in useItem(w, inv, WATER_BUCKET, w.index(x, y, top))).toBe(true);
  });

  it('briquet : un feu sur le dessus d’un cube ; un coup l’éteint ; il tombe avec son cube', () => {
    const w = new VoxelWorld(1);
    const inv = new Inventory();
    inv.add(LIGHTER, 1);
    const x = w.spawn.x + 5;
    const y = w.spawn.y - 3;
    const top = w.surface(x, y);
    const spot = w.index(x, y, top + 1);
    expect(useItem(w, inv, LIGHTER, spot)).toEqual({ changes: [[spot, FIRE]] });
    expect(inv.has(LIGHTER)).toBe(true); // le briquet ne s'use pas
    expect('problem' in useItem(w, inv, LIGHTER, w.index(x, y, top + 3))).toBe(true); // en l'air
    expect(dropOf(FIRE, null)).toBeNull();
    expect(itemDef(FIRE)).toBeNull();
    w.dig(x, y, top);
    expect(w.get(x, y, top + 1)).toBe(AIR);
  });

  it('nouvelles recettes : minerai de fer → lingot (four) → seau (établi)', () => {
    const inv = new Inventory();
    inv.add(IRON_ORE, 3);
    inv.add(COAL, 3);
    const ingot = RECIPES.find((r) => r.id === 'lingot-fer')!;
    expect(inv.craftProblem(ingot, new Set())).toMatch(/four/);
    for (let i = 0; i < 3; i++) expect(inv.craft(ingot, new Set(['furnace']))).toBe(true);
    expect(inv.count(IRON_INGOT)).toBe(3);
    const bucket = RECIPES.find((r) => r.id === 'seau')!;
    expect(inv.craft(bucket, new Set(['workbench']))).toBe(true);
    expect(inv.count(BUCKET)).toBe(1);
    // Les anciennes recettes gardent leur numéro (le serveur les reconnaît par ce numéro).
    expect(RECIPES[0]!.id).toBe('planches');
    expect(RECIPES[11]!.id).toBe('corail');
    // Le gravier cache parfois un silex.
    expect(dropOf(GRAVEL, null, 0.01)).toBe(FLINT);
    expect(dropOf(GRAVEL, null, 0.9)).toBe(GRAVEL);
    expect(dropOf(IRON_ORE, null)).toBeNull(); // il faut une pioche en pierre
  });

  it('l’eau et le feu voyagent dans les tranches et les messages', () => {
    expect(placeable(WATER) && placeable(FIRE) && placeable(DIRT)).toBe(true);
    const w = new VoxelWorld(1);
    const i = w.index(5, 5, 30);
    const m = new Map([[i, WATER]]);
    expect(unpackChunk(w.chunkOf(i), packChunk(w.chunkOf(i), m))).toEqual(m);
    expect(decodeUp('{"t":"use","i":5,"h":114}')).toEqual({ t: 'use', i: 5, h: BUCKET });
    expect(decodeUp('{"t":"use","i":5,"h":3}')).toBeNull();
    expect(decodeUp('{"t":"put","i":5,"b":26}')).toBeNull(); // l'eau ne se pose qu'au seau
  });
});
