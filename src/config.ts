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

/** Ce que le jeu transmet, affiché aux joueurs (doit rester exact : voir docs/SECURITY.md). */
export const PRIVACY_NOTE = REALTIME_URL
  ? 'Version 0.2 · en ligne : pas encore de compte, ton personnage est enregistré dans ce navigateur. ' +
    'Ton pseudo, ton apparence, ta position et tes messages sont transmis en direct aux joueurs ' +
    'connectés, sans être conservés par le serveur.'
  : 'Version hors ligne : ton personnage est enregistré uniquement dans ce navigateur. ' +
    'Aucun compte, aucune donnée envoyée sur Internet.';
