import { describe, expect, it } from 'vitest';
import {
  AIR,
  ALL_ITEMS,
  BEDROCK,
  BLOCKS,
  COAL,
  CRYSTAL_ORE,
  DIRT,
  GLASS,
  GRASS,
  LOG,
  PAD,
  PLANKS,
  SAND,
  STICK,
  STONE,
  STONE_PICK,
  TORCH,
  WOOD_PICK,
  WORKBENCH,
  breakTime,
  dropOf,
  itemDef,
} from '../src/sandbox/blocks';
import { HOTBAR_SIZE, Inventory, RECIPES, type Station } from '../src/sandbox/inventory';
import { PATTERNS, buildChunk, computeLighting, lightAt, CAVE_LIGHT } from '../src/sandbox/mesh';
import {
  HEIGHT,
  collides,
  occupies,
  respawn,
  stepPlayer,
  type PlayerState,
} from '../src/sandbox/player';
import {
  MAX_UNDO,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  VoxelWorld,
  generate,
  raycast,
} from '../src/sandbox/world';

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const none = new Set<Station>();

/** Petit monde plat pour les tests de déplacement : on vide tout au-dessus de z = 4. */
function flatWorld(): VoxelWorld {
  const w = new VoxelWorld(1);
  for (let z = 0; z < SIZE_Z; z++)
    for (let y = 0; y < SIZE_Y; y++)
      for (let x = 0; x < SIZE_X; x++)
        w.blocks[w.index(x, y, z)] = z === 0 ? BEDROCK : z <= 4 ? STONE : AIR;
  return w;
}

describe('Chantier des mondes : le terrain', () => {
  it('reproductible : même graine, même terrain ; autre graine, autre relief', () => {
    expect(generate(1)).toEqual(generate(1));
    expect(generate(1)).not.toEqual(generate(2));
    const w = new VoxelWorld(1);
    for (let y = 0; y < SIZE_Y; y += 7)
      for (let x = 0; x < SIZE_X; x += 7) expect(w.get(x, y, 0)).toBe(BEDROCK);
    expect(w.get(w.spawn.x, w.spawn.y, w.spawn.z - 1)).toBe(PAD);
    expect(w.get(w.spawn.x, w.spawn.y, w.spawn.z)).toBe(AIR);
  });

  it('de quoi explorer : arbres, minerais, grottes', () => {
    const blocks = generate(1);
    const count = (b: number) => blocks.reduce((n, v) => n + (v === b ? 1 : 0), 0);
    expect(count(LOG)).toBeGreaterThan(20);
    expect(count(CRYSTAL_ORE)).toBeGreaterThan(5);
    expect(blocks.some((v) => v === GRASS)).toBe(true);
    // Grottes : de l'air sous la surface quelque part.
    const w = new VoxelWorld(1);
    let caves = 0;
    for (let y = 0; y < SIZE_Y; y++)
      for (let x = 0; x < SIZE_X; x++)
        for (let z = 2; z < w.surface(x, y) - 2; z++) if (w.get(x, y, z) === AIR) caves++;
    expect(caves).toBeGreaterThan(50);
  });

  it('creuser sous la surface, poser en hauteur, règles de la zone de départ', () => {
    const w = new VoxelWorld(1);
    const top = w.surface(3, 3);
    expect(w.dig(3, 3, top)).not.toBeNull();
    expect(w.dig(3, 3, top - 1)).not.toBeNull();
    expect(w.surface(3, 3)).toBeLessThan(top);
    const g = w.surface(10, 3);
    expect(w.place(10, 3, g + 1, STONE)).toBe(true);
    expect(w.place(10, 3, g + 2, STONE)).toBe(true);
    expect(w.dig(5, 5, 0)).toBeNull();
    const s = w.spawn;
    expect(w.dig(s.x, s.y, s.z - 1)).toBeNull();
    expect(w.placeProblem(s.x + 1, s.y, s.z, STONE)).toMatch(/protégée/);
    expect(w.placeProblem(2, 2, SIZE_Z - 1, STONE)).toMatch(/contre un autre cube/);
    expect(w.placeProblem(4, 4, w.surface(4, 4) + 1, STICK)).toMatch(/pas un cube/);
  });

  it('une torche tombe avec le cube qui la porte', () => {
    const w = new VoxelWorld(1);
    const z = w.surface(6, 6);
    expect(w.place(6, 6, z + 1, TORCH)).toBe(true);
    w.dig(6, 6, z);
    expect(w.get(6, 6, z + 1)).toBe(AIR);
  });

  it('annuler (créatif) et sauvegarde compacte relue prudemment', () => {
    const w = new VoxelWorld(1);
    const z = w.surface(2, 2);
    const before = w.get(2, 2, z);
    w.dig(2, 2, z);
    expect(w.undo()).toEqual({ x: 2, y: 2, z });
    expect(w.get(2, 2, z)).toBe(before);
    let n = 0;
    for (let y = 0; y < SIZE_Y && n < MAX_UNDO + 5; y++)
      for (let x = 0; x < SIZE_X && n < MAX_UNDO + 5; x++)
        if (w.dig(x, y, w.surface(x, y)) !== null) n++;
    let undone = 0;
    while (w.undo()) undone++;
    expect(undone).toBe(MAX_UNDO);

    const a = new VoxelWorld(1);
    const zz = a.surface(6, 6);
    a.dig(6, 6, zz);
    a.place(6, 6, zz, GLASS);
    const saved = JSON.parse(JSON.stringify(a.edits()));
    expect(saved).toHaveLength(1);
    const b = new VoxelWorld(1);
    expect(b.load(saved)).toBe(1);
    expect(b.blocks).toEqual(a.blocks);
    const s = b.spawn;
    const bad = [
      [-1, 3],
      [SIZE_X * SIZE_Y * SIZE_Z, 3],
      [0, BEDROCK],
      [b.index(5, 5, 0), AIR],
      [b.index(s.x, s.y, s.z - 1), AIR],
      [b.index(5, 5, 20), STICK],
      ['x', 1],
    ];
    const fresh = new VoxelWorld(1);
    expect(fresh.load(bad)).toBe(0);
    expect(fresh.blocks).toEqual(new VoxelWorld(1).blocks);
    expect(fresh.load('n’importe quoi')).toBe(0);
  });

  it('lancer de rayon : premier cube touché et case où poser, coupe comprise', () => {
    const w = new VoxelWorld(1);
    const top = w.surface(8, 8);
    const down = { x: 0, y: 0, z: -1 };
    const hit = raycast(w, { x: 8.5, y: 8.5, z: SIZE_Z + 5 }, down);
    expect(hit?.cell).toEqual({ x: 8, y: 8, z: top });
    expect(hit?.before).toEqual({ x: 8, y: 8, z: top + 1 });
    const cut = raycast(w, { x: 8.5, y: 8.5, z: SIZE_Z + 5 }, down, 80, top - 2);
    expect(cut!.cell.z).toBeLessThanOrEqual(top - 2);
    expect(raycast(w, { x: 5.5, y: 5.5, z: SIZE_Z + 1 }, { x: 0, y: 0, z: 1 })).toBeNull();
  });
});

describe('Chantier des mondes : récolte, outils et fabrication', () => {
  it('casser prend du temps ; une pioche va plus vite ; le cristal demande une pioche en pierre', () => {
    expect(breakTime(STONE, null)).toBeGreaterThan(breakTime(STONE, WOOD_PICK));
    expect(breakTime(STONE, WOOD_PICK)).toBeGreaterThan(breakTime(STONE, STONE_PICK));
    expect(breakTime(BEDROCK, STONE_PICK)).toBe(Infinity);
    expect(dropOf(GRASS, null)).toBe(DIRT);
    expect(dropOf(CRYSTAL_ORE, WOOD_PICK)).toBeNull();
    expect(dropOf(CRYSTAL_ORE, STONE_PICK)).not.toBeNull();
  });

  it('de l’arbre à la pioche en pierre, puis au verre : la progression complète', () => {
    const inv = new Inventory();
    inv.add(LOG, 3);
    for (let i = 0; i < 3; i++) expect(inv.craft(recipe('planches'), none)).toBe(true);
    expect(inv.count(PLANKS)).toBe(12);
    expect(inv.craft(recipe('planches'), none)).toBe(false); // plus de tronc
    expect(inv.craft(recipe('batons'), none)).toBe(true);
    expect(inv.craft(recipe('etabli'), none)).toBe(true);
    // La pioche demande un établi à côté.
    expect(inv.craftProblem(recipe('pioche-bois'), none)).toMatch(/établi/);
    const bench = new Set<Station>(['workbench']);
    expect(inv.craft(recipe('pioche-bois'), bench)).toBe(true);
    expect(inv.has(WOOD_PICK)).toBe(true);
    inv.add(STONE, 11);
    expect(inv.craft(recipe('pioche-pierre'), bench)).toBe(true);
    expect(inv.count(STICK)).toBe(0);
    expect(inv.craft(recipe('four'), bench)).toBe(true);
    inv.add(SAND, 4);
    inv.add(COAL, 1);
    expect(inv.craftProblem(recipe('verre'), bench)).toMatch(/four/);
    expect(inv.craft(recipe('verre'), new Set<Station>(['furnace']))).toBe(true);
    expect(inv.count(GLASS)).toBe(4);
  });

  it('fabrication tout ou rien : il manque un ingrédient, rien n’est retiré', () => {
    const inv = new Inventory();
    inv.add(PLANKS, 3);
    const before = [...inv.counts];
    expect(inv.craftProblem(recipe('pioche-bois'), new Set(['workbench']))).toMatch(/Bâton/);
    expect(inv.craft(recipe('pioche-bois'), new Set(['workbench']))).toBe(false);
    expect([...inv.counts]).toEqual(before);
  });

  it('barre rapide : nouvel objet rangé, objet épuisé retiré, sauvegarde relue prudemment', () => {
    const inv = new Inventory();
    inv.add(DIRT, 2);
    inv.add(STONE, 1);
    expect(inv.hotbar.slice(0, 2)).toEqual([DIRT, STONE]);
    expect(inv.held()).toBe(DIRT);
    expect(inv.remove(DIRT, 3)).toBe(false);
    expect(inv.remove(DIRT, 2)).toBe(true);
    expect(inv.hotbar[0]).toBeNull();
    expect(inv.held()).toBeNull();
    inv.assign(STONE, 0);
    expect(inv.hotbar[0]).toBe(STONE);
    expect(inv.hotbar[1]).toBeNull();
    const again = Inventory.parse(JSON.parse(JSON.stringify(inv.toJSON())));
    expect([...again.counts]).toEqual([...inv.counts]);
    expect(again.hotbar).toEqual(inv.hotbar);
    const bad = Inventory.parse({
      counts: [
        [9999, 5],
        [STONE, -3],
        [DIRT, 1e9],
        ['x', 1],
      ],
      hotbar: [DIRT, DIRT, 12345],
      selected: 42,
    });
    expect([...bad.counts]).toEqual([[DIRT, 999]]);
    expect(bad.hotbar.filter((h) => h !== null)).toEqual([DIRT]);
    expect(bad.selected).toBe(0);
    expect(bad.hotbar).toHaveLength(HOTBAR_SIZE);
  });

  it('chaque recette et chaque objet existent ; chaque cube a ses motifs dans l’atlas', () => {
    for (const r of RECIPES) {
      expect(itemDef(r.out[0]), r.id).toBeTruthy();
      for (const [item] of r.needs) expect(itemDef(item), r.id).toBeTruthy();
    }
    for (const b of BLOCKS.slice(1))
      for (const p of Object.values(b.tex)) expect(PATTERNS, b.name).toContain(p);
    expect(ALL_ITEMS.some((i) => i.id === WORKBENCH)).toBe(true);
    expect(ALL_ITEMS.some((i) => i.id === BEDROCK)).toBe(false);
  });
});

describe('Chantier des mondes : déplacements', () => {
  const at = (w: VoxelWorld, x: number, y: number): PlayerState => ({
    x,
    y,
    z: w.surface(Math.floor(x), Math.floor(y)) + 1,
    vz: 0,
    onGround: true,
  });
  const idle = { wish: { x: 0, y: 0 }, jump: false, sprint: false };

  it('la gravité pose le personnage au sol, sans traverser', () => {
    const w = flatWorld();
    const p: PlayerState = { x: 10.5, y: 10.5, z: 12, vz: 0, onGround: false };
    for (let i = 0; i < 120; i++) stepPlayer(p, idle, 1 / 60, w);
    expect(p.z).toBeCloseTo(5, 5);
    expect(p.onGround).toBe(true);
    expect(collides(w, p.x, p.y, p.z)).toBe(false);
  });

  it('un mur arrête ; on saute un cube ; la marche automatique le monte seule', () => {
    const w = flatWorld();
    w.blocks[w.index(12, 10, 5)] = STONE;
    const walk = { wish: { x: 1, y: 0 }, jump: false, sprint: false };
    const p = at(w, 10.5, 10.5);
    for (let i = 0; i < 120; i++) stepPlayer(p, walk, 1 / 60, w);
    expect(p.x).toBeLessThanOrEqual(12 - 0.3 + 1e-6);
    expect(p.z).toBeCloseTo(5, 5);
    // Saut : environ un cube et quart de hauteur.
    let top = p.z;
    stepPlayer(p, { ...idle, jump: true }, 1 / 60, w);
    for (let i = 0; i < 60; i++) {
      stepPlayer(p, idle, 1 / 60, w);
      top = Math.max(top, p.z);
    }
    expect(top - 5).toBeGreaterThan(1.05);
    expect(top - 5).toBeLessThan(1.6);
    // Marche automatique : on monte sur le cube.
    const q = at(w, 10.5, 10.5);
    let high = q.z;
    for (let i = 0; i < 120; i++) {
      stepPlayer(q, { ...walk, autoStep: true }, 1 / 60, w);
      high = Math.max(high, q.z);
    }
    expect(high).toBeCloseTo(6, 5);
    expect(q.x).toBeGreaterThan(13); // monté, passé par-dessus, redescendu
  });

  it('bords de la parcelle infranchissables ; chute : retour au départ ; corps occupé', () => {
    const w = flatWorld();
    const p = at(w, 1, 10.5);
    for (let i = 0; i < 120; i++) stepPlayer(p, { ...idle, wish: { x: -1, y: 0 } }, 1 / 60, w);
    expect(p.x).toBeGreaterThanOrEqual(0.3 - 1e-6);
    respawn(p, w);
    expect(p.z).toBe(w.spawn.z);
    expect(occupies(p, { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) + 1 })).toBe(
      true,
    );
    expect(
      occupies(p, { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z + HEIGHT) + 1 }),
    ).toBe(false);
  });
});

describe('Chantier des mondes : maillages et lumière', () => {
  it('seules les faces visibles sont dessinées', () => {
    const w = flatWorld();
    for (let z = 0; z < SIZE_Z; z++)
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) w.blocks[w.index(x, y, z)] = AIR;
    const light = computeLighting(w);
    w.blocks[w.index(5, 5, 10)] = STONE;
    expect(buildChunk(w, 0, 0, SIZE_Z - 1, light).opaque.faces).toBe(6);
    w.blocks[w.index(6, 5, 10)] = STONE;
    expect(buildChunk(w, 0, 0, SIZE_Z - 1, light).opaque.faces).toBe(10);
    // Le verre voisin laisse voir la face de la pierre ; le verre a son propre maillage.
    w.blocks[w.index(7, 5, 10)] = GLASS;
    const m = buildChunk(w, 0, 0, SIZE_Z - 1, light);
    expect(m.opaque.faces).toBe(10);
    expect(m.glass.faces).toBe(5);
    // En coupe sous le cube : rien n'est dessiné.
    expect(buildChunk(w, 0, 0, 9, light).opaque.faces).toBe(0);
  });

  it('lumière : plein jour dehors, sombre sous un toit, une torche éclaire', () => {
    const w = flatWorld();
    w.blocks[w.index(10, 10, 8)] = STONE; // un toit au-dessus de (10, 10, 5)
    let light = computeLighting(w);
    expect(lightAt(light, 20, 20, 5)).toBe(1);
    expect(lightAt(light, 10, 10, 5)).toBe(CAVE_LIGHT);
    w.blocks[w.index(11, 10, 5)] = TORCH;
    light = computeLighting(w);
    expect(lightAt(light, 10, 10, 5)).toBeGreaterThan(0.8);
  });
});
