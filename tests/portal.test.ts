import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/content/catalog';
import { MAPS, loadWorld } from '../src/content/world';
import {
  CHANTIER_ARCADE,
  CHANTIER_ARRIVAL,
  CHANTIER_URL,
  fromChantier,
  withoutOrigin,
} from '../src/world/portal';

describe('Hub : borne du Chantier des mondes (DEC-051)', () => {
  const world = loadWorld('hub');

  it('la borne est dans la salle de jeux, avec ses ampoules et le panneau de la faille', () => {
    const arcade = world.objects.find((o) => o.id === CHANTIER_ARCADE.id)!;
    expect(arcade).toBeDefined();
    expect(arcade.type).toBe('arcade_chantier');
    expect([arcade.x, arcade.y]).toEqual([CHANTIER_ARCADE.x, CHANTIER_ARCADE.y]);
    expect(world.zoneAt({ x: arcade.x + 0.5, y: arcade.y + 0.5 })?.id).toBe('games');
    expect(arcade.interaction).toMatchObject({ kind: 'panel', panel: 'portal' });
    const marquee = CATALOG.arcade_chantier!.marquee!;
    expect(marquee.length).toBeGreaterThanOrEqual(8);
    for (const [x, y, z] of marquee) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeLessThanOrEqual(1);
      expect(z).toBeGreaterThan(0.5);
    }
  });

  it('au retour du Chantier, on réapparaît devant la borne, sur une case libre et atteignable', () => {
    const tile = { x: Math.floor(CHANTIER_ARRIVAL.x), y: Math.floor(CHANTIER_ARRIVAL.y) };
    const reachable = world.reachableTiles(MAPS.hub!.spawn);
    expect(reachable.has(`${tile.x},${tile.y}`)).toBe(true);
    expect(world.zoneAt(CHANTIER_ARRIVAL)?.id).toBe('games');
    expect(CHANTIER_ARRIVAL.facing).toBe('ny');
  });

  it('adresses : vers le Chantier (il sait qu’on vient du Hub) et retour nettoyé', () => {
    expect(CHANTIER_URL).toBe('../chantier/?depuis=hub');
    expect(new URL(CHANTIER_URL, 'https://m.example/jouer/').pathname).toBe('/chantier/');
    expect(fromChantier('?depuis=chantier')).toBe(true);
    expect(fromChantier('?debug&depuis=chantier')).toBe(true);
    expect(fromChantier('?depuis=hub')).toBe(false);
    expect(fromChantier('')).toBe(false);
    expect(withoutOrigin('https://m.example/jouer/?depuis=chantier')).toBe('/jouer/');
    expect(withoutOrigin('https://m.example/jouer/?debug&depuis=chantier#x')).toBe(
      '/jouer/?debug#x',
    );
  });
});

describe('Hub : bruitage de la faille', () => {
  it('sans son possible (ici, pas de navigateur), la faille reste silencieuse sans erreur', async () => {
    const { playRift } = await import('../src/services/audio');
    expect(() => playRift('open')).not.toThrow();
    expect(() => playRift('go')).not.toThrow();
  });
});
