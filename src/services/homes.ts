/**
 * Logements (v0.3) côté jeu : mon logement, son mode d'accès, mes invitations, les logements à
 * visiter. Toutes les règles sont dans la base (RLS et fonctions, migration
 * 20261022090000_homes.sql) et l'entrée est vérifiée par le serveur temps réel : l'interface ne
 * fait que demander.
 */
import { SUPABASE_KEY, SUPABASE_URL } from '../config';
import { sanitizeName } from '../core/text';
import { accountPlayerId, accountUuid, homeRoom } from '../multiplayer/protocol';
import type { DecorItem } from '../world/decor';
import { AccountError, accountStore, load } from './account';

export type HomeAccess = 'private' | 'invite' | 'public';
export const HOME_ACCESS: { id: HomeAccess; label: string; help: string }[] = [
  { id: 'private', label: '🔒 Personne', help: 'Toi seul peux entrer.' },
  { id: 'invite', label: '✉️ Sur invitation', help: 'Toi et les Malinos que tu invites.' },
  { id: 'public', label: '🚪 Tout le monde', help: 'Ouvert à tous, même sans compte.' },
];

export interface HomeEntry {
  /** Salle du logement (`home-…`). */
  room: string;
  ownerName: string;
  access: HomeAccess;
}

export interface Guest {
  /** Identifiant réseau du compte invité (UUID sans tirets). */
  id: string;
  name: string;
}

const online = () => !!(SUPABASE_URL && SUPABASE_KEY);
const fail = () =>
  new AccountError('Le serveur des comptes ne répond pas. Réessaie dans un instant.');

export function parseAccess(value: unknown): HomeAccess {
  return value === 'invite' || value === 'public' ? value : 'private';
}

/** Mode d'accès de mon logement (le crée au besoin). Compte nécessaire. */
export async function myHomeAccess(): Promise<HomeAccess> {
  const { db } = await load();
  const { data, error } = await db.rpc('my_home');
  if (error) throw fail();
  return parseAccess(data);
}

export async function setMyHomeAccess(access: HomeAccess): Promise<void> {
  const account = accountStore.get();
  if (account.status !== 'signed-in') throw new AccountError('Connecte-toi d’abord.');
  const { db } = await load();
  await myHomeAccess(); // le logement doit exister
  // Filtre explicite : la base refuse les modifications sans condition.
  const { error } = await db.from('homes').update({ access }).eq('owner_id', account.user.id);
  if (error) throw fail();
}

/** Invités de mon logement. */
export async function myGuests(): Promise<Guest[]> {
  const { db } = await load();
  const { data, error } = await db.rpc('my_home_invites');
  if (error) throw fail();
  return parseGuests(data);
}

export function parseGuests(rows: unknown): Guest[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r: { guest_id?: unknown; name?: unknown }) => {
    const id = typeof r.guest_id === 'string' ? accountPlayerId(r.guest_id) : null;
    return id ? [{ id, name: sanitizeName(r.name) || 'Malino' }] : [];
  });
}

/** Invite un joueur connecté à son compte (identifiant réseau de 32 caractères). */
export async function inviteGuest(guestUuid: string): Promise<void> {
  const { db } = await load();
  await myHomeAccess();
  const { error } = await db.from('home_invites').insert({ guest_id: guestUuid });
  if (!error || error.code === '23505') return; // déjà invité : rien à faire
  if (/Trop d'invitations/.test(error.message ?? ''))
    throw new AccountError('Tu as déjà invité 50 Malinos : retire une invitation d’abord.');
  throw fail();
}

export async function removeGuest(guestUuid: string): Promise<void> {
  const { db } = await load();
  const { error } = await db.from('home_invites').delete().eq('guest_id', guestUuid);
  if (error) throw fail();
}

/** Logements que je peux visiter (ouverts à tous, ou où je suis invité). */
export async function visitableHomes(): Promise<HomeEntry[]> {
  if (!online()) return [];
  const { db } = await load();
  const { data, error } = await db.rpc('visitable_homes');
  if (error) throw fail();
  return parseHomes(data);
}

export function parseHomes(rows: unknown): HomeEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r: { owner_id?: unknown; name?: unknown; access?: unknown }) => {
    const id = typeof r.owner_id === 'string' ? accountPlayerId(r.owner_id) : null;
    return id
      ? [
          {
            room: homeRoom(id),
            ownerName: sanitizeName(r.name) || 'Malino',
            access: parseAccess(r.access),
          },
        ]
      : [];
  });
}

/**
 * Décoration brute d'un logement (identifiant réseau du propriétaire) : null pour le studio
 * d'origine, ou si l'on n'a pas le droit d'entrer. Le jeu la lit et la revérifie avec
 * `parseDecor` / `buildHomeMap` (src/world/decor.ts).
 */
export async function fetchDecor(ownerId: string): Promise<unknown> {
  const uuid = accountUuid(ownerId);
  if (!online() || !uuid) return null;
  const { db } = await load();
  const { data, error } = await db.rpc('home_decor', { p_owner: uuid });
  if (error) throw fail();
  return data as unknown;
}

/** Enregistre la décoration de mon logement (null : retour au studio d'origine). */
export async function saveMyDecor(items: DecorItem[] | null): Promise<void> {
  const account = accountStore.get();
  if (account.status !== 'signed-in') throw new AccountError('Connecte-toi d’abord.');
  const { db } = await load();
  await myHomeAccess(); // le logement doit exister
  const decor = items?.map(({ t, x, y, r, v }) => ({ t, x, y, r, v })) ?? null;
  const { error } = await db.from('homes').update({ decor }).eq('owner_id', account.user.id);
  if (error) throw fail();
}
