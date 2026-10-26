import { MUSEUM_CATEGORY_IDS, type MuseumCategory } from '../content/museum';
import { sanitizeText } from './text';

/**
 * Musée des Malinos : vérification d'un projet avant l'envoi. Mêmes règles que la base
 * (migration 20261027090000_museum.sql), qui reste seule juge : ici, on aide seulement à
 * corriger avant d'envoyer, avec des messages clairs. Logique pure et testée.
 */

export const PROJECT_TITLE_MIN = 2;
export const PROJECT_TITLE_MAX = 60;
export const PROJECT_SUMMARY_MIN = 10;
export const PROJECT_SUMMARY_MAX = 280;
export const PROJECT_URL_MAX = 300;
export const PROJECT_TAGS_MAX = 3;
export const PROJECT_TAG_MAX = 20;
export const REJECT_REASON_MAX = 140;

export interface ProjectDraft {
  title: string;
  summary: string;
  url: string;
  category: MuseumCategory;
  tags: string[];
}

/** Ce que la personne a saisi dans le formulaire (mots-clés séparés par des virgules). */
export interface ProjectInput {
  title: string;
  summary: string;
  url: string;
  category: string;
  tags: string;
}

export type DraftField = keyof ProjectInput;
export type DraftErrors = Partial<Record<DraftField, string>>;

const length = (s: string) => Array.from(s).length;

// Même expression que valid_project_url dans la base.
const URL_RE =
  // eslint-disable-next-line no-control-regex
  /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,63}([/?#][^\s\u0000-\u001f\u007f-\u009f]*)?$/;
const LOCAL_HOST_RE = /(^|\.)(localhost|local|internal|lan|home|arpa|test|example|invalid)$/;
// MalinosLand lui-même peut s'exposer (adresse exacte du jeu, DEC-041) ; ses sous-adresses
// (essais de mise en ligne) et Supabase, non.
const OWN_HOST_RE = /(\.malinosland\.pages\.dev|(^|\.)supabase\.(co|com|in))$/;
/** Adresse publique du jeu. */
export const GAME_HOST = 'malinosland.pages.dev';

/** Le projet est-il MalinosLand lui-même ? (pas de démo intégrée pour lui) */
export function isGameSite(u: string): boolean {
  return /^https:\/\/([^/?#]+)/.exec(u)?.[1] === GAME_HOST;
}

/**
 * Remet une adresse saisie en forme : espaces autour retirés, « https:// » ajouté s'il manque,
 * nom de domaine en minuscules. Ne corrige rien d'autre (« http:// » reste refusé).
 */
export function normalizeProjectUrl(input: string): string {
  let u = input.trim();
  if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u)) u = `https://${u}`;
  const m = /^(https?):\/\/([^/?#]*)(.*)$/i.exec(u);
  return m ? `${m[1]!.toLowerCase()}://${m[2]!.toLowerCase()}${m[3]}` : u;
}

/** Même verdict que valid_project_url (la base), sur une adresse déjà mise en forme. */
export function isValidProjectUrl(u: string): boolean {
  if (length(u) > PROJECT_URL_MAX || !URL_RE.test(u)) return false;
  const host = /^https:\/\/([^/?#]+)/.exec(u)![1]!;
  return !LOCAL_HOST_RE.test(host) && !OWN_HOST_RE.test(host);
}

/** Pourquoi une adresse est refusée (message pour la personne), ou null si elle convient. */
export function projectUrlProblem(u: string): string | null {
  if (!u) return 'Indique l’adresse de ton projet.';
  if (isValidProjectUrl(u)) return null;
  if (length(u) > PROJECT_URL_MAX)
    return `Adresse trop longue (${PROJECT_URL_MAX} caractères au plus).`;
  if (/^http:\/\//.test(u))
    return 'Seules les adresses sécurisées sont acceptées : elles commencent par https://.';
  if (!/^https:\/\//.test(u)) return 'L’adresse doit commencer par https://.';
  if (/\s/.test(u)) return 'L’adresse ne doit pas contenir d’espace.';
  const host = /^https:\/\/([^/?#]*)/.exec(u)![1]!;
  if (host.includes('@')) return 'L’adresse ne doit pas contenir d’identifiant ni de mot de passe.';
  if (host.includes(':') || host.startsWith('['))
    return 'Indique une adresse sans numéro de port (ex. https://mon-projet.fr).';
  if (/^[0-9.]+$/.test(host)) return 'Indique le nom du site, pas une adresse IP.';
  if (LOCAL_HOST_RE.test(host))
    return 'Cette adresse n’est pas accessible depuis Internet : indique l’adresse publique.';
  if (OWN_HOST_RE.test(host))
    return host.endsWith(GAME_HOST)
      ? `Adresse d’essai de MalinosLand : utilise https://${GAME_HOST}.`
      : 'Les adresses techniques de MalinosLand ne peuvent pas être exposées au musée.';
  return 'Adresse invalide. Exemple : https://mon-projet.github.io';
}

/** Mots-clés saisis « IA, jeu, #musique » → ['IA', 'jeu', 'musique'] (sans doublon). */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const tag = sanitizeText(raw.replace(/^\s*#+/, ''), 100);
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}

const isCategory = (c: string): c is MuseumCategory =>
  (MUSEUM_CATEGORY_IDS as readonly string[]).includes(c);

/** Projet prêt à envoyer, ou la liste des corrections à faire (un message par champ). */
export function checkProjectDraft(input: ProjectInput): {
  draft: ProjectDraft | null;
  errors: DraftErrors;
} {
  const errors: DraftErrors = {};
  // Assez long pour repérer un dépassement (le champ du formulaire limite déjà la saisie).
  const title = sanitizeText(input.title, PROJECT_TITLE_MAX + 1);
  const summary = sanitizeText(input.summary, PROJECT_SUMMARY_MAX + 1);
  const url = normalizeProjectUrl(input.url);
  const tags = parseTags(input.tags);

  if (length(title) < PROJECT_TITLE_MIN) errors.title = 'Donne un titre à ton projet.';
  else if (length(title) > PROJECT_TITLE_MAX)
    errors.title = `Titre trop long (${PROJECT_TITLE_MAX} caractères au plus).`;
  if (length(summary) < PROJECT_SUMMARY_MIN)
    errors.summary = `Décris ton projet en une ou deux phrases (${PROJECT_SUMMARY_MIN} caractères au moins).`;
  else if (length(summary) > PROJECT_SUMMARY_MAX)
    errors.summary = `Description trop longue (${PROJECT_SUMMARY_MAX} caractères au plus).`;
  const urlProblem = projectUrlProblem(url);
  if (urlProblem) errors.url = urlProblem;
  if (!isCategory(input.category)) errors.category = 'Choisis une catégorie.';
  if (tags.length > PROJECT_TAGS_MAX)
    errors.tags = `${PROJECT_TAGS_MAX} mots-clés au plus, séparés par des virgules.`;
  else if (tags.some((t) => length(t) > PROJECT_TAG_MAX))
    errors.tags = `Chaque mot-clé fait ${PROJECT_TAG_MAX} caractères au plus.`;

  if (Object.keys(errors).length > 0) return { draft: null, errors };
  return {
    draft: { title, summary, url, category: input.category as MuseumCategory, tags },
    errors,
  };
}
