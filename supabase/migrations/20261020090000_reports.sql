-- Modération v0.2 : signalements de joueurs et modérateurs.
-- Seuls les joueurs connectés signalent ; seuls les modérateurs lisent et traitent.
-- Tests : tests/database.test.ts (PGlite, sans compte).

-- Liste des modérateurs : gérée à la main dans le SQL Editor (aucun accès par l'API).
create table public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

comment on table public.moderators is 'Modérateurs (ajout manuel, voir docs/COMPTES.md).';

alter table public.moderators enable row level security;
revoke all on public.moderators from anon, authenticated;

create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.moderators m where m.user_id = (select auth.uid()));
$$;

revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Joueur signalé : identifiant réseau, compte (s'il est connecté) et nom affiché.
  reported_player text not null check (reported_player ~ '^[a-z0-9]{8,32}$'),
  reported_account uuid references auth.users (id) on delete set null,
  reported_name text not null check (char_length(reported_name) between 1 and 40),
  reason text not null
    check (reason in ('spam', 'harcelement', 'contenu', 'usurpation', 'autre')),
  details text not null default '' check (char_length(details) <= 500),
  -- Derniers messages du joueur signalé vus par l'auteur du signalement (contexte).
  messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(messages) = 'array' and pg_column_size(messages) <= 4096),
  status text not null default 'ouvert' check (status in ('ouvert', 'traite')),
  created_at timestamptz not null default now()
);

comment on table public.reports is 'Signalements de joueurs, lus et traités par les modérateurs.';

create index reports_open_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

alter table public.reports enable row level security;

create policy "Un joueur connecté signale en son nom"
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) = reporter_id and status = 'ouvert');

create policy "Les modérateurs lisent les signalements"
  on public.reports for select
  to authenticated
  using ((select public.is_moderator()));

create policy "Les modérateurs traitent les signalements"
  on public.reports for update
  to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

revoke all on public.reports from anon, authenticated;
grant insert (reported_player, reported_account, reported_name, reason, details, messages)
  on public.reports to authenticated;
grant select on public.reports to authenticated;
grant update (status) on public.reports to authenticated;

-- Anti-abus : 10 signalements par joueur et par jour au maximum.
create function public.reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.reports r
    where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'Trop de signalements aujourd''hui';
  end if;
  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.reports_rate_limit();
