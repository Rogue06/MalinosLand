import { describe, expect, it } from 'vitest';
import {
  AMBIENT_IDEAS,
  MUSEUM_NEWEST_STAND,
  MUSEUM_STAND_COUNT,
  QUEST_TARGETS,
  ZONE_SPOTS,
} from '../src/content/activities';
import { loadWorld } from '../src/content/world';
import { QUESTS } from '../src/content/quests';
import { SECRETS } from '../src/content/secrets';
import {
  MAX_ACTIVITIES,
  MAX_RECAP,
  QUIZ_BORNE,
  dayNumber,
  recapActivities,
  suggestActivities,
  type Activity,
  type ActivityContext,
} from '../src/world/activities';
import { parseIntent } from '../src/services/intent';

const NEW_PLAYER: ActivityContext = {
  questsDone: [],
  secretsFound: [],
  crowd: {},
  phase: 'jour',
  openHomes: null,
  signedIn: false,
  quizWeeklyDone: false,
  day: 0,
};

const VETERAN: ActivityContext = {
  ...NEW_PLAYER,
  questsDone: QUESTS.map((q) => q.id),
  secretsFound: SECRETS.map((s) => s.id),
  signedIn: true,
  quizWeeklyDone: true,
};

describe('panneau « Que faire maintenant ? »', () => {
  it('chaque lieu cité existe sur la carte du Hub, et l’avatar peut s’en servir', () => {
    const world = loadWorld('hub');
    const ids = [
      ...Object.values(QUEST_TARGETS).filter((id): id is string => id !== null),
      ...Object.values(ZONE_SPOTS).map((s) => s.object),
      ...Object.values(AMBIENT_IDEAS).flatMap((list) => list.map((i) => i.object)),
      QUIZ_BORNE,
      MUSEUM_NEWEST_STAND,
      'museum-kiosk',
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

  it('le défi de la semaine du quiz : juste après l’objectif tant qu’il n’est pas joué', () => {
    const list = suggestActivities(NEW_PLAYER);
    // Accès direct : le quiz s'ouvre tout de suite ; la borne reste proposée à pied.
    expect(list[1]).toMatchObject({
      id: 'quiz:weekly',
      action: { kind: 'panel', panel: 'quiz' },
      place: 'arcade-jeux-1',
    });
    const done = suggestActivities({ ...VETERAN, quizWeeklyDone: true });
    expect(done.some((a) => a.id === 'quiz:weekly')).toBe(false);
    expect(done.some((a) => a.id === 'quiz:free')).toBe(true);
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

  it('nouvelles du musée : stand du plus récent et nombre de stands conformes à la carte', () => {
    const world = loadWorld('hub');
    const stands = world.objects.filter((o) => o.interaction?.kind === 'stand');
    expect(stands.length).toBe(MUSEUM_STAND_COUNT);
    const newest = world.getObject(MUSEUM_NEWEST_STAND)!;
    expect(newest.interaction).toMatchObject({ kind: 'stand', slot: 0 });
  });

  it('un projet tout juste exposé est annoncé pendant une semaine, avant les secrets', () => {
    const latest = { id: 12, title: 'MalinosLand', author: 'Mickael', days: 0.5 };
    const list = suggestActivities({ ...NEW_PLAYER, museum: { count: 1, latest } });
    const news = list.findIndex((a) => a.id === 'museum:new:12');
    expect(news).toBeGreaterThan(-1);
    expect(news).toBeLessThan(list.findIndex((a) => a.id.startsWith('secret:')));
    expect(list[news]).toMatchObject({
      title: 'Nouveau au musée : « MalinosLand »',
      action: { kind: 'project', id: 12 },
      place: MUSEUM_NEWEST_STAND,
    });
    const old = suggestActivities({
      ...VETERAN,
      museum: { count: 1, latest: { ...latest, days: 8 } },
    });
    expect(old.some((a) => a.id.startsWith('museum:'))).toBe(false);
  });

  it('musée vide : invitation à exposer ; musée complet : la borne ; inconnu : rien', () => {
    const empty = suggestActivities({ ...VETERAN, museum: { count: 0, latest: null } });
    expect(empty.find((a) => a.id === 'museum:first')?.action).toEqual({
      kind: 'panel',
      panel: 'museum',
    });
    const latest = { id: 3, title: 'Projet', author: 'Bloom', days: 30 };
    const full = suggestActivities({
      ...VETERAN,
      museum: { count: MUSEUM_STAND_COUNT, latest },
    });
    expect(full.find((a) => a.id === 'museum:full')).toMatchObject({
      action: { kind: 'panel', panel: 'creations' },
      place: 'museum-kiosk',
    });
    expect(
      suggestActivities({ ...VETERAN, museum: null }).some((a) => a.id.startsWith('museum:')),
    ).toBe(false);
  });

  it('chaque lieu « à pied » des idées existe sur la carte et peut servir', () => {
    const world = loadWorld('hub');
    const contexts: ActivityContext[] = [
      NEW_PLAYER,
      VETERAN,
      { ...NEW_PLAYER, intent: 'learn' },
      { ...NEW_PLAYER, intent: 'create' },
      { ...VETERAN, intent: 'create' },
      { ...NEW_PLAYER, intent: 'meet' },
      { ...VETERAN, museum: { count: 0, latest: null } },
      { ...VETERAN, museum: { count: MUSEUM_STAND_COUNT, latest: null } },
    ];
    const all: Activity[] = contexts.flatMap((c) => suggestActivities(c));
    for (const a of all) {
      if (!a.place) continue;
      const obj = world.getObject(a.place);
      expect(obj, `${a.id} → ${a.place}`).toBeTruthy();
      expect(!!obj!.interaction || obj!.seats.length > 0, a.place).toBe(true);
    }
  });

  it('chaque envie mène d’abord à une réussite possible sans compte', () => {
    const learn = suggestActivities({ ...NEW_PLAYER, intent: 'learn' });
    expect(learn[0]).toMatchObject({ id: 'quiz:weekly', action: { kind: 'panel', panel: 'quiz' } });
    const create = suggestActivities({ ...NEW_PLAYER, intent: 'create' });
    expect(create[0]).toMatchObject({
      id: 'create:avatar',
      action: { kind: 'panel', panel: 'avatar' },
    });
    // Sans compte : on découvre les créations ; avec un compte : on peut exposer.
    expect(create[1]?.id).toBe('create:creations');
    expect(suggestActivities({ ...VETERAN, intent: 'create' })[1]?.id).toBe('create:expose');
    const meetAlone = suggestActivities({ ...NEW_PLAYER, intent: 'meet' });
    expect(meetAlone[0]?.id).toBe('meet:calm');
    const meetCrowd = suggestActivities({ ...NEW_PLAYER, intent: 'meet', crowd: { games: 2 } });
    expect(meetCrowd.slice(0, 2).map((a) => a.id)).toEqual(['crowd:games', 'meet:chat']);
    // Jamais deux fois la même idée, jamais plus que le maximum.
    for (const list of [learn, create, meetAlone, meetCrowd]) {
      expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
      expect(list.length).toBeLessThanOrEqual(MAX_ACTIVITIES);
    }
  });

  it('« Reprends ici » : 3 suites au plus, rien quand il n’y a rien à reprendre', () => {
    const done = { ...VETERAN, quizWeeklyDone: true };
    expect(recapActivities(done)).toEqual([]);
    const latest = { id: 4, title: 'MalinosLand', author: 'Mickael', days: 1 };
    const mine = recapActivities({
      ...NEW_PLAYER,
      secretsFound: [SECRETS[0]!.id],
      museum: { count: 1, latest },
      myName: 'Mickael',
      pendingProjects: ['Mon outil'],
    });
    expect(mine.length).toBe(MAX_RECAP);
    expect(mine.map((a) => a.id)).toEqual(['recap:mine:4', 'recap:pending', 'quiz:weekly']);
    expect(mine[0]).toMatchObject({ action: { kind: 'project', id: 4 } });
    // Le projet d’un autre : annoncé comme nouveauté, après le reste.
    const other = recapActivities({ ...done, museum: { count: 1, latest }, myName: 'Bloom' });
    expect(other.map((a) => a.id)).toEqual(['museum:new:4']);
  });

  it('envie gardée dans le navigateur : données relues prudemment', () => {
    expect(parseIntent({ intent: 'learn', answered: true, shownDay: 20000 })).toEqual({
      intent: 'learn',
      answered: true,
      shownDay: 20000,
    });
    expect(parseIntent({ intent: 'pirate', answered: 'oui', shownDay: -1 })).toEqual({
      intent: null,
      answered: false,
      shownDay: null,
    });
    expect(parseIntent(null).answered).toBe(false);
  });
});
