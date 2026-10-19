-- Boîte à idées et signalement de bugs : ouverts à tous (même sans compte), lus par les
-- modérateurs, qui peuvent ensuite créer un ticket GitHub pour les contributeurs.
-- Tests : tests/database.test.ts (PGlite, sans compte).

create table public.feedback (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('bug', 'idee')),
  message text not null check (char_length(btrim(message)) between 5 and 1000),
  -- Auteur connecté (rempli par la base), ou rien pour un visiteur.
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text check (author_name is null or char_length(author_name) between 1 and 40),
  -- Contexte technique léger : lieu dans le jeu, version, taille d'écran.
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 1024),
  status text not null default 'nouveau' check (status in ('nouveau', 'traite')),
  created_at timestamptz not null default now()
);

comment on table public.feedback is 'Idées et bugs envoyés depuis le jeu, lus par les modérateurs.';

create index feedback_open_idx on public.feedback (status, created_at desc);
create index feedback_author_idx on public.feedback (author_id, created_at desc);

alter table public.feedback enable row level security;

create policy "Tout le monde peut proposer une idée ou signaler un bug"
  on public.feedback for insert
  to anon, authenticated
  with check (author_id is not distinct from (select auth.uid()) and status = 'nouveau');

create policy "Les modérateurs lisent les idées et bugs"
  on public.feedback for select
  to authenticated
  using ((select public.is_moderator()));

create policy "Les modérateurs traitent les idées et bugs"
  on public.feedback for update
  to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

revoke all on public.feedback from anon, authenticated;
grant insert (kind, message, author_name, context) on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;

-- Anti-abus : 10 messages par jour pour un joueur connecté ; pour les visiteurs (anonymes),
-- 30 messages par heure au total.
create function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author_id is null then
    if (
      select count(*) from public.feedback f
      where f.author_id is null and f.created_at > now() - interval '1 hour'
    ) >= 30 then
      raise exception 'Trop de messages pour le moment';
    end if;
  elsif (
    select count(*) from public.feedback f
    where f.author_id = new.author_id and f.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'Trop de messages aujourd''hui';
  end if;
  return new;
end;
$$;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
