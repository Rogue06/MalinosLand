import { describe, expect, it } from 'vitest';
import { SoundGate } from '../src/core/soundGate';
import { mentions } from '../src/core/text';
import { MAPS } from '../src/content/world';
import { ambienceForZone } from '../src/services/audio';

describe('mentions @pseudo', () => {
  it('reconnaît le pseudo, sans tenir compte des majuscules', () => {
    expect(mentions('Salut @mickael !', 'Mickael')).toBe(true);
    expect(mentions('@Jean Paul tu viens ?', 'Jean Paul')).toBe(true);
    expect(mentions('@Mickael2 bonjour', 'Mickael')).toBe(false);
    expect(mentions('Mickael sans arobase', 'Mickael')).toBe(false);
    expect(mentions('mail@mickael.fr', 'Mickael')).toBe(false);
    expect(mentions('coucou @Élodie, ça va ?', 'élodie')).toBe(true);
  });
});

describe('sons des messages', () => {
  const gate = () => {
    let t = 0;
    const g = new SoundGate(() => t);
    return { g, at: (ms: number) => (t = ms) };
  };

  it('un son par message, mais pas deux à la suite', () => {
    const { g, at } = gate();
    expect(g.decide('bob', false)).toBe('message');
    at(1000);
    expect(g.decide('eve', false)).toBeNull();
    at(3000);
    expect(g.decide('eve', false)).toBe('message');
  });

  it('un joueur qui inonde le chat est rendu muet', () => {
    const { g, at } = gate();
    for (let i = 0; i < 5; i++) {
      at(i * 1000);
      g.decide('spam', false);
    }
    at(16_000);
    expect(g.decide('spam', false)).toBeNull();
    expect(g.decide('spam', true)).toBeNull();
    at(16_000 + 3000);
    expect(g.decide('bob', false)).toBe('message');
    at(80_000);
    expect(g.decide('spam', false)).toBe('message');
  });

  it('une mention a son propre son, une fois par joueur et par moment', () => {
    const { g, at } = gate();
    expect(g.decide('bob', false)).toBe('message');
    at(1200);
    expect(g.decide('bob', true)).toBe('mention');
    at(5000);
    expect(g.decide('bob', true)).toBe('message');
    at(5500);
    expect(g.decide('eve', true)).toBe('mention');
  });
});

describe('ambiance sonore selon le lieu', () => {
  it('chaque zone du Hub a l’ambiance prévue (et aucune faute dans les noms de zones)', () => {
    const zones = MAPS.hub!.zones.map((z) => z.id);
    const expected: Record<string, string | null> = {
      garden: 'outdoor',
      terrace: 'outdoor',
      site: 'outdoor',
      park: 'outdoor',
      orchard: 'outdoor',
      coworking: 'coworking',
      hall: 'hall',
      lounge: 'lounge',
    };
    for (const id of Object.keys(expected)) expect(zones).toContain(id);
    for (const id of zones) expect(ambienceForZone(id)).toBe(expected[id] ?? null);
    expect(ambienceForZone(null)).toBeNull();
    expect(ambienceForZone(MAPS.studio!.zones[0]!.id)).toBe('lounge');
  });
});
