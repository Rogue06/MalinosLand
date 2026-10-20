-- Responsable du site : le seul à voir l'historique des connexions (DEC-022). Rôle distinct des
-- modérateurs, pour que l'historique reste privé même si l'équipe de modération s'agrandit.
-- Ajout à la main (SQL Editor) : insert into public.site_owners (user_id) values ('<uuid>');
-- Tests : tests/database.test.ts (PGlite).

create table public.site_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.site_owners is 'Responsable(s) du site : accès à l''historique des connexions.';

-- Aucune règle : personne ne lit ni n'écrit cette table par l'API.
alter table public.site_owners enable row level security;
revoke all on public.site_owners from anon, authenticated;

-- Utilisée par le jeu et par le serveur temps réel, avec le jeton du joueur.
create function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.site_owners o where o.user_id = (select auth.uid()));
$$;

revoke execute on function public.is_site_owner() from public;
grant execute on function public.is_site_owner() to anon, authenticated;
