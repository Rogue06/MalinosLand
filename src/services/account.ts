import { ACCOUNTS_ENABLED, SUPABASE_KEY, SUPABASE_URL } from '../config';
import { Store } from '../core/store';
import { sanitizeName } from '../core/text';
import { accountPlayerId } from '../multiplayer/protocol';
import { pushToast } from '../state';
import type { ReportDraft } from './moderation';
import { parseProfile, profileStore, type Profile } from './profile';
import type { SupabaseClients } from './supabaseClients';

/**
 * Comptes joueurs (facultatifs) : connexion avec GitHub ou Google via Supabase, profil
 * (pseudo + apparence) enregistré en base et retrouvé sur tous les appareils.
 * Sans compte, rien ne change : le profil reste dans le navigateur.
 */

export type AccountProvider = 'github' | 'google';

/** Google d'abord : c'est le compte que la plupart des Malinos ont déjà. */
export const PROVIDERS: { id: AccountProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
];

export interface AccountUser {
  id: string;
  provider: string;
  /** Pseudo proposé à partir du compte GitHub / Google (création du personnage). */
  suggestedName: string | null;
}

export type AccountState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'guest' }
  | {
      status: 'signed-in';
      user: AccountUser;
      /** Pseudo enregistré en base (null tant que le profil n'y est pas). */
      savedName: string | null;
      /** Modérateur (vérifié par la base, qui seule donne accès aux signalements). */
      moderator: boolean;
      /** Responsable du site (historique des connexions ; vérifié aussi par le serveur). */
      owner: boolean;
    };

export const accountStore = new Store<AccountState>({
  status: ACCOUNTS_ENABLED ? 'loading' : 'disabled',
});

/** Clé de stockage de la session : sa présence évite de charger Supabase pour les visiteurs. */
const STORAGE_KEY = 'malinos-auth';

let clients: Promise<SupabaseClients> | null = null;
/** Clients Supabase, chargés à la première utilisation (aussi pour les visiteurs). */
export function load(): Promise<SupabaseClients> {
  clients ??= import('./supabaseClients').then((m) =>
    m.createClients(SUPABASE_URL!, SUPABASE_KEY!, STORAGE_KEY),
  );
  return clients;
}

export function hasStoredSession(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Erreur lisible (pseudo déjà pris, réseau…). */
export class AccountError extends Error {}

function explain(error: { code?: string; message?: string } | null): AccountError {
  if (error?.code === '23505')
    return new AccountError('Ce pseudo est déjà pris par un autre Malino.');
  return new AccountError('Le serveur des comptes ne répond pas. Réessaie dans un instant.');
}

/** Ce qu'il faut faire des deux profils (navigateur et compte) à la connexion. */
export function reconcileProfiles(
  local: Profile | null,
  remote: Profile | null,
): { use: Profile | null; upload: boolean } {
  if (remote) return { use: remote, upload: false };
  if (local) return { use: local, upload: true };
  return { use: null, upload: false };
}

function signedInUser(): AccountUser | null {
  const s = accountStore.get();
  return s.status === 'signed-in' ? s.user : null;
}

/** Enregistre le profil du joueur connecté (création ou mise à jour). */
export async function saveRemoteProfile(profile: Profile): Promise<void> {
  const user = signedInUser();
  if (!user) return;
  const { db } = await load();
  const values = { name: profile.name, look: profile.look };
  const upd = await db.from('profiles').update(values).eq('id', user.id).select('id');
  if (upd.error) throw explain(upd.error);
  if (!upd.data?.length) {
    const ins = await db.from('profiles').insert({ id: user.id, ...values });
    if (ins.error) throw explain(ins.error);
  }
  lastSynced = JSON.stringify(values);
  const s = accountStore.get();
  if (s.status === 'signed-in' && s.savedName !== profile.name)
    accountStore.set({ ...s, savedName: profile.name });
}

let lastSynced = '';

function readUser(user: {
  id: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}): AccountUser {
  const m = user.user_metadata;
  const suggested = [m.user_name, m.preferred_username, m.name, m.full_name]
    .map((v) => sanitizeName(v))
    .find(Boolean);
  return {
    id: user.id,
    provider: typeof user.app_metadata.provider === 'string' ? user.app_metadata.provider : '',
    suggestedName: suggested ?? null,
  };
}

/** Nettoie l'adresse après le retour de GitHub / Google et signale une connexion refusée. */
function cleanReturnUrl(): void {
  const url = new URL(location.href);
  const failed = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (failed) pushToast('Connexion annulée ou refusée.', '🔑', 6000);
  for (const k of ['code', 'error', 'error_code', 'error_description', 'state'])
    url.searchParams.delete(k);
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/**
 * À appeler au démarrage. Rapide pour les visiteurs (aucun téléchargement) ; pour un joueur
 * connecté, récupère sa session et réconcilie son profil.
 */
export async function initAccount(): Promise<void> {
  if (!ACCOUNTS_ENABLED) return;
  const params = new URLSearchParams(location.search);
  const returning = params.has('code') || params.has('error');
  if (!returning && !hasStoredSession()) {
    accountStore.set({ status: 'guest' });
    return;
  }
  try {
    const { auth, db } = await load();
    const { data } = await auth.getSession();
    if (returning) cleanReturnUrl();
    if (!data.session) {
      accountStore.set({ status: 'guest' });
      return;
    }
    const user = readUser(data.session.user);
    const res = await db.from('profiles').select('name, look').eq('id', user.id).maybeSingle();
    if (res.error) throw res.error;
    const remote = parseProfile(res.data);
    const [modo, owner] = await Promise.all([db.rpc('is_moderator'), db.rpc('is_site_owner')]);
    accountStore.set({
      status: 'signed-in',
      user,
      savedName: remote?.name ?? null,
      moderator: modo.data === true,
      owner: owner.data === true,
    });
    const plan = reconcileProfiles(profileStore.get(), remote);
    if (plan.use) {
      lastSynced = JSON.stringify({ name: plan.use.name, look: plan.use.look });
      if (!plan.upload) profileStore.set(plan.use);
    }
    if (plan.upload && plan.use) {
      await saveRemoteProfile(plan.use).catch((e: unknown) => {
        lastSynced = '';
        const msg = e instanceof AccountError ? e.message : 'Profil non enregistré.';
        pushToast(`${msg} Change de pseudo (miroir ou 🧑) pour l’enregistrer.`, '🔑', 8000);
      });
    }
    if (returning) pushToast('Connecté à ton compte.', '🔑');
    auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') accountStore.set({ status: 'guest' });
    });
  } catch {
    accountStore.set({ status: 'guest' });
    pushToast('Connexion au compte impossible : tu joues en visiteur.', '🔑', 6000);
  }
}

/** Promesse résolue quand on sait si le joueur est connecté (le jeu attend cette étape). */
export function accountReady(): Promise<AccountState> {
  return new Promise((resolve) => {
    const check = (s: AccountState) => {
      if (s.status === 'loading') return false;
      resolve(s);
      return true;
    };
    if (check(accountStore.get())) return;
    const off = accountStore.subscribe((s) => check(s) && off());
  });
}

/** Identifiant réseau : celui du compte si son profil est enregistré, sinon `fallback`. */
export function networkId(fallback: string): string {
  const s = accountStore.get();
  if (s.status !== 'signed-in' || !s.savedName) return fallback;
  return accountPlayerId(s.user.id) ?? fallback;
}

/** Jeton de connexion pour le serveur temps réel (null : visiteur). */
export async function accessToken(): Promise<string | null> {
  if (!signedInUser()) return null;
  const { auth } = await load();
  const { data } = await auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Part vers Google / GitHub. `redirectTo` : page de retour (par défaut la page actuelle ; le
 * site d'accueil renvoie vers le jeu). Elle doit être autorisée dans Supabase (docs/COMPTES.md).
 * Renvoie false si le départ a échoué.
 */
export async function signIn(
  provider: AccountProvider,
  redirectTo = location.origin + location.pathname,
): Promise<boolean> {
  try {
    const { auth } = await load();
    const { error } = await auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
    return true;
  } catch {
    pushToast('Connexion impossible pour le moment.', '🔑', 6000);
    return false;
  }
}

/** Déconnexion : le personnage reste dans ce navigateur ; la page est rechargée. */
export async function signOut(): Promise<void> {
  const { auth } = await load();
  await auth.signOut({ scope: 'local' });
  location.reload();
}

/** Envoie un signalement (joueur connecté uniquement ; la base vérifie et limite). */
export async function sendReport(report: ReportDraft): Promise<void> {
  if (!signedInUser()) throw new AccountError('Connecte-toi pour signaler un joueur.');
  const { db } = await load();
  const { error } = await db.from('reports').insert(report);
  if (!error) return;
  if (/Trop de signalements/.test(error.message ?? ''))
    throw new AccountError('Tu as atteint la limite de signalements pour aujourd’hui.');
  throw explain(error);
}

export interface ReportRow {
  id: number;
  created_at: string;
  reported_player: string;
  reported_account: string | null;
  reported_name: string;
  reason: string;
  details: string;
  messages: unknown;
  status: 'ouvert' | 'traite';
}

/** Signalements (modérateurs seulement : la base renvoie une liste vide aux autres). */
export async function listReports(status: 'ouvert' | 'traite'): Promise<ReportRow[]> {
  const { db } = await load();
  const { data, error } = await db
    .from('reports')
    .select(
      'id, created_at, reported_player, reported_account, reported_name, reason, details, messages, status',
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw explain(error);
  return (data ?? []) as ReportRow[];
}

export async function setReportStatus(id: number, status: 'ouvert' | 'traite'): Promise<void> {
  const { db } = await load();
  const { error } = await db.from('reports').update({ status }).eq('id', id);
  if (error) throw explain(error);
}

export type FeedbackKind = 'bug' | 'idee';

export interface FeedbackDraft {
  kind: FeedbackKind;
  message: string;
  author_name: string | null;
  context: Record<string, string>;
}

/**
 * Envoie une idée ou un bug. Un joueur connecté écrit directement (reconnu par la base, 10 par
 * jour). Un visiteur passe par la fonction Edge « feedback » avec son jeton Turnstile
 * (`captchaToken`) : la fonction vérifie qu'il n'est pas un robot avant d'enregistrer.
 */
export async function sendFeedback(row: FeedbackDraft, captchaToken?: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY)
    throw new AccountError('Envoi indisponible dans cette version.');
  if (captchaToken !== undefined)
    return sendAsVisitor(SUPABASE_URL, SUPABASE_KEY, row, captchaToken);
  const { db } = await load();
  const { error } = await db.from('feedback').insert(row);
  if (!error) return;
  if (/Trop de messages/.test(error.message ?? ''))
    throw new AccountError('Beaucoup de messages en ce moment : réessaie un peu plus tard.');
  throw explain(error);
}

async function sendAsVisitor(
  url: string,
  key: string,
  row: FeedbackDraft,
  token: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify({ ...row, token }),
    });
  } catch {
    throw new AccountError('Envoi impossible : vérifie ta connexion.');
  }
  if (res.ok) return;
  if (res.status === 429)
    throw new AccountError('Beaucoup de messages en ce moment : réessaie un peu plus tard.');
  if (res.status === 403)
    throw new AccountError('La vérification anti-robots n’est pas passée : réessaie.');
  throw new AccountError('Envoi impossible pour le moment : réessaie plus tard.');
}

export interface FeedbackRow {
  id: number;
  created_at: string;
  kind: FeedbackKind;
  message: string;
  author_name: string | null;
  context: unknown;
  status: 'nouveau' | 'traite';
}

/** Idées et bugs (modérateurs seulement : la base renvoie une liste vide aux autres). */
export async function listFeedback(status: 'nouveau' | 'traite'): Promise<FeedbackRow[]> {
  const { db } = await load();
  const { data, error } = await db
    .from('feedback')
    .select('id, created_at, kind, message, author_name, context, status')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw explain(error);
  return (data ?? []) as FeedbackRow[];
}

export async function setFeedbackStatus(id: number, status: 'nouveau' | 'traite'): Promise<void> {
  const { db } = await load();
  const { error } = await db.from('feedback').update({ status }).eq('id', id);
  if (error) throw explain(error);
}

/** Suppression définitive du compte et du profil en base (RGPD). */
export async function deleteAccount(): Promise<void> {
  const { auth, db } = await load();
  const { error } = await db.rpc('delete_my_account');
  if (error) throw explain(error);
  await auth.signOut({ scope: 'local' });
  location.reload();
}

/** Les changements de profil d'un joueur connecté sont enregistrés en base (regroupés). */
let syncTimer: ReturnType<typeof setTimeout> | null = null;
profileStore.subscribe((p) => {
  if (!p || !signedInUser() || JSON.stringify({ name: p.name, look: p.look }) === lastSynced)
    return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    saveRemoteProfile(p).catch((e: unknown) => {
      const s = accountStore.get();
      const msg = e instanceof AccountError ? e.message : 'Profil non enregistré.';
      pushToast(msg, '🔑', 6000);
      // Pseudo refusé : on revient au pseudo enregistré pour rester cohérent avec le serveur.
      if (s.status === 'signed-in' && s.savedName && p.name !== s.savedName)
        profileStore.set({ ...p, name: s.savedName });
    });
  }, 800);
});
