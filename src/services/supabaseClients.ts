import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';

/**
 * Clients Supabase (connexion + base de données). Ce module n'est chargé qu'à la demande
 * (`import()` dans account.ts) : les visiteurs sans compte ne le téléchargent jamais.
 * Seule la clé PUBLIQUE est utilisée ; les droits sont vérifiés par la base (RLS).
 */
export function createClients(url: string, key: string, storageKey: string) {
  const auth = new AuthClient({
    url: `${url}/auth/v1`,
    headers: { apikey: key },
    storageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Retour de GitHub / Google avec un code à usage unique (plus sûr qu'un jeton dans l'URL).
    flowType: 'pkce',
  });
  const db = new PostgrestClient(`${url}/rest/v1`, {
    headers: { apikey: key },
    // Chaque requête porte le jeton du joueur connecté (sinon : visiteur anonyme).
    fetch: async (input, init) => {
      const { data } = await auth.getSession();
      const headers = new Headers(init?.headers);
      if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
      return fetch(input, { ...init, headers });
    },
  });
  return { auth, db };
}

export type SupabaseClients = ReturnType<typeof createClients>;
