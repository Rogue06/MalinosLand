import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/content/catalog';
import { SECRETS } from '../src/content/secrets';
import { loadWorld } from '../src/content/world';
import { parseSecrets } from '../src/services/progress';

describe('secrets du Hub', () => {
  it('chaque secret est caché dans un objet du Hub (et il n’y en a pas d’inconnu)', () => {
    const hub = loadWorld('hub');
    const placed = new Map<string, string>();
    for (const o of hub.objects) {
      const secret = o.interaction?.secret;
      if (secret) placed.set(secret, o.id);
    }
    for (const s of SECRETS) expect(placed.has(s.id), `secret « ${s.id} » introuvable`).toBe(true);
    for (const id of placed.keys()) expect(SECRETS.map((s) => s.id)).toContain(id);
    // Les objets « secrets » du catalogue ont un dessin et une interaction.
    for (const type of ['cat', 'dirt_mound', 'gnome'])
      expect(CATALOG[type]?.defaultInteraction?.secret).toBeTruthy();
  });

  it('la liste enregistrée est validée', () => {
    expect(parseSecrets(['voeu', 'voeu', 'inconnu', 3, 'pixel'])).toEqual(['voeu', 'pixel']);
    expect(parseSecrets('n’importe quoi')).toEqual([]);
  });
});
