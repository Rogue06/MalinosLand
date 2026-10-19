import { ACCOUNTS_ENABLED, SUPABASE_KEY, SUPABASE_URL } from '../config';
import { Store } from '../core/store';
import { sanitizeName } from '../core/text';
import { accountPlayerId } from '../multiplayer/protocol';
import { pushToast } from '../state';
import { parseProfile, profileStore, type Profile } from './profile';
import type { SupabaseClients } from './supabaseClients';

/**
 * Comptes joueurs (facultatifs) : connexion avec GitHub ou Google via Supabase, profil
 * (pseudo + apparence) enregistré en base et retrouvé sur tous les appareils.
 * Sans compte, rien ne change : le profil reste dans le navigateur.
 */

export type AccountProvider = 'github' | 'google';

export const PROVIDERS: { id: AccountProvider; label: string }[] = [
  { id: 'github', label: 'GitHub' },
  { id: 'google', label: 'Google' },
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
    };

export const accountStore = new Store<AccountState>({
  status: ACCOUNTS_ENABLED ? 'loading' : 'disabled',
});

/** Clé de stockage de la session : sa présence évite de charger Supabase pour les visiteurs. */
const STORAGE_KEY = 'malinos-auth';

let clients: Promise<SupabaseClients> | null = null;
function load(): Promise<SupabaseClients> {
  clients ??= import('./supabaseClients').then((m) =>
    m.createClients(SUPABASE_URL!, SUPABASE_KEY!, STORAGE_KEY),
  );
  return clients;
}

function hasStoredSession(): boolean {
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
    accountStore.set({ status: 'signed-in', user, savedName: remote?.name ?? null });
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

export async function signIn(provider: AccountProvider): Promise<void> {
  try {
    const { auth } = await load();
    const { error } = await auth.signInWithOAuth({
      provider,
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
  } catch {
    pushToast('Connexion impossible pour le moment.', '🔑', 6000);
  }
}

/** Déconnexion : le personnage reste dans ce navigateur ; la page est rechargée. */
export async function signOut(): Promise<void> {
  const { auth } = await load();
  await auth.signOut({ scope: 'local' });
  location.reload();
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
