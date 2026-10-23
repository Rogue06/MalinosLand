/**
 * Musée des Malinos (v0.4, DEC-035) côté jeu : proposer un projet, suivre les siens, et pour les
 * modérateurs, valider ou refuser. Toutes les règles sont dans la base (RLS et fonctions,
 * migration 20261027090000_museum.sql) : l'interface ne fait que demander.
 * Les données reçues sont relues ici (textes nettoyés, adresses revérifiées) avant affichage.
 */
import { MUSEUM_CATEGORY_IDS, type MuseumCategory } from '../content/museum';
import {
  PROJECT_SUMMARY_MAX,
  PROJECT_TAG_MAX,
  PROJECT_TAGS_MAX,
  PROJECT_TITLE_MAX,
  REJECT_REASON_MAX,
  isValidProjectUrl,
  type ProjectDraft,
} from '../core/museum';
import { sanitizeName, sanitizeText } from '../core/text';
import { AccountError, accountStore, load } from './account';

export type ProjectStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  pending: 'En attente de validation',
  approved: 'Exposé au musée',
  rejected: 'Refusé',
  withdrawn: 'Retiré',
};

/** Projets par page dans le musée (plafond imposé aussi par la base). */
export const MUSEUM_PAGE_SIZE = 20;

export interface Project {
  id: number;
  title: string;
  summary: string;
  url: string;
  category: MuseumCategory;
  tags: string[];
}

/** Un de mes projets, avec son statut. */
export interface MyProject extends Project {
  status: ProjectStatus;
  rejectReason: string | null;
  createdAt: string;
}

/** Projet exposé (liste publique du musée). */
export interface MuseumProject extends Project {
  author: string;
  embed: 'unknown' | 'ok' | 'refused';
  approvedAt: string;
}

/** Projet vu par un modérateur. */
export interface ModeratedProject extends MyProject {
  author: string;
}

const fail = () =>
  new AccountError('Le serveur des comptes ne répond pas. Réessaie dans un instant.');

const STATUSES: readonly string[] = ['pending', 'approved', 'rejected', 'withdrawn'];
const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '');

/** Relit un projet reçu de la base ; null s'il est inutilisable (adresse invalide, etc.). */
export function parseProject(raw: unknown): Project | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'number' ? r.id : Number(r.id);
  const title = sanitizeText(r.title, PROJECT_TITLE_MAX);
  const summary = sanitizeText(r.summary, PROJECT_SUMMARY_MAX);
  const url = typeof r.url === 'string' ? r.url : '';
  const category = MUSEUM_CATEGORY_IDS.find((c) => c === r.category);
  if (!Number.isSafeInteger(id) || id <= 0 || !title || !category || !isValidProjectUrl(url))
    return null;
  const tags = Array.isArray(r.tags)
    ? r.tags
        .map((t) => sanitizeText(t, PROJECT_TAG_MAX))
        .filter(Boolean)
        .slice(0, PROJECT_TAGS_MAX)
    : [];
  return { id, title, summary, url, category, tags };
}

function parseMine(raw: unknown): MyProject | null {
  const p = parseProject(raw);
  if (!p) return null;
  const r = raw as Record<string, unknown>;
  const status = STATUSES.includes(r.status as string) ? (r.status as ProjectStatus) : 'pending';
  const reason = sanitizeText(r.reject_reason, REJECT_REASON_MAX);
  return { ...p, status, rejectReason: reason || null, createdAt: isoDate(r.created_at) };
}

export function parseMyProjects(rows: unknown): MyProject[] {
  return Array.isArray(rows) ? rows.flatMap((r) => parseMine(r) ?? []) : [];
}

export function parseMuseumProjects(rows: unknown): MuseumProject[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((raw) => {
    const p = parseProject(raw);
    if (!p) return [];
    const r = raw as Record<string, unknown>;
    const embed = r.embed === 'ok' || r.embed === 'refused' ? r.embed : 'unknown';
    return [
      {
        ...p,
        author: sanitizeName(r.author) ?? 'Malino',
        embed,
        approvedAt: isoDate(r.approved_at),
      },
    ];
  });
}

/** Message clair pour les refus de la base (plafonds anti-abus, contrôles). */
export function explainProjectError(error: { code?: string; message?: string } | null) {
  const msg = error?.message ?? '';
  if (/Trop de propositions/.test(msg))
    return new AccountError('Tu as déjà proposé 5 projets aujourd’hui. Réessaie demain.');
  if (/Déjà 3 projets en attente/.test(msg))
    return new AccountError(
      'Tu as déjà 3 projets en attente : attends que les modérateurs les examinent.',
    );
  if (/Déjà 10 projets exposés/.test(msg))
    return new AccountError(
      'Tu exposes déjà 10 projets : retires-en un pour en proposer un autre.',
    );
  if (error?.code === '23514' || error?.code === '42501')
    return new AccountError('Projet refusé par le serveur : vérifie l’adresse et les textes.');
  return fail();
}

function requireAccount(): string {
  const account = accountStore.get();
  if (account.status !== 'signed-in')
    throw new AccountError('Connecte-toi à ton compte pour exposer un projet.');
  return account.user.id;
}

/** Propose un projet : il part « en attente » jusqu'à la décision d'un modérateur. */
export async function submitProject(draft: ProjectDraft): Promise<void> {
  requireAccount();
  const { db } = await load();
  const { error } = await db.from('projects').insert({
    title: draft.title,
    summary: draft.summary,
    url: draft.url,
    category: draft.category,
    tags: draft.tags,
  });
  if (error) throw explainProjectError(error);
}

const MINE_COLUMNS = 'id, title, summary, url, category, tags, status, reject_reason, created_at';

/** Mes projets, du plus récent au plus ancien. */
export async function myProjects(): Promise<MyProject[]> {
  const me = requireAccount();
  const { db } = await load();
  const { data, error } = await db
    .from('projects')
    .select(MINE_COLUMNS)
    .eq('owner_id', me)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw fail();
  return parseMyProjects(data);
}

/** Retire un de mes projets (il n'est plus visible des autres). */
export async function withdrawProject(id: number): Promise<void> {
  const { db } = await load();
  const { error } = await db.rpc('withdraw_my_project', { p_id: id });
  if (error) throw fail();
}

/** Projets exposés, les plus récents d'abord, par pages de 20 (catégorie facultative). */
export async function listApproved(
  category: MuseumCategory | null = null,
  page = 0,
): Promise<MuseumProject[]> {
  const { db } = await load();
  const { data, error } = await db.rpc('museum_projects', {
    p_category: category,
    p_limit: MUSEUM_PAGE_SIZE,
    p_offset: Math.max(0, page) * MUSEUM_PAGE_SIZE,
  });
  if (error) throw fail();
  return parseMuseumProjects(data);
}

/** Modérateurs : projets en attente, les plus anciens d'abord (la base vérifie le rôle). */
export async function listPending(): Promise<ModeratedProject[]> {
  const { db } = await load();
  const { data, error } = await db
    .from('projects')
    .select(`${MINE_COLUMNS}, owner_id`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw fail();
  const rows = (data ?? []) as Array<{ owner_id?: unknown }>;
  const owners = [...new Set(rows.map((r) => r.owner_id).filter((o) => typeof o === 'string'))];
  const names = new Map<string, string>();
  if (owners.length > 0) {
    const res = await db.from('profiles').select('id, name').in('id', owners);
    for (const p of (res.data ?? []) as Array<{ id: string; name: unknown }>)
      names.set(p.id, sanitizeName(p.name) ?? 'Malino');
  }
  return rows.flatMap((r) => {
    const p = parseMine(r);
    return p ? [{ ...p, author: names.get(r.owner_id as string) ?? 'Malino' }] : [];
  });
}

/** Modérateurs : valider, refuser (motif court) ou retirer un projet. */
export async function moderateProject(
  id: number,
  status: 'approved' | 'rejected' | 'withdrawn',
  reason = '',
): Promise<void> {
  const { db } = await load();
  const { error } = await db.rpc('moderate_project', {
    p_id: id,
    p_status: status,
    p_reason: status === 'approved' ? null : sanitizeText(reason, REJECT_REASON_MAX) || null,
  });
  if (error)
    throw /Réservé aux modérateurs/.test(error.message ?? '')
      ? new AccountError('Réservé aux modérateurs.')
      : fail();
}
