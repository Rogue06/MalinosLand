// Point d'entrée Deno de la fonction Edge « feedback » (logique : handler.ts).
// Mise en ligne : voir docs/COMPTES.md (« Anti-robots de la boîte à idées »).
import { handleFeedback, parseOrigins, pickServiceKey } from './handler.ts';

Deno.serve((req: Request) =>
  handleFeedback(req, {
    turnstileSecret: Deno.env.get('TURNSTILE_SECRET_KEY'),
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    serviceKey: pickServiceKey(
      Deno.env.get('SUPABASE_SECRET_KEYS'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    ),
    allowedOrigins: parseOrigins(Deno.env.get('ALLOWED_ORIGINS')),
    fetch,
  }),
);
