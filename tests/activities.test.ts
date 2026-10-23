import { describe, expect, it } from 'vitest';
import { AMBIENT_IDEAS, QUEST_TARGETS, ZONE_SPOTS } from '../src/content/activities';
import { loadWorld } from '../src/content/world';
import { QUESTS } from '../src/content/quests';
import { SECRETS } from '../src/content/secrets';
import {
  MAX_ACTIVITIES,
  dayNumber,
  suggestActivities,
  type ActivityContext,
} from '../src/world/activities';

const NEW_PLAYER: ActivityContext = {
  questsDone: [],
  secretsFound: [],
  crowd: {},
  phase: 'jour',
  openHomes: null,
  signedIn: false,
  day: 0,
};

const VETERAN: ActivityContext = {
  ...NEW_PLAYER,
  questsDone: QUESTS.map((q) => q.id),
  secretsFound: SECRETS.map((s) => s.id),
  signedIn: true,
};

describe('panneau « Que faire maintenant ? »', () => {
  it('chaque lieu cité existe sur la carte du Hub, et l’avatar peut s’en servir', () => {
    const world = loadWorld('hub');
    const ids = [
      ...Object.values(QUEST_TARGETS).filter((id): id is string => id !== null),
      ...Object.values(ZONE_SPOTS).map((s) => s.object),
      ...Object.values(AMBIENT_IDEAS).flatMap((list) => list.map((i) => i.object)),
    ];
    for (const id of ids) {
      const obj = world.getObject(id);
      expect(obj, id).toBeTruthy();
      // « Y aller » marche jusqu’à l’objet puis s’en sert : il doit avoir une action ou un siège.
      expect(!!obj!.interaction || obj!.seats.length > 0, id).toBe(true);
    }
    // Chaque objectif « Premiers pas » a une suggestion (un lieu, ou le chat).
    for (const q of QUESTS) expect(q.id in QUEST_TARGETS, q.id).toBe(true);
  });

  it('un nouveau venu voit au moins 3 idées utiles, en commençant par son premier objectif', () => {
    const list = suggestActivities(NEW_PLAYER);
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.length).toBeLessThanOrEqual(MAX_ACTIVITIES);
    expect(list[0]).toMatchObject({
      id: 'quest:talk_guide',
      action: { kind: 'go', object: 'joshua' },
    });
    expect(list.some((a) => a.id.startsWith('secret:'))).toBe(true);
    // Sans compte : l’invitation à se connecter pour avoir son studio.
    expect(list.at(-1)?.id).toBe('account');
  });

  it('l’objectif du chat ouvre le chat au lieu de déplacer l’avatar', () => {
    const done = QUESTS.map((q) => q.id).filter((id) => id !== 'chat');
    expect(suggestActivities({ ...NEW_PLAYER, questsDone: done })[0]).toMatchObject({
      id: 'quest:chat',
      action: { kind: 'chat' },
    });
  });

  it('un joueur qui a tout fini a encore des idées : présents, studios ouverts, balade', () => {
    const alone = suggestActivities(VETERAN);
    expect(alone.length).toBeGreaterThanOrEqual(2);
    expect(alone.some((a) => a.id.startsWith('quest:') || a.id.startsWith('secret:'))).toBe(false);

    const busy = suggestActivities({
      ...VETERAN,
      crowd: { forest: 3, games: 1, inconnue: 9 },
      openHomes: [
        { room: 'home-aaa', ownerName: 'Bloom' },
        { room: 'home-bbb', ownerName: 'David' },
      ],
    });
    expect(busy[0]).toMatchObject({
      id: 'crowd:forest',
      title: '3 Malinos sont au feu de camp',
      action: { kind: 'go', object: 'feu-de-camp' },
    });
    const home = busy.find((a) => a.id.startsWith('home:'));
    expect(home?.action).toEqual({ kind: 'visit', room: 'home-aaa', ownerName: 'Bloom' });
    expect(home?.detail).toContain('1 autre');
    expect(busy.at(-1)?.id).toBe('studio');
  });

  it('l’idée de balade suit l’heure de Paris et change d’un jour à l’autre', () => {
    const night = suggestActivities({ ...VETERAN, phase: 'nuit' });
    expect(night.some((a) => a.id === 'ambient:feu-de-camp')).toBe(true);
    const dusk = suggestActivities({ ...VETERAN, phase: 'crepuscule' });
    expect(dusk.some((a) => a.id === 'ambient:transat')).toBe(true);
    const days = new Set(
      [0, 1, 2].map(
        (day) =>
          suggestActivities({ ...VETERAN, day }).find((a) => a.id.startsWith('ambient:'))?.id,
      ),
    );
    expect(days.size).toBe(3);
  });

  it('pas deux suggestions vers le même endroit', () => {
    // La nuit, des Malinos au feu de camp : la balade nocturne ne le propose pas une 2e fois.
    const list = suggestActivities({ ...VETERAN, phase: 'nuit', crowd: { forest: 2 } });
    const targets = list.flatMap((a) => (a.action.kind === 'go' ? [a.action.object] : []));
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('numéro du jour : change à minuit, heure locale', () => {
    const a = dayNumber(new Date(2026, 9, 23, 0, 1));
    const b = dayNumber(new Date(2026, 9, 23, 23, 59));
    const c = dayNumber(new Date(2026, 9, 24, 0, 1));
    expect(a).toBe(b);
    expect(c).toBe(a + 1);
  });
});
