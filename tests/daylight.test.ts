import { describe, expect, it } from 'vitest';
import { parisClock, parisSky, skyAt, softenTint, sunTimes } from '../src/core/daylight';

describe('jour et nuit à l’heure de Paris', () => {
  it('lit l’heure de Paris, heure d’été comprise', () => {
    const ete = parisClock(new Date('2026-07-01T20:00:00Z'));
    expect(ete.hours).toBe(22);
    expect(ete.utcOffset).toBe(2);
    const hiver = parisClock(new Date('2026-01-15T12:30:00Z'));
    expect(hiver.hours).toBe(13.5);
    expect(hiver.utcOffset).toBe(1);
    expect(hiver.dayOfYear).toBe(15);
    // Juste après minuit à Paris, mais encore la veille en heure universelle.
    const minuit = parisClock(new Date('2026-03-10T23:30:00Z'));
    expect(minuit.hours).toBe(0.5);
    expect(minuit.dayOfYear).toBe(70);
  });

  it('lever et coucher du soleil selon la saison (à un quart d’heure près)', () => {
    const juin = sunTimes(172, 2); // 21 juin : lever 5 h 47, coucher 21 h 58
    expect(Math.abs(juin.rise - 5.78)).toBeLessThan(0.25);
    expect(Math.abs(juin.set - 21.97)).toBeLessThan(0.25);
    const dec = sunTimes(355, 1); // 21 décembre : lever 8 h 42, coucher 16 h 56
    expect(Math.abs(dec.rise - 8.7)).toBeLessThan(0.25);
    expect(Math.abs(dec.set - 16.93)).toBeLessThan(0.25);
  });

  it('jour, crépuscule, nuit et aube se suivent en douceur', () => {
    const sun = { rise: 7, set: 19 };
    expect(skyAt(12, sun)).toEqual({ phase: 'jour', tint: 0xffffff, lights: 0, night: 0 });
    const soir = skyAt(19, sun);
    expect(soir.phase).toBe('crepuscule');
    expect(soir.lights).toBeCloseTo(0.5);
    const nuit = skyAt(2, sun);
    expect(nuit).toMatchObject({ phase: 'nuit', lights: 1, night: 1 });
    expect(skyAt(23, sun)).toEqual(nuit);
    expect(skyAt(6.8, sun).phase).toBe('aube');
    // Pas de saut : deux instants proches donnent presque la même lumière.
    for (let h = 0; h < 24; h += 0.25) {
      expect(Math.abs(skyAt(h, sun).lights - skyAt(h + 0.05, sun).lights)).toBeLessThan(0.1);
    }
  });

  it('« toujours de jour » et intérieurs plus doux', () => {
    const midnight = new Date('2026-07-01T22:00:00Z');
    expect(parisSky(midnight).phase).toBe('nuit');
    expect(parisSky(midnight, true)).toMatchObject({ phase: 'jour', tint: 0xffffff, lights: 0 });
    expect(softenTint(0x000000, 1)).toBe(0xffffff);
    expect(softenTint(0x5d6db0, 0)).toBe(0x5d6db0);
  });
});
