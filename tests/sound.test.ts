import { describe, expect, it } from 'vitest';
import { SoundGate } from '../src/core/soundGate';
import { AMBIENCE_PLAY_MS, AMBIENCE_REPLAY_MS, AmbienceWindow } from '../src/core/ambienceWindow';
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
      forest: 'outdoor',
      games: 'games',
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

describe('bruitages des pièces : 10 secondes, puis silence', () => {
  const S = 1000;

  it('on les entend 10 s en entrant, puis plus du tout en restant', () => {
    const w = new AmbienceWindow<string>();
    expect(w.enter('hall', 0)).toBe(10 * S);
    expect(w.playing(9 * S)).toBe(true);
    expect(w.playing(10 * S)).toBe(false);
    // Rester (ou changer de zone avec le même son) ne relance rien.
    expect(w.enter('hall', 60 * S)).toBe(10 * S);
    expect(w.playing(60 * S)).toBe(false);
  });

  it('une autre pièce : ses bruitages jouent aussitôt', () => {
    const w = new AmbienceWindow<string>();
    w.enter('hall', 0);
    expect(w.enter('coworking', 5 * S)).toBe(15 * S);
    expect(w.playing(14 * S)).toBe(true);
  });

  it('revenir après 30 s d’absence les rejoue ; avant, non', () => {
    const w = new AmbienceWindow<string>();
    w.enter('games', 0);
    w.enter(null, 20 * S); // sortie
    expect(w.enter('games', 45 * S)).toBe(0); // 25 s d'absence : silence
    w.enter(null, 46 * S);
    expect(w.enter('games', 76 * S)).toBe(86 * S); // 30 s : ça rejoue
  });

  it('une porte franchie deux fois reprend les secondes restantes', () => {
    const w = new AmbienceWindow<string>();
    w.enter('lounge', 0);
    w.enter(null, 3 * S);
    expect(w.enter('lounge', 4 * S)).toBe(10 * S);
  });

  it('premier clic (son autorisé) : la fenêtre de la pièce commence à ce moment', () => {
    const w = new AmbienceWindow<string>();
    w.enter('outdoor', 0);
    expect(w.playing(20 * S)).toBe(false);
    expect(w.restart(20 * S)).toBe(30 * S);
    expect(w.playing(25 * S)).toBe(true);
    expect(new AmbienceWindow<string>().restart(5)).toBe(0);
  });

  it('valeurs retenues : 10 s d’écoute, 30 s d’absence', () => {
    expect(AMBIENCE_PLAY_MS).toBe(10_000);
    expect(AMBIENCE_REPLAY_MS).toBe(30_000);
  });
});
