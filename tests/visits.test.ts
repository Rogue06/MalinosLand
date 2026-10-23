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
    expect(rows[0]).toEqual({
      player: '',
      name: 'Alice',
      account: true,
      arrived: 5000,
      left: 9000,
    });
    expect(rows[2]!.account).toBe(false);
    expect(rows[2]!.left).toBeNull();
    expect(summarize(rows, 2000)).toEqual({ visits: 2, people: 1 });
    expect(parseVisits({})).toEqual([]);
  });
});

describe('mesures de fréquentation (journal existant, rien de plus)', () => {
  const H = 3600 * 1000;
  const D = 24 * H;
  const now = new Date(2026, 9, 30, 18, 0).getTime();
  const acc = (player: string, arrived: number, minutes: number | null) => ({
    player,
    name: player,
    account: true,
    arrived,
    left: minutes === null ? null : arrived + minutes * 60_000,
  });
  const guest = (arrived: number) => ({
    player: 'visiteur' + Math.round(arrived),
    name: 'Invité',
    account: false,
    arrived,
    left: arrived + 10 * 60_000,
  });

  it('comptes par jour, retours et durée médiane ; les visiteurs ne sont que comptés', async () => {
    const { attendance, parseVisits } = await import('../src/services/visits');
    const rows = parseVisits([
      // Alice : première visite il y a 10 jours, revenue hier → revenue après 7 jours.
      acc('aaaaaaaa01', now - 10 * D, 30),
      acc('aaaaaaaa01', now - 1 * D, 20),
      // Bob : il y a 9 jours seulement → éligible, pas revenu.
      acc('bbbbbbbb02', now - 9 * D, 5),
      // Chloé : arrivée il y a 2 jours, revenue aujourd’hui → un autre jour, pas encore éligible à 7 jours.
      acc('cccccccc03', now - 2 * D, 60),
      acc('cccccccc03', now - 1 * H, null),
      guest(now - 2 * H),
      guest(now - 3 * D),
      guest(now - 20 * D),
    ]);
    const a = attendance(rows, now);
    expect(a.days).toHaveLength(7);
    expect(a.days[0]).toMatchObject({ accounts: 1, guestVisits: 1 });
    expect(a.days[1]).toMatchObject({ accounts: 1, guestVisits: 0 });
    expect(a.accounts7).toBe(2);
    expect(a.accounts90).toBe(3);
    expect(a.guestVisits7).toBe(2);
    expect(a.anotherDay).toEqual({ returned: 2, total: 3 });
    expect(a.after7).toEqual({ returned: 1, total: 2 });
    // Visites terminées : 30, 20, 5, 60, et 3 visiteurs à 10 min → médiane 10.
    expect(a.medianMinutes).toBe(10);
    expect(a.truncated).toBe(false);
  });

  it('journal vide : aucun chiffre inventé', async () => {
    const { attendance } = await import('../src/services/visits');
    const a = attendance([], now);
    expect(a.medianMinutes).toBeNull();
    expect(a.after7).toEqual({ returned: 0, total: 0 });
    expect(a.days.every((d) => d.accounts === 0 && d.guestVisits === 0)).toBe(true);
  });
});
