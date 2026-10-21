import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/content/catalog';
import { FURNITURE, FURNITURE_COLORS, MAX_DECOR_ITEMS } from '../src/content/furniture';
import { HOME_RULES, MAPS, loadHomeWorld } from '../src/content/world';
import { OBJECT_ART } from '../src/game/art/objects';
import {
  buildHomeMap,
  checkPlacement,
  decorIndex,
  itemAt,
  parseDecor,
  splitHomeMap,
  type DecorItem,
} from '../src/world/decor';

const studio = MAPS.studio!;
const item = (t: string, x: number, y: number, r: 0 | 1 | 2 | 3 = 0, v = 0): DecorItem => ({
  t,
  x,
  y,
  r,
  v,
});

describe('catalogue de meubles', () => {
  it('chaque meuble existe dans le catalogue et a un dessin', () => {
    for (const f of FURNITURE) {
      expect(CATALOG[f.type], f.type).toBeDefined();
      expect(OBJECT_ART[f.type], f.type).toBeDefined();
    }
    for (const t of Object.keys(FURNITURE_COLORS))
      expect(FURNITURE.some((f) => f.type === t)).toBe(true);
  });

  it('la base autorise exactement les mêmes meubles (migration)', () => {
    const files = import.meta.glob<string>('../supabase/migrations/*_home_decor.sql', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const sql = Object.values(files)[0] ?? '';
    const list = /array\[([^\]]+)\]/.exec(sql)?.[1] ?? '';
    const types = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(types).toEqual(FURNITURE.map((f) => f.type).sort());
    expect(sql).toContain(`> ${MAX_DECOR_ITEMS}`);
  });
});

describe('décoration du logement', () => {
  it('le studio d’origine garde tous ses meubles', () => {
    const { furniture, fixed } = splitHomeMap(studio, HOME_RULES);
    expect(fixed.map((o) => o.type).sort()).toEqual(['doormat', 'elevator']);
    const { items } = buildHomeMap(studio, null, HOME_RULES);
    expect(items).toEqual(furniture);
    const { world } = loadHomeWorld(null);
    expect(world.getObject('elevator')).toBeDefined();
  });

  it('lit une décoration en ignorant les entrées invalides', () => {
    const raw = [
      item('sofa', 2, 2, 1, 2),
      { t: 'elevator', x: 2, y: 2, r: 0, v: 0 },
      { t: 'sofa', x: 2.5, y: 2, r: 0, v: 0 },
      { t: 'sofa', x: 2, y: 2, r: 4, v: 0 },
      'n’importe quoi',
      item('lamp_floor', 3, 3, 0, 3),
    ];
    expect(parseDecor(raw, HOME_RULES)).toEqual([
      item('sofa', 2, 2, 1, 2),
      item('lamp_floor', 3, 3),
    ]);
    expect(parseDecor(null, HOME_RULES)).toBeNull();
    expect(parseDecor(Array(60).fill(item('plant', 3, 3)), HOME_RULES)).toHaveLength(
      MAX_DECOR_ITEMS,
    );
  });

  it('refuse les placements impossibles, avec la bonne raison', () => {
    const empty: DecorItem[] = [];
    expect(checkPlacement(studio, empty, item('plant', 3, 3), HOME_RULES)).toBeNull();
    expect(checkPlacement(studio, empty, item('plant', 0, 3), HOME_RULES)).toBe('outside');
    expect(checkPlacement(studio, empty, item('sofa', 10, 3), HOME_RULES)).toBe('outside');
    expect(checkPlacement(studio, empty, item('plant', 5, 1), HOME_RULES)).toBe('entrance');
    expect(checkPlacement(studio, empty, item('rug', 4, 2), HOME_RULES)).toBe('entrance');
    expect(checkPlacement(studio, [item('plant', 3, 3)], item('plant', 3, 3), HOME_RULES)).toBe(
      'overlap',
    );
    expect(
      checkPlacement(studio, [item('rug', 2, 5)], item('coffee_table', 3, 5), HOME_RULES),
    ).toBeNull();
    expect(checkPlacement(studio, [item('rug', 2, 5)], item('rug', 3, 6), HOME_RULES)).toBe(
      'overlap',
    );
    expect(
      checkPlacement(studio, empty, item('plant', 3, 3), HOME_RULES, [{ x: 3.5, y: 3.4 }]),
    ).toBe('person');
    expect(checkPlacement(studio, empty, item('telescope', 3, 3), HOME_RULES)).toBeNull();
    expect(checkPlacement(studio, empty, item('cat', 3, 3), { ...HOME_RULES, max: 0 })).toBe(
      'full',
    );
    expect(checkPlacement(studio, empty, item('elevator', 3, 3), HOME_RULES)).toBe('type');
  });

  it('garde toujours un passage jusqu’à l’ascenseur', () => {
    // Un fauteuil en bas, puis un mur de bibliothèques sur toute la largeur : la dernière
    // bibliothèque l'enfermerait, elle est refusée.
    const wall = [
      item('armchair', 3, 7),
      ...Array.from({ length: 10 }, (_, i) => item('bookshelf', i + 1, 4)),
    ];
    const { items } = buildHomeMap(studio, wall, HOME_RULES);
    expect(items).toHaveLength(wall.length - 1);
    expect(items[0]).toEqual(item('armchair', 3, 7));
    // Un fauteuil emmuré n'est pas accepté.
    const box = [
      item('plant', 2, 7),
      item('plant', 4, 7),
      item('plant', 3, 6),
      item('plant', 3, 8),
    ];
    expect(checkPlacement(studio, box, item('armchair', 3, 7), HOME_RULES)).toBe('blocks');
  });

  it('les objets du logement n’ont ni quête ni secret', () => {
    const { world } = loadHomeWorld([item('cat', 3, 3), item('coffee_table', 6, 6)]);
    const cat = world.getObject('decor-0')!;
    expect(cat.interaction).not.toBeNull();
    expect(cat.interaction && 'secret' in cat.interaction).toBe(false);
    expect(world.getObject('decor-1')!.interaction).toMatchObject({ kind: 'panel', panel: 'home' });
  });

  it('retrouve un meuble par case ou par identifiant', () => {
    const items = [item('rug', 2, 5), item('coffee_table', 3, 5)];
    expect(itemAt(items, 3, 5, CATALOG)).toBe(1);
    expect(itemAt(items, 2, 5, CATALOG)).toBe(0);
    expect(itemAt(items, 9, 9, CATALOG)).toBe(-1);
    expect(decorIndex('decor-12')).toBe(12);
    expect(decorIndex('elevator')).toBe(-1);
  });
});
