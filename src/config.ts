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
