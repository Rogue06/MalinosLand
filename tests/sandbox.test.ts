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
  GRAVEL,
  HUB_FLOOR,
  HUB_GLASS,
  HUB_WALL,
  LOG,
  PAD,
  PLANKS,
  SAND,
  SNOW,
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
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  actionsOf,
  copyBindings,
  keyLabel,
  parseBindings,
  pressed,
  rebind,
  reserved,
} from '../src/sandbox/controls';
import { packDrops, parseDrops, spawnDrop, stepDrops } from '../src/sandbox/drops';
import { IMPACT, STRIKE, strikeAngle } from '../src/sandbox/game';
import { HOTBAR_SIZE, Inventory, RECIPES, type Station } from '../src/sandbox/inventory';
import { TUTORIAL, TutorialTracker, currentStep } from '../src/sandbox/tutorial';
import {
  CAVE_LIGHT,
  PATTERNS,
  buildChunk,
  computeLighting,
  lightAt,
  scanLights,
} from '../src/sandbox/mesh';
import {
  HEIGHT,
  collides,
  occupies,
  respawn,
  stepPlayer,
  type PlayerState,
} from '../src/sandbox/player';
import {
  HUB,
  MAX_UNDO,
  SPAWN_X,
  SPAWN_Y,
  SIZE_X,
  SIZE_Y,
  SIZE_Z,
  VoxelWorld,
  genChunk,
  raycast,
} from '../src/sandbox/world';

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const none = new Set<Station>();

/** Petit monde plat pour les tests de déplacement : on vide tout au-dessus de z = 4. */
function flatWorld(): VoxelWorld {
  const w = new VoxelWorld(1);
  w.markAllGenerated();
  for (let z = 0; z <= 4; z++)
    for (let y = 0; y < SIZE_Y; y++)
      for (let x = 0; x < SIZE_X; x++) w.blocks[w.index(x, y, z)] = z === 0 ? BEDROCK : STONE;
  return w;
}

describe('Chantier des mondes : le terrain', () => {
  it('reproductible : même graine, même terrain ; autre graine, autre relief', () => {
    expect(genChunk(1, 3, 5)).toEqual(genChunk(1, 3, 5));
    expect(genChunk(1, 3, 5)).not.toEqual(genChunk(2, 3, 5));
    const w = new VoxelWorld(1);
    // Rien n'est calculé d'avance : seulement les tranches dont on a besoin.
    expect(w.isGenerated(0, 0)).toBe(false);
    expect(w.get(3, 3, 0)).toBe(BEDROCK);
    expect(w.isGenerated(0, 0)).toBe(true);
    expect(w.isGenerated(5, 5)).toBe(false);
    for (let y = 0; y < SIZE_Y; y += 23)
      for (let x = 0; x < SIZE_X; x += 7) expect(w.get(x, y, 0)).toBe(BEDROCK);
    expect(w.get(w.spawn.x, w.spawn.y, w.spawn.z - 1)).toBe(PAD);
    expect(w.get(w.spawn.x, w.spawn.y, w.spawn.z)).toBe(AIR);
  });

  it('de quoi explorer : arbres, minerais, grottes', () => {
    const w = new VoxelWorld(1);
    w.ensureAll();
    const blocks = w.blocks;
    const count = (b: number) => blocks.reduce((n, v) => n + (v === b ? 1 : 0), 0);
    expect(count(LOG)).toBeGreaterThan(200);
    expect(count(CRYSTAL_ORE)).toBeGreaterThan(50);
    expect(count(SNOW)).toBeGreaterThan(20);
    expect(blocks.some((v) => v === GRASS)).toBe(true);
    // Grottes : de l'air sous la surface quelque part.
    let caves = 0;
    for (let y = 0; y < SIZE_Y; y += 2)
      for (let x = 0; x < SIZE_X; x += 2)
        for (let z = 2; z < w.surface(x, y) - 2; z++) if (w.get(x, y, z) === AIR) caves++;
    expect(caves).toBeGreaterThan(200);
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

  it('le Hub des Malinos au loin : présent, protégé, entrée vitrée, chemin de gravier', () => {
    const w = new VoxelWorld(1);
    const floor = w.get(HUB.x0 + 10, HUB.y0 + 10, HUB.z);
    expect(floor).toBe(HUB_FLOOR);
    // La tour dépasse tout : on la voit de loin.
    let tower = 0;
    for (let y = HUB.y0; y < HUB.y0 + HUB.d; y++)
      for (let x = HUB.x0; x < HUB.x0 + HUB.w; x++) tower = Math.max(tower, w.surface(x, y));
    expect(tower).toBeGreaterThanOrEqual(HUB.z + 24);
    // Incassable, et on ne construit pas tout contre.
    const wallX = HUB.x0 + 4;
    const wallY = HUB.y0 + HUB.d - 5;
    expect(w.get(wallX, wallY, HUB.z + 1)).toBe(HUB_WALL);
    expect(w.breakProblem(wallX, wallY, HUB.z + 1)).toMatch(/Hub des Malinos/);
    expect(w.placeProblem(HUB.x0 - 1, HUB.y0 + 5, HUB.z + 1, STONE)).toMatch(/Hub des Malinos/);
    // Entrée vitrée en face du point de départ ; chemin de gravier jusqu'à elle.
    expect(w.get(SPAWN_X, HUB.y0 + HUB.d - 5, HUB.z + 2)).toBe(HUB_GLASS);
    expect(w.get(SPAWN_X, SPAWN_Y - 20, w.surface(SPAWN_X, SPAWN_Y - 20))).toBe(GRAVEL);
    // Le Hub est au nord, à bonne distance du départ.
    expect(SPAWN_Y - (HUB.y0 + HUB.d)).toBeGreaterThan(50);
  });

  it('tranches calculées séparément : bords raccord (arbres à cheval compris)', () => {
    const a = new VoxelWorld(1);
    const b = new VoxelWorld(1);
    // Ordre de calcul différent, même monde.
    b.ensureChunk(4, 4);
    b.ensureChunk(3, 4);
    a.ensureChunk(3, 4);
    a.ensureChunk(4, 4);
    for (let z = 0; z < SIZE_Z; z++)
      for (let y = 64; y < 80; y++)
        for (let x = 48; x < 80; x++) expect(a.get(x, y, z)).toBe(b.get(x, y, z));
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
    expect(b.get(6, 6, zz)).toBe(GLASS);
    expect(b.edits()).toEqual(a.edits());
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
    expect(fresh.edits()).toEqual([]);
    expect(fresh.get(5, 5, 0)).toBe(BEDROCK);
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

  it('accroupi (Maj) : plus lent, et on reste au bord au lieu de tomber', () => {
    const w = flatWorld();
    // Un trou de deux cubes de large devant le joueur (x = 12 et 13).
    for (let z = 1; z <= 4; z++)
      for (let y = 0; y < SIZE_Y; y++) {
        w.blocks[w.index(12, y, z)] = AIR;
        w.blocks[w.index(13, y, z)] = AIR;
      }
    const walk = { wish: { x: 1, y: 0 }, jump: false, sprint: false };
    const p = at(w, 10.5, 10.5);
    for (let i = 0; i < 180; i++) stepPlayer(p, { ...walk, sneak: true }, 1 / 60, w);
    expect(p.z).toBeCloseTo(5, 5);
    expect(p.x).toBeGreaterThan(11.5);
    expect(p.x).toBeLessThan(12.3 + 1e-6);
    // Sans Maj : on tombe dans le trou.
    const q = at(w, 10.5, 10.5);
    for (let i = 0; i < 60; i++) stepPlayer(q, walk, 1 / 60, w);
    expect(q.z).toBeLessThan(5);
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
    // Les sources de lumière sont cherchées tranche par tranche, à la demande.
    expect(lightAt(light, 10, 10, 5)).toBe(CAVE_LIGHT);
    scanLights(light, 0, 0);
    expect(lightAt(light, 10, 10, 5)).toBeGreaterThan(0.8);
  });
});

describe('Chantier des mondes : tutoriel et coups de pioche', () => {
  const state = (
    o: Partial<{ looked: number; walked: number; items: Record<number, number>; placed: number[] }>,
  ) => ({
    looked: o.looked ?? 0,
    walked: o.walked ?? 0,
    count: (i: number) => o.items?.[i] ?? 0,
    placed: (b: number) => (o.placed ?? []).includes(b),
  });

  it('les étapes avancent avec ce que fait le joueur, dans l’ordre', () => {
    expect(currentStep(state({}))).toBe(0);
    expect(currentStep(state({ looked: 2 }))).toBe(1);
    expect(currentStep(state({ looked: 2, walked: 6 }))).toBe(2);
    expect(TUTORIAL[2]!.id).toBe('couper');
    expect(currentStep(state({ looked: 2, walked: 6, items: { [LOG]: 1 } }))).toBe(3);
    // Une étape déjà atteinte ne revient pas en arrière quand on dépense ses planches.
    const later = state({ looked: 2, walked: 6, placed: [WORKBENCH] });
    expect(currentStep(later, 4)).toBe(5);
    const all = state({
      looked: 2,
      walked: 6,
      items: { [WOOD_PICK]: 1, [STONE]: 2 },
      placed: [WORKBENCH, STONE],
    });
    expect(currentStep(all, 5)).toBeNull();
  });

  it('chaque étape a une consigne au clavier et au doigt', () => {
    for (const s of TUTORIAL) {
      expect(s.title && s.text && s.touch, s.id).toBeTruthy();
    }
    expect(new Set(TUTORIAL.map((s) => s.id)).size).toBe(TUTORIAL.length);
  });

  it('le bras est levé juste avant l’impact (le bruit), puis abattu', () => {
    expect(strikeAngle(0)).toBeCloseTo(0, 5);
    expect(strikeAngle(IMPACT - 0.001)).toBeGreaterThan(0.8);
    const after = strikeAngle(IMPACT + (1 - IMPACT) * 0.35);
    expect(after).toBeLessThan(-0.5);
    expect(strikeAngle(0.999)).toBeCloseTo(0, 1);
    expect(STRIKE).toBeGreaterThan(0.2);
    expect(STRIKE).toBeLessThan(0.5);
  });
});

describe('Chantier des mondes : touches réglables', () => {
  it('changer une touche ; une touche déjà prise est échangée, jamais perdue', () => {
    let b = copyBindings(DEFAULT_BINDINGS);
    b = rebind(b, 'sprint', 'KeyR');
    expect(b.sprint[0]).toBe('KeyR');
    expect(pressed(b, 'sprint', new Set(['KeyR']))).toBe(true);
    // Courir prend la touche d'accroupissement : s'accroupir reçoit l'ancienne touche de course.
    b = rebind(b, 'sprint', 'ShiftLeft');
    expect(b.sprint[0]).toBe('ShiftLeft');
    expect(b.sneak).toContain('ShiftRight');
    // Avancer sur une touche unique d'une autre action : échange.
    b = rebind(copyBindings(DEFAULT_BINDINGS), 'forward', 'KeyE');
    expect(b.forward[0]).toBe('KeyE');
    expect(b.inventory).toEqual(['KeyW']);
    for (const { id } of ACTIONS) expect(b[id].length, id).toBeGreaterThan(0);
    expect(actionsOf(b, 'KeyE')).toEqual(['forward']);
  });

  it('touches réservées refusées ; réglages relus prudemment', () => {
    const b = copyBindings(DEFAULT_BINDINGS);
    expect(rebind(b, 'jump', 'Escape')).toBe(b);
    expect(rebind(b, 'jump', 'Digit3')).toBe(b);
    expect(reserved('Digit9')).toBe(true);
    const parsed = parseBindings({
      forward: ['KeyI', 'KeyI', '<script>'],
      back: 'KeyK',
      jump: ['Escape'],
      sprint: ['KeyI'],
    });
    expect(parsed.forward).toEqual(['KeyI']);
    expect(parsed.back).toEqual(DEFAULT_BINDINGS.back);
    expect(parsed.jump).toEqual(DEFAULT_BINDINGS.jump);
    // KeyI déjà pris par « avancer » : « courir » garde sa touche par défaut.
    expect(parsed.sprint).toEqual(DEFAULT_BINDINGS.sprint);
    expect(parseBindings(null)).toEqual(DEFAULT_BINDINGS);
  });

  it('noms lisibles, avec la vraie lettre du clavier quand on la connaît', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('KeyW', new Map([['KeyW', 'z']]))).toBe('Z');
    expect(keyLabel('Space')).toBe('Espace');
    expect(keyLabel('ShiftLeft')).toBe('Maj gauche');
    expect(keyLabel('ArrowUp')).toBe('↑');
  });
});

describe('Chantier des mondes : objets au sol', () => {
  it('l’objet tombe, se pose, puis vient dans le sac quand on passe à côté', () => {
    const w = flatWorld();
    const drops = [spawnDrop({ x: 10, y: 10, z: 8 }, STONE)];
    const far = { x: 30.5, y: 30.5, z: 5 };
    for (let i = 0; i < 120; i++) expect(stepDrops(drops, far, w, 1 / 60, () => true)).toEqual([]);
    expect(drops[0]!.z).toBeCloseTo(5, 5);
    expect(drops[0]!.vz).toBe(0);
    // Le joueur arrive à côté : l'objet est attiré puis ramassé.
    const near = { x: 11.6, y: 10.5, z: 5 };
    let picked: number[] = [];
    for (let i = 0; i < 60 && picked.length === 0; i++)
      picked = stepDrops(drops, near, w, 1 / 60, () => true);
    expect(picked).toEqual([STONE]);
    expect(drops).toHaveLength(0);
  });

  it('pas ramassé tout de suite, ni quand le sac est plein ; sauvegarde relue prudemment', () => {
    const w = flatWorld();
    const p = { x: 10.5, y: 10.5, z: 5 };
    const drops = [spawnDrop({ x: 10, y: 10, z: 4 }, DIRT)];
    expect(stepDrops(drops, p, w, 0.1, () => true)).toEqual([]);
    for (let i = 0; i < 60; i++) expect(stepDrops(drops, p, w, 1 / 60, () => false)).toEqual([]);
    expect(drops).toHaveLength(1);
    const saved = JSON.parse(JSON.stringify(packDrops(drops)));
    expect(parseDrops(saved, (id) => !!itemDef(id))).toHaveLength(1);
    expect(
      parseDrops(
        [
          [99999, 1, 1, 1],
          [STONE, -5, 1, 1],
          [STONE, 1, 1],
          ['x', 1, 1, 1],
        ],
        (id) => !!itemDef(id),
      ),
    ).toEqual([]);
  });
});

describe('Chantier des mondes : fin du tutoriel', () => {
  it('le tutoriel fini ne « change » qu’une fois : pas de son en boucle, carte stable', () => {
    const done = {
      looked: 2,
      walked: 6,
      count: (i: number) => (i === WOOD_PICK || i === STONE ? 1 : 0),
      placed: (b: number) => b === WORKBENCH || b === STONE,
    };
    const t = new TutorialTracker(5);
    const first = t.update(done);
    expect(first).toEqual({ step: null, changed: true, progressed: false });
    for (let i = 0; i < 100; i++) expect(t.update(done).changed).toBe(false);
    expect(t.reached).toBe(TUTORIAL.length);
    // Une étape réussie : un seul son.
    const s = new TutorialTracker(0);
    const st = { looked: 0, walked: 0, count: () => 0, placed: () => false };
    expect(s.update(st)).toMatchObject({ step: 0, changed: true, progressed: false });
    st.looked = 2;
    expect(s.update(st)).toMatchObject({ step: 1, changed: true, progressed: true });
    expect(s.update(st).changed).toBe(false);
  });
});
