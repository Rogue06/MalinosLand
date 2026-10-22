/**
 * Invitations reçues dans un logement : avis en direct (message réseau `invite`) ou, à la
 * connexion, invitations faites pendant qu'on était absent. On retient celles déjà vues (dans ce
 * navigateur) pour ne pas les reproposer à chaque visite.
 */
import { invitationsStore, pushInvitation, type Invitation } from '../state';
import { visitableHomes } from './homes';
import { storage } from './storage';

const KEY = 'invitations-vues';
const VERSION = 1;
const MAX_SEEN = 200;

const parseSeen = (raw: unknown): string[] | null =>
  Array.isArray(raw)
    ? raw.filter((r): r is string => typeof r === 'string').slice(-MAX_SEEN)
    : null;

let seen: string[] = storage.read(KEY, VERSION, parseSeen) ?? [];

/** Invitation traitée (« Y aller » ou « Plus tard ») : retirée et retenue. */
export function dismissInvitation(inv: Invitation): void {
  invitationsStore.update((list) => list.filter((i) => i.room !== inv.room));
  if (!seen.includes(inv.room)) {
    seen = [...seen, inv.room].slice(-MAX_SEEN);
    storage.write(KEY, VERSION, seen);
  }
}

/** À la connexion : propose les invitations reçues pendant l'absence (pas encore vues). */
export async function checkPendingInvitations(): Promise<void> {
  try {
    const homes = await visitableHomes();
    for (const h of homes) {
      if (h.access === 'invite' && !seen.includes(h.room))
        pushInvitation({ room: h.room, ownerName: h.ownerName });
    }
  } catch {
    // Pas grave : les logements restent listés dans l'ascenseur.
  }
}
