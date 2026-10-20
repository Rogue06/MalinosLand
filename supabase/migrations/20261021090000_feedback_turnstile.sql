-- Boîte à idées / borne à bugs : les VISITEURS (sans compte) passent désormais par la fonction
-- Edge « feedback » (supabase/functions/feedback), qui vérifie Cloudflare Turnstile (anti-robots)
-- puis écrit avec la clé serveur. Le rôle anonyme ne peut plus écrire directement dans la table.
-- Les joueurs connectés écrivent toujours directement (10 par jour, voir feedback_rate_limit).
-- À appliquer APRÈS la mise en ligne du jeu qui utilise la fonction.

drop policy "Tout le monde peut proposer une idée ou signaler un bug" on public.feedback;

create policy "Les joueurs connectés proposent une idée ou signalent un bug"
  on public.feedback for insert
  to authenticated
  with check (author_id = (select auth.uid()) and status = 'nouveau');

revoke insert on public.feedback from anon;
