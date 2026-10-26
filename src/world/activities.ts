import {
  AMBIENT_IDEAS,
  type Intent,
  MUSEUM_NEW_DAYS,
  MUSEUM_NEWEST_STAND,
  MUSEUM_STAND_COUNT,
  QUEST_TARGETS,
  ZONE_SPOTS,
} from '../content/activities';
import { QUESTS } from '../content/quests';
import { SECRETS } from '../content/secrets';
import type { SkyPhase } from '../core/daylight';
import type { PanelId } from './types';

/**
 * Panneau « Aujourd'hui » (ex « Que faire maintenant ? », v0.35, DEC-029 ; PR 12, DEC-042) :
 * quelques idées du moment, choisies dans le navigateur à partir de ce que le jeu sait déjà
 * (envie choisie, objectifs, secrets, Malinos présents, heure, studios ouverts, musée), et la
 * carte « Reprends ici » du retour. Logique pure et testée : ni réseau, ni Phaser, ni DOM.
 */

/** Ce que fait le bouton d'une suggestion. */
export type ActivityAction =
  /** L'avatar va jusqu'à l'objet (et s'en sert, comme d'un clic dessus). */
  | { kind: 'go'; object: string }
  | { kind: 'panel'; panel: PanelId | 'settings' }
  /** Ouvre le chat, curseur prêt à écrire. */
  | { kind: 'chat' }
  /** Visite le logement d'un autre (l'entrée reste vérifiée par le serveur et la base). */
  | { kind: 'visit'; room: string; ownerName: string }
  /** Fiche d'un projet exposé au musée (liste des stands déjà lue). */
  | { kind: 'project'; id: number };

export interface Activity {
  /** Identifiant stable (clé d'affichage et tests). */
  id: string;
  icon: string;
  title: string;
  detail: string;
  /** Libellé du bouton. */
  cta: string;
  /** Action directe du bouton (ouvrir le panneau, de préférence à la marche). */
  action: ActivityAction;
  /**
   * Lieu où l'on peut aussi aller à pied (bouton secondaire « 🚶 ») : l'accès direct ne doit
   * pas faire disparaître le plaisir de se promener.
   */
  place?: string;
}

export interface ActivityContext {
  questsDone: readonly string[];
  secretsFound: readonly string[];
  /** Autres Malinos présents dans le Hub, par zone. */
  crowd: Readonly<Record<string, number>>;
  /** Moment de la journée (null : inconnu). */
  phase: SkyPhase | null;
  /** Logements que je peux visiter ; null tant qu'ils ne sont pas chargés. */
  openHomes: ReadonlyArray<{ room: string; ownerName: string }> | null;
  signedIn: boolean;
  /** Défi de la semaine du Quiz IA déjà joué (scores gardés dans le navigateur). */
  quizWeeklyDone: boolean;
  /** Numéro du jour, pour varier les idées d'un jour à l'autre (sans hasard : testable). */
  day: number;
  /**
   * Musée des Malinos, d'après la liste des stands déjà lue (null : inconnue ou hors ligne).
   * `latest` : le projet exposé le plus récent, et depuis combien de jours.
   */
  museum?: {
    count: number;
    latest: { id: number; title: string; author: string; days: number } | null;
  } | null;
  /** Envie choisie à l'arrivée (null : pas encore choisie, ou « Passer »). */
  intent?: Intent | null;
}

/** Nombre maximal d'idées affichées : assez pour choisir, pas trop pour lire d'un coup d'œil. */
export const MAX_ACTIVITIES = 5;

const pickByDay = <T>(list: readonly T[], day: number): T | undefined =>
  list.length > 0 ? list[((day % list.length) + list.length) % list.length] : undefined;

function nextQuest(ctx: ActivityContext): Activity | null {
  const quest = QUESTS.find((q) => !ctx.questsDone.includes(q.id));
  if (!quest) return null;
  const target = QUEST_TARGETS[quest.id] ?? null;
  return {
    id: `quest:${quest.id}`,
    icon: '🎯',
    title: quest.title,
    detail: quest.hint,
    cta: target ? 'Y aller' : 'Écrire',
    action: target ? { kind: 'go', object: target } : { kind: 'chat' },
  };
}

function crowd(ctx: ActivityContext): Activity | null {
  let best: { zone: string; count: number } | null = null;
  for (const [zone, count] of Object.entries(ctx.crowd)) {
    if (count > 0 && ZONE_SPOTS[zone] && (!best || count > best.count)) best = { zone, count };
  }
  if (!best) return null;
  const spot = ZONE_SPOTS[best.zone]!;
  const who = best.count > 1 ? `${best.count} Malinos sont` : 'Un Malino est';
  return {
    id: `crowd:${best.zone}`,
    icon: '👋',
    title: `${who} ${spot.where}`,
    detail: 'Va leur dire bonjour : une émote ou un message suffit pour faire connaissance.',
    cta: 'Les rejoindre',
    action: { kind: 'go', object: spot.object },
  };
}

function secret(ctx: ActivityContext): Activity | null {
  const left = SECRETS.filter((s) => !ctx.secretsFound.includes(s.id));
  const next = pickByDay(left, ctx.day);
  if (!next) return null;
  return {
    id: `secret:${next.id}`,
    icon: '📓',
    title: `Un secret à trouver (${SECRETS.length - left.length}/${SECRETS.length})`,
    detail: `Devinette du carnet de Joshua : « ${next.hint} »`,
    cta: 'Ouvrir le carnet',
    action: { kind: 'panel', panel: 'carnet' },
  };
}

function openHome(ctx: ActivityContext): Activity | null {
  const homes = ctx.openHomes ?? [];
  const home = pickByDay(homes, ctx.day);
  if (!home) return null;
  return {
    id: `home:${home.room}`,
    icon: '🏠',
    title: `Le studio de ${home.ownerName} est ouvert`,
    detail:
      homes.length > 1
        ? `Et ${homes.length - 1} autre${homes.length > 2 ? 's' : ''} : l’ascenseur du hall les liste tous.`
        : 'Va voir comment il l’a décoré !',
    cta: 'Visiter',
    action: { kind: 'visit', room: home.room, ownerName: home.ownerName },
  };
}

function ambient(ctx: ActivityContext, taken: ReadonlySet<string>): Activity | null {
  const ideas = AMBIENT_IDEAS[ctx.phase ?? 'jour'].filter((i) => !taken.has(i.object));
  const idea = pickByDay(ideas, ctx.day);
  if (!idea) return null;
  return {
    id: `ambient:${idea.object}`,
    icon: idea.icon,
    title: idea.title,
    detail: idea.detail,
    cta: 'Y aller',
    action: { kind: 'go', object: idea.object },
  };
}

/**
 * Nouvelles du musée (PR 11) : le dernier projet exposé pendant sa première semaine, une
 * invitation à exposer tant que le musée est vide, ou la borne quand tous les stands sont pris.
 */
function museum(ctx: ActivityContext): Activity | null {
  const m = ctx.museum;
  if (!m) return null;
  if (m.latest && m.latest.days < MUSEUM_NEW_DAYS)
    return {
      id: `museum:new:${m.latest.id}`,
      icon: '🆕',
      title: `Nouveau au musée : « ${m.latest.title} »`,
      detail: `Exposé par ${m.latest.author}. Son stand est le premier du musée, à côté du hall.`,
      cta: 'Voir le projet',
      action: { kind: 'project', id: m.latest.id },
      place: MUSEUM_NEWEST_STAND,
    };
  if (m.count === 0)
    return {
      id: 'museum:first',
      icon: '🖼️',
      title: 'Le musée attend ses premiers projets',
      detail:
        'Un site, une appli, un outil IA, une création ? Expose-le : la première place est libre.',
      cta: 'Exposer',
      action: { kind: 'panel', panel: 'museum' },
      place: MUSEUM_SIGN,
    };
  if (m.count >= MUSEUM_STAND_COUNT)
    return {
      id: 'museum:full',
      icon: '🖼️',
      title: 'Le musée affiche complet',
      detail:
        'Tous les stands sont pris : « Toutes les créations » montre chaque projet. Le Bâtiment des créations s’élèvera bientôt sur le chantier.',
      cta: 'Tout voir',
      action: { kind: 'panel', panel: 'creations' },
      place: MUSEUM_KIOSK,
    };
  return null;
}

function myStudio(ctx: ActivityContext): Activity {
  return ctx.signedIn
    ? {
        id: 'studio',
        icon: '🛋️',
        title: 'Ton studio t’attend',
        detail: 'Décore-le, ouvre-le à tous ou invite d’autres Malinos.',
        cta: 'Prendre l’ascenseur',
        action: { kind: 'panel', panel: 'elevator' },
        place: 'elevator',
      }
    : {
        id: 'account',
        icon: '🔑',
        title: 'Ton propre studio',
        detail:
          'Connecte-toi avec Google ou GitHub : tu gardes ton personnage partout et tu reçois un studio à décorer.',
        cta: 'Me connecter',
        action: { kind: 'panel', panel: 'settings' },
      };
}

/** La borne du Quiz IA, dans la salle de jeux. */
export const QUIZ_BORNE = 'arcade-jeux-1';

function quiz(ctx: ActivityContext): Activity {
  return ctx.quizWeeklyDone
    ? {
        id: 'quiz:free',
        icon: '🕹️',
        title: 'Une partie de Quiz IA ?',
        detail: 'Défi de la semaine réussi ! Une partie libre pour apprendre encore quelque chose.',
        cta: 'Jouer',
        action: { kind: 'panel', panel: 'quiz' },
        place: QUIZ_BORNE,
      }
    : {
        id: 'quiz:weekly',
        icon: '🏆',
        title: 'Le défi de la semaine du Quiz IA',
        detail:
          '5 questions sur l’IA, les mêmes pour tous les Malinos jusqu’à dimanche. Aussi sur la borne turquoise de la salle de jeux.',
        cta: 'Jouer',
        action: { kind: 'panel', panel: 'quiz' },
        place: QUIZ_BORNE,
      };
}

/** Borne « Toutes les créations » et panneau d'entrée du musée (carte du Hub). */
export const MUSEUM_KIOSK = 'museum-kiosk';
export const MUSEUM_SIGN = 'gallery-sign';

/**
 * Premières idées selon l'envie choisie à l'arrivée : chacune mène à une petite réussite
 * possible **sans compte** (cahier des charges du village, §6).
 */
function starters(ctx: ActivityContext): Activity[] {
  switch (ctx.intent) {
    case 'learn':
      return [
        quiz(ctx),
        {
          id: 'learn:creations',
          icon: '🧪',
          title: 'Essaie un outil fait par un Malino',
          detail:
            'Les créations du musée s’ouvrent d’un clic, et beaucoup s’essaient directement dans le jeu.',
          cta: 'Découvrir',
          action: { kind: 'panel', panel: 'creations' },
          place: MUSEUM_KIOSK,
        },
      ];
    case 'create':
      return [
        {
          id: 'create:avatar',
          icon: '🎨',
          title: 'Crée ton Malino à ton image',
          detail: 'Style, couleurs de peau, de cheveux, de veste et de pantalon : à toi de jouer.',
          cta: 'Personnaliser',
          action: { kind: 'panel', panel: 'avatar' },
          place: 'mirror',
        },
        ctx.signedIn
          ? {
              id: 'create:expose',
              icon: '🖼️',
              title: 'Expose une de tes créations',
              detail: 'Un site, une appli, un outil IA, un jeu ? Il aura son stand au musée.',
              cta: 'Exposer',
              action: { kind: 'panel', panel: 'museum' },
              place: MUSEUM_SIGN,
            }
          : {
              id: 'create:creations',
              icon: '🖼️',
              title: 'Inspire-toi des créations des Malinos',
              detail:
                'Avec un compte, tu pourras ensuite exposer les tiennes et décorer ton propre studio.',
              cta: 'Découvrir',
              action: { kind: 'panel', panel: 'creations' },
              place: MUSEUM_KIOSK,
            },
      ];
    case 'meet': {
      const here = crowd(ctx);
      if (here)
        return [
          here,
          {
            id: 'meet:chat',
            icon: '💬',
            title: 'Dis bonjour à tout le monde',
            detail: 'Le chat « Tout le monde » est lu par tous les Malinos connectés.',
            cta: 'Écrire',
            action: { kind: 'chat' },
          },
        ];
      return [
        {
          id: 'meet:calm',
          icon: '🍃',
          title: 'Le Hub est calme en ce moment',
          detail:
            'Personne d’autre n’est connecté pour l’instant. Découvre les Malinos à travers leurs créations et leurs studios ouverts, ou repasse plus tard.',
          cta: 'Voir les créations',
          action: { kind: 'panel', panel: 'creations' },
          place: MUSEUM_KIOSK,
        },
      ];
    }
    default:
      return [];
  }
}

/** Lieux déjà proposés (marche ou lieu secondaire), pour ne pas les proposer deux fois. */
function places(list: readonly Activity[]): Set<string> {
  return new Set(
    list.flatMap((a) => [
      ...(a.action.kind === 'go' ? [a.action.object] : []),
      ...(a.place ? [a.place] : []),
    ]),
  );
}

/** Idées du moment, de la plus utile à la moins utile (au plus MAX_ACTIVITIES). */
export function suggestActivities(ctx: ActivityContext): Activity[] {
  const list: Activity[] = [];
  const add = (a: Activity | null) => {
    if (a && list.length < MAX_ACTIVITIES && !list.some((x) => x.id === a.id)) list.push(a);
  };
  // L'envie choisie passe en premier : une première réussite avant tout le reste.
  for (const a of starters(ctx)) add(a);
  add(nextQuest(ctx));
  // Le défi de la semaine passe avant le reste tant qu'il n'est pas joué.
  if (!ctx.quizWeeklyDone) add(quiz(ctx));
  add(crowd(ctx));
  const news = museum(ctx);
  // Un projet tout juste exposé passe avant les secrets ; les autres nouvelles, après.
  if (news?.id.startsWith('museum:new:')) add(news);
  add(secret(ctx));
  if (news && !news.id.startsWith('museum:new:')) add(news);
  add(openHome(ctx));
  if (ctx.quizWeeklyDone) add(quiz(ctx));
  add(ambient(ctx, places(list)));
  add(myStudio(ctx));
  return list;
}

/** Ce que la carte du retour sait en plus : mes projets en attente et mon pseudo. */
export interface RecapContext extends ActivityContext {
  /** Titres de mes projets en attente de validation (compte seulement). */
  pendingProjects?: readonly string[];
  /** Mon pseudo, pour reconnaître mon propre projet parmi les nouveautés du musée. */
  myName?: string | null;
}

/** Nombre de cartes « Reprends ici » au plus (cahier des charges du village, §6). */
export const MAX_RECAP = 3;

/**
 * Carte « Reprends ici » au retour : au plus 3 suites concrètes (mon projet tout juste exposé ou
 * en attente, défi de la semaine, carnet entamé, nouveauté du musée). Vide : rien ne s'affiche.
 */
export function recapActivities(ctx: RecapContext): Activity[] {
  const list: Activity[] = [];
  const add = (a: Activity | null) => {
    if (a && list.length < MAX_RECAP) list.push(a);
  };
  const latest = ctx.museum?.latest ?? null;
  const fresh = latest && latest.days < MUSEUM_NEW_DAYS ? latest : null;
  const mine = !!fresh && !!ctx.myName && fresh.author === ctx.myName;
  if (fresh && mine)
    add({
      id: `recap:mine:${fresh.id}`,
      icon: '🎉',
      title: `Ton projet « ${fresh.title} » est exposé`,
      detail: 'Il a son stand au musée : va voir son affiche, et parle-en aux Malinos.',
      cta: 'Voir',
      action: { kind: 'project', id: fresh.id },
      place: MUSEUM_NEWEST_STAND,
    });
  const pending = ctx.pendingProjects?.[0];
  if (pending)
    add({
      id: 'recap:pending',
      icon: '⏳',
      title: `« ${pending} » attend sa validation`,
      detail: 'Un modérateur va le regarder ; tu le suis dans « Mes projets ».',
      cta: 'Mes projets',
      action: { kind: 'panel', panel: 'museum' },
    });
  if (!ctx.quizWeeklyDone) add(quiz(ctx));
  const found = ctx.secretsFound.length;
  if (found > 0 && found < SECRETS.length) add(secret(ctx));
  if (fresh && !mine) add(museum(ctx));
  return list;
}

/** Numéro du jour (heure locale du joueur), pour varier les idées d'un jour à l'autre. */
export function dayNumber(date: Date): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
}
