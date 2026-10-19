import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/content/catalog';
import { MAPS, loadWorld } from '../src/content/world';
import { validateMap } from '../src/world/validateMap';
import { MapValidationError, WorldModel } from '../src/world/WorldModel';
import type { MapFile } from '../src/world/types';

describe('cartes du contenu', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    it(`la carte « ${id} » est valide`, () => {
      expect(validateMap(map, CATALOG)).toEqual([]);
    });

    it(`toutes les zones ouvertes de « ${id} » sont accessibles depuis le départ`, () => {
      const world = loadWorld(id);
      const reachable = world.reachableTiles(map.spawn);
      for (const zone of map.zones.filter((z) => z.status === 'open')) {
        const r = zone.rect;
        let found = false;
        for (let y = r.y; y < r.y + r.h && !found; y++) {
          for (let x = r.x; x < r.x + r.w && !found; x++) found = reachable.has(`${x},${y}`);
        }
        expect(found, `zone ${zone.id} inaccessible`).toBe(true);
      }
    });

    it(`chaque objet interactif de « ${id} » est atteignable`, () => {
      const world = loadWorld(id);
      const reachable = world.reachableTiles(map.spawn);
      const zoneSoon = (x: number, y: number) =>
        world.zoneAt({ x: x + 0.5, y: y + 0.5 })?.status === 'soon';
      for (const obj of world.objects) {
        if (!obj.interaction && obj.seats.length === 0) continue;
        // Les objets décoratifs des zones fermées peuvent être hors d'atteinte.
        if (zoneSoon(obj.x, obj.y) && !obj.interaction) continue;
        const tile = world.approachTile(obj, map.spawn);
        expect(tile, `${obj.id} sans case d'approche`).not.toBeNull();
        expect(reachable.has(`${tile!.x},${tile!.y}`), `${obj.id} inatteignable`).toBe(true);
      }
    });
  }
});

describe('validateMap', () => {
  const base = (): MapFile => ({
    formatVersion: 1,
    id: 'test',
    name: 'Test',
    width: 4,
    height: 3,
    spawn: { x: 0.5, y: 0.5, facing: 'py' },
    legend: { '.': { floor: 'wood' }, '#': { wall: 'low', floor: 'wood' } },
    tiles: ['....', '.#..', '....'],
    zones: [],
    objects: [],
    wallDecor: [],
  });

  it('accepte une carte minimale', () => {
    expect(validateMap(base(), CATALOG)).toEqual([]);
  });

  it('refuse un caractère inconnu et une mauvaise largeur', () => {
    const map = base();
    map.tiles[0] = '..X';
    const errors = validateMap(map, CATALOG);
    expect(errors.some((e) => e.includes('3 colonnes'))).toBe(true);
    expect(errors.some((e) => e.includes('« X »'))).toBe(true);
  });

  it('refuse un objet sur un mur, hors carte ou en chevauchement', () => {
    const map = base();
    map.objects = [
      { type: 'plant', x: 1, y: 1 },
      { type: 'sofa', x: 3, y: 0 },
      { type: 'plant', x: 0, y: 2 },
      { type: 'chair', x: 0, y: 2 },
    ];
    const errors = validateMap(map, CATALOG);
    expect(errors.some((e) => e.includes('posé sur un mur'))).toBe(true);
    expect(errors.some((e) => e.includes('déborde'))).toBe(true);
    expect(errors.some((e) => e.includes('chevauche'))).toBe(true);
  });

  it('exige un id pour les objets interactifs', () => {
    const map = base();
    map.objects = [{ type: 'arcade', x: 2, y: 2 }];
    expect(validateMap(map, CATALOG).some((e) => e.includes('doit avoir un id'))).toBe(true);
  });

  it('refuse un type inconnu et une version de format future', () => {
    const map = base();
    map.formatVersion = 99;
    map.objects = [{ type: 'licorne', x: 2, y: 2 }];
    const errors = validateMap(map, CATALOG);
    expect(errors.some((e) => e.includes('formatVersion'))).toBe(true);
    expect(errors.some((e) => e.includes('type inconnu'))).toBe(true);
  });

  it('WorldModel lève une erreur explicite sur une carte invalide', () => {
    const map = base();
    map.spawn = { x: 1.5, y: 1.5, facing: 'py' };
    expect(() => new WorldModel(map, CATALOG)).toThrow(MapValidationError);
  });
});

describe('WorldModel', () => {
  const world = loadWorld('hub');

  it('bloque les murs et les meubles, laisse passer les tapis', () => {
    expect(world.grid.isBlocked(0, 0)).toBe(true);
    const rug = world.objects.find((o) => o.type === 'rug_logo')!;
    expect(world.grid.isWalkable(rug.x + 1, rug.y + 1)).toBe(true);
    const sofa = world.objects.find((o) => o.type === 'sofa')!;
    expect(world.grid.isBlocked(sofa.x, sofa.y)).toBe(true);
  });

  it('calcule les assises après rotation', () => {
    const chair = world.objects.find((o) => o.type === 'chair' && o.rot === 2)!;
    expect(chair.seats).toHaveLength(1);
    expect(chair.seats[0]!.facing).toBe('ny');
    expect(chair.seats[0]!.x).toBeCloseTo(chair.x + 0.5);
  });

  it('trouve la zone et l’objet utilisable le plus proche', () => {
    const joshua = world.getObject('joshua')!;
    expect(world.zoneAt({ x: joshua.x + 0.5, y: joshua.y + 0.5 })?.id).toBe('hall');
    const near = world.nearestUsable({ x: joshua.x + 1.4, y: joshua.y + 0.5 });
    expect(near?.id).toBe('joshua');
  });

  it('gère l’occupation des sièges', () => {
    const sofa = world.objects.find((o) => o.type === 'sofa')!;
    const first = world.freeSeat(sofa, { x: sofa.x, y: sofa.y }, 'a')!;
    world.occupySeat(first, 'a');
    const second = world.freeSeat(sofa, { x: sofa.x, y: sofa.y }, 'b')!;
    expect(second.index).not.toBe(first.index);
    world.releaseSeats('a');
    expect(world.freeSeat(sofa, { x: first.x, y: first.y }, 'b')!.index).toBe(first.index);
  });
});
