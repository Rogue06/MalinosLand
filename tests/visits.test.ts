import { describe, expect, it } from 'vitest';
import { MemoryVisitStore, RESUME_MS, RETENTION_MS, VisitLog } from '../server/src/visits';

function setup() {
  let t = 1_000_000;
  const store = new MemoryVisitStore();
  const log = new VisitLog(store, () => t);
  return { store, log, advance: (ms: number) => (t += ms), now: () => t };
}

describe('historique des connexions', () => {
  it('une ligne par visite : arrivée, départ, compte ou visiteur', () => {
    const { store, log, advance } = setup();
    log.arrive('aaaaaaaa11', 'Alice', false);
    advance(60_000);
    log.leave('aaaaaaaa11');
    expect(store.rows).toEqual([
      {
        id: 1,
        player: 'aaaaaaaa11',
        name: 'Alice',
        account: false,
        arrived: 1_000_000,
        left: 1_060_000,
      },
    ]);
  });

  it('une reconnexion rapide continue la même visite ; plus tard, c’est une nouvelle', () => {
    const { store, log, advance } = setup();
    log.arrive('bbbbbbbb22', 'Bob', true);
    advance(5000);
    log.leave('bbbbbbbb22');
    advance(RESUME_MS - 1000);
    log.arrive('bbbbbbbb22', 'Bob', true);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]!.left).toBeNull();
    // Reconnexion alors que l'ancienne connexion n'était pas encore fermée : même visite.
    log.arrive('bbbbbbbb22', 'Bob', true);
    expect(store.rows).toHaveLength(1);
    log.leave('bbbbbbbb22');
    advance(RESUME_MS + 1000);
    log.arrive('bbbbbbbb22', 'Bob', true);
    expect(store.rows).toHaveLength(2);
  });

  it('effacé au bout de 90 jours ; liste la plus récente d’abord', () => {
    const { store, log, advance } = setup();
    log.arrive('cccccccc33', 'Cléo', false);
    log.leave('cccccccc33');
    advance(10 * 24 * 3600 * 1000);
    log.arrive('dddddddd44', 'Dan', false);
    expect(log.recent().map((r) => r.name)).toEqual(['Dan', 'Cléo']);
    advance(RETENTION_MS - 5 * 24 * 3600 * 1000);
    expect(log.recent().map((r) => r.name)).toEqual(['Dan']);
    expect(store.rows.map((r) => r.name)).toEqual(['Dan']);
  });
});

describe('historique : lecture côté jeu', () => {
  it('lit prudemment la réponse du serveur et résume', async () => {
    const { parseVisits, summarize } = await import('../src/services/visits');
    const rows = parseVisits([
      { name: 'Alice', account: true, arrived: 5000, left: 9000 },
      { name: 'alice', account: false, arrived: 4000, left: null },
      { name: '<b>Bob</b>', account: 'oui', arrived: 1000, left: 'x' },
      { name: 'Sans date' },
      'n’importe quoi',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ name: 'Alice', account: true, arrived: 5000, left: 9000 });
    expect(rows[2]!.account).toBe(false);
    expect(rows[2]!.left).toBeNull();
    expect(summarize(rows, 2000)).toEqual({ visits: 2, people: 1 });
    expect(parseVisits({})).toEqual([]);
  });
});
