import { describe, expect, it } from 'vitest';
import { appearanceKey, sanitizeAppearance, DEFAULT_APPEARANCE } from '../src/content/avatars';
import { CATALOG } from '../src/content/catalog';
import { QUESTS } from '../src/content/quests';
import { MAPS } from '../src/content/world';
import { DECOR_ART, OBJECT_ART } from '../src/game/art/objects';
import { packShelves } from '../src/game/textures';
import { parseProfile } from '../src/services/profile';
import { parseSettings, DEFAULT_SETTINGS } from '../src/services/settings';
import { VersionedStorage, type KeyValueStorage } from '../src/services/storage';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('stockage versionné', () => {
  it('relit ce qui a été écrit et ignore une autre version', () => {
    const backend = new MemoryStorage();
    const s = new VersionedStorage(backend);
    s.write('x', 1, { a: 1 });
    expect(s.read('x', 1, (r) => r as { a: number })).toEqual({ a: 1 });
    expect(s.read('x', 2, (r) => r)).toBeNull();
  });

  it('survit à des données corrompues ou à un stockage absent', () => {
    const backend = new MemoryStorage();
    backend.setItem('malinosland:x', '{pas du json');
    expect(new VersionedStorage(backend).read('x', 1, (r) => r)).toBeNull();
    const none = new VersionedStorage(null);
    expect(none.write('x', 1, 1)).toBe(false);
    expect(none.read('x', 1, (r) => r)).toBeNull();
  });
});

describe('profil et réglages', () => {
  it('valide le profil chargé', () => {
    expect(parseProfile({ name: 'Joshua', look: { top: 3 } })?.look.top).toBe(3);
    expect(parseProfile({ name: '<b>', look: {} })).toBeNull();
    expect(parseProfile(null)).toBeNull();
  });

  it('normalise les réglages inconnus', () => {
    expect(parseSettings({ quality: 'ultra', fpsLimit: 144, showNames: false })).toEqual({
      ...DEFAULT_SETTINGS,
      showNames: false,
    });
  });

  it('valide les réglages des sons', () => {
    expect(parseSettings({ volume: 7, sounds: false, ambience: 'oui' })).toEqual({
      ...DEFAULT_SETTINGS,
      volume: 1,
      sounds: false,
    });
    expect(parseSettings({ volume: Number.NaN }).volume).toBe(DEFAULT_SETTINGS.volume);
    expect(parseSettings({}).alwaysDay).toBe(false);
    expect(parseSettings({ alwaysDay: true }).alwaysDay).toBe(true);
  });

  it('borne les apparences', () => {
    expect(sanitizeAppearance({ skin: -1, hair: 1.5, top: 9 })).toEqual({
      ...DEFAULT_APPEARANCE,
      top: 9,
    });
    expect(appearanceKey(DEFAULT_APPEARANCE)).toBe('malino-v1');
    const customized = { ...DEFAULT_APPEARANCE, hair: 7, skin: 5, accessory: 3, beard: 2 };
    expect(sanitizeAppearance(customized)).toEqual(customized);
    expect(sanitizeAppearance({ ...customized, model: 0 })).toEqual({ ...customized, model: 0 });
    expect(sanitizeAppearance({ model: 99 }).model).toBe(1);
    expect(sanitizeAppearance({ model: '0' }).model).toBe(1);
    expect(appearanceKey({ ...customized, model: 0 })).not.toBe(appearanceKey(customized));
    expect(appearanceKey(customized)).toBe(appearanceKey(DEFAULT_APPEARANCE));
    // Ancien profil sans barbe : « aucune » ; barbe et micro hors limites refusés.
    expect(sanitizeAppearance({ accessory: 3 }).beard).toBe(0);
    expect(sanitizeAppearance({ accessory: 3, beard: 2 })).toMatchObject({
      accessory: 3,
      beard: 2,
    });
    expect(sanitizeAppearance({ beard: 3 }).beard).toBe(0);
  });
});

describe('cohérence du contenu', () => {
  it('chaque type du catalogue a un dessin', () => {
    for (const type of Object.keys(CATALOG)) expect(OBJECT_ART[type], type).toBeTypeOf('function');
  });

  it('chaque décor mural utilisé existe', () => {
    for (const map of Object.values(MAPS)) {
      for (const d of map.wallDecor) expect(DECOR_ART[d.type], d.type).toBeTypeOf('function');
    }
  });

  it('chaque objectif référencé par une interaction existe', () => {
    const ids = new Set(QUESTS.map((q) => q.id));
    const used = [
      ...Object.values(CATALOG).map((e) => e.defaultInteraction?.quest),
      ...Object.values(MAPS).flatMap((m) => m.objects.map((o) => o.interaction?.quest)),
    ].filter((q): q is string => !!q);
    for (const q of used) expect(ids.has(q), q).toBe(true);
  });
});

describe('atlas de textures', () => {
  it('range les images sans chevauchement ni débordement', () => {
    const sizes = Array.from({ length: 120 }, (_, i) => ({
      w: 40 + ((i * 37) % 160),
      h: 30 + ((i * 53) % 200),
    }));
    const pages = packShelves(sizes, 512);
    const seen = new Set<number>();
    for (const page of pages) {
      expect(page.width).toBeLessThanOrEqual(512);
      expect(page.height).toBeLessThanOrEqual(512);
      const rects = page.placements.map((p) => ({
        ...p,
        w: sizes[p.index]!.w,
        h: sizes[p.index]!.h,
      }));
      for (const r of rects) seen.add(r.index);
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
    }
    expect(seen.size).toBe(sizes.length);
  });
});
