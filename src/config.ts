/**
 * Configuration publique du jeu, fixée au moment du build (variables `VITE_…`, voir
 * `.env.example`). Rien de secret ici : tout ce qui est dans le navigateur est public.
 */

/** Adresse du serveur temps réel (ws:// ou wss://). Absente : multijoueur local ou solo. */
export const REALTIME_URL: string | null = parseRealtimeUrl(import.meta.env.VITE_REALTIME_URL);

export function parseRealtimeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  return /^wss?:\/\/[^\s]+$/.test(url) ? url : null;
}

export function parseHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+$/i.test(url) ? url : null;
}

/** Comptes joueurs (Supabase) : adresse du projet et clé PUBLIQUE. Absents : pas de comptes. */
export const SUPABASE_URL: string | null = parseHttpsUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey: unknown = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const SUPABASE_KEY: string | null =
  typeof supabaseKey === 'string' && /^[A-Za-z0-9_.-]{20,}$/.test(supabaseKey) ? supabaseKey : null;
/** Les comptes n'ont de sens qu'en ligne. */
export const ACCOUNTS_ENABLED = !!(REALTIME_URL && SUPABASE_URL && SUPABASE_KEY);

/** Ce que le jeu transmet, affiché aux joueurs (doit rester exact : voir docs/SECURITY.md). */
export const PRIVACY_NOTE = REALTIME_URL
  ? 'Version 0.2 · en ligne. Ton pseudo, ton apparence, ta position et tes messages sont ' +
    'transmis en direct aux joueurs connectés, sans être conservés par le serveur. ' +
    (ACCOUNTS_ENABLED
      ? 'Sans compte, ton personnage reste dans ce navigateur. Avec un compte (GitHub ou ' +
        'Google), ton pseudo et ton apparence sont enregistrés (Supabase, en Europe) ; ' +
        'tu peux supprimer ton compte à tout moment.'
      : 'Ton personnage est enregistré dans ce navigateur.')
  : 'Version hors ligne : ton personnage est enregistré uniquement dans ce navigateur. ' +
    'Aucun compte, aucune donnée envoyée sur Internet.';
