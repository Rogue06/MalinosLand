-- Musée des Malinos (v0.4, DEC-035) : les projets exposés par les membres.
-- - Un membre connecté propose un projet ; il part « en attente » et n'est visible de tous
--   qu'une fois validé par un modérateur. L'auteur peut le retirer à tout moment.
-- - Les droits sont vérifiés par la base (règles RLS et fonctions), jamais seulement par le jeu.
-- - Plafonds : 3 projets en attente et 10 exposés par membre, 5 propositions par jour.
-- - Signalements : table dédiée `project_reports` (un par membre et par projet).
-- Migration purement additive (aucune table existante modifiée).
-- Tests : tests/database.test.ts (PGlite).

-- Adresse acceptée : https, nom de domaine avec une extension en lettres (donc ni IP, ni port,
-- ni identifiants dans l'adresse), et jamais une adresse locale ni celle de MalinosLand.
create function public.valid_project_url(u text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select u is not null
    and char_length(u) <= 300
    and u ~ '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,63}([/?#][^[:space:][:cntrl:]]*)?$'
    and substring(u from '^https://([^/?#]+)')
      !~ '(^|\.)(localhost|local|internal|lan|home|arpa|test|example|invalid)$'
    and substring(u from '^https://([^/?#]+)') !~ '(^|\.)malinosland\.pages\.dev$'
    and substring(u from '^https://([^/?#]+)') !~ '(^|\.)supabase\.(co|com|in)$';
$$;

-- Mots-clés : 3 au plus, de 1 à 20 caractères, sans caractère de contrôle ni virgule.
create function public.valid_project_tags(t text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t is not null
    and cardinality(t) <= 3
    and coalesce(bool_and(x ~ '^[^[:cntrl:],]{1,20}$' and x = btrim(x)), true)
  from unnest(t) as x;
$$;

create table public.projects (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null
    check (char_length(title) between 2 and 60 and title = btrim(title) and title !~ '[[:cntrl:]]'),
  summary text not null
    check (char_length(summary) between 10 and 280 and summary !~ '[[:cntrl:]]'),
  url text not null check (public.valid_project_url(url)),
  category text not null
    check (category in ('site', 'application', 'outil-ia', 'jeu', 'creation', 'open-source')),
  tags text[] not null default '{}' check (public.valid_project_tags(tags)),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 140),
  -- Démo intégrable dans le jeu : décidée par un modérateur après vérification (PR 10).
  embed text not null default 'unknown' check (embed in ('unknown', 'ok', 'refused')),
  embed_checked_at timestamptz,
  -- Miniature personnalisée : prévue pour plus tard (facultative, compressée, modérée).
  -- Toujours vide en v0.4 : aucune fonction ne la remplit et les joueurs n'y ont pas accès.
  thumbnail text check (thumbnail is null or char_length(thumbnail) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

comment on table public.projects is 'Musée des Malinos : projets exposés par les membres (validés par les modérateurs).';

create index projects_approved_idx on public.projects (approved_at desc) where status = 'approved';
create index projects_owner_idx on public.projects (owner_id, created_at desc);
create index projects_pending_idx on public.projects (created_at) where status = 'pending';

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

alter table public.projects enable row level security;

-- Lecture : les projets validés pour tous ; les siens pour l'auteur ; tout pour les modérateurs.
-- (Deux règles : les visiteurs n'ont pas le droit d'appeler is_moderator.)
create policy "Projets validés visibles des visiteurs"
  on public.projects for select
  to anon
  using (status = 'approved');

create policy "Projets validés, les siens, ou tous pour les modérateurs"
  on public.projects for select
  to authenticated
  using (
    status = 'approved'
    or owner_id = (select auth.uid())
    or (select public.is_moderator())
  );

-- Proposition : en son nom, forcément « en attente », sans décision de modération.
create policy "Un membre propose un projet en son nom"
  on public.projects for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and embed = 'unknown'
    and reject_reason is null
    and approved_at is null
    and thumbnail is null
  );

-- Aucune modification ni suppression directe : tout passe par les fonctions ci-dessous.
revoke all on public.projects from anon, authenticated;
grant select on public.projects to anon, authenticated;
grant insert (title, summary, url, category, tags) on public.projects to authenticated;

-- Plafonds anti-abus.
create function public.projects_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.projects p
    where p.owner_id = new.owner_id and p.created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Trop de propositions aujourd''hui';
  end if;
  if (
    select count(*) from public.projects p
    where p.owner_id = new.owner_id and p.status = 'pending'
  ) >= 3 then
    raise exception 'Déjà 3 projets en attente de validation';
  end if;
  if (
    select count(*) from public.projects p
    where p.owner_id = new.owner_id and p.status in ('pending', 'approved')
  ) >= 10 then
    raise exception 'Déjà 10 projets exposés';
  end if;
  return new;
end;
$$;

revoke execute on function public.projects_limits() from public, anon, authenticated;

create trigger projects_limits
  before insert on public.projects
  for each row execute function public.projects_limits();

-- L'auteur corrige son projet tant qu'il est en attente.
create function public.update_my_project(
  p_id bigint,
  p_title text,
  p_summary text,
  p_url text,
  p_category text,
  p_tags text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.projects
  set title = p_title, summary = p_summary, url = p_url, category = p_category, tags = p_tags
  where id = p_id and owner_id = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'Projet introuvable, ou déjà examiné';
  end if;
end;
$$;

revoke execute on function public.update_my_project(bigint, text, text, text, text, text[])
  from public, anon;
grant execute on function public.update_my_project(bigint, text, text, text, text, text[])
  to authenticated;

-- L'auteur retire son projet quand il veut (il n'est plus visible des autres).
create function public.withdraw_my_project(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.projects
  set status = 'withdrawn'
  where id = p_id and owner_id = (select auth.uid()) and status <> 'withdrawn';
  if not found then
    raise exception 'Projet introuvable';
  end if;
end;
$$;

revoke execute on function public.withdraw_my_project(bigint) from public, anon;
grant execute on function public.withdraw_my_project(bigint) to authenticated;

-- Modération : valider, refuser (motif court) ou retirer un projet.
create function public.moderate_project(p_id bigint, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Réservé aux modérateurs';
  end if;
  if p_status not in ('approved', 'rejected', 'withdrawn') then
    raise exception 'Décision inconnue';
  end if;
  update public.projects
  set status = p_status,
      reject_reason = case when p_status = 'approved' then null else nullif(btrim(p_reason), '') end,
      approved_at = case when p_status = 'approved' then now() else approved_at end
  where id = p_id;
  if not found then
    raise exception 'Projet introuvable';
  end if;
end;
$$;

revoke execute on function public.moderate_project(bigint, text, text) from public, anon;
grant execute on function public.moderate_project(bigint, text, text) to authenticated;

-- Modération : démo intégrable ou non (après vérification technique et essai réel, PR 10).
create function public.set_project_embed(p_id bigint, p_embed text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Réservé aux modérateurs';
  end if;
  if p_embed not in ('unknown', 'ok', 'refused') then
    raise exception 'Valeur inconnue';
  end if;
  update public.projects set embed = p_embed, embed_checked_at = now() where id = p_id;
  if not found then
    raise exception 'Projet introuvable';
  end if;
end;
$$;

revoke execute on function public.set_project_embed(bigint, text) from public, anon;
grant execute on function public.set_project_embed(bigint, text) to authenticated;

-- Liste du musée : projets validés avec le pseudo de l'auteur, les plus récents d'abord,
-- par pages de 20 au plus (filtre de catégorie facultatif).
create function public.museum_projects(
  p_category text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id bigint,
  title text,
  summary text,
  url text,
  category text,
  tags text[],
  embed text,
  author text,
  approved_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.title, p.summary, p.url, p.category, p.tags, p.embed,
         coalesce(pr.name, 'Malino'), p.approved_at
  from public.projects p
  left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'approved' and (p_category is null or p.category = p_category)
  order by p.approved_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 20)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.museum_projects(text, integer, integer) to anon, authenticated;

-- Signalements de projets : un par membre et par projet, lus et traités par les modérateurs.
create table public.project_reports (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('contenu', 'arnaque', 'lien-casse', 'droits', 'autre')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'ouvert' check (status in ('ouvert', 'traite')),
  created_at timestamptz not null default now(),
  unique (project_id, reporter_id)
);

comment on table public.project_reports is 'Signalements de projets du musée, traités par les modérateurs.';

create index project_reports_open_idx on public.project_reports (status, created_at desc);

alter table public.project_reports enable row level security;

create policy "Un membre signale un projet exposé, en son nom"
  on public.project_reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'ouvert'
    and exists (
      select 1 from public.projects p where p.id = project_id and p.status = 'approved'
    )
  );

create policy "Les modérateurs lisent les signalements de projets"
  on public.project_reports for select
  to authenticated
  using ((select public.is_moderator()));

create policy "Les modérateurs traitent les signalements de projets"
  on public.project_reports for update
  to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()));

revoke all on public.project_reports from anon, authenticated;
grant insert (project_id, reason, details) on public.project_reports to authenticated;
grant select on public.project_reports to authenticated;
grant update (status) on public.project_reports to authenticated;

-- Anti-abus (10 par jour et par membre) ; un signalement fait revérifier la démo intégrée.
create function public.project_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.project_reports r
    where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'Trop de signalements aujourd''hui';
  end if;
  update public.projects set embed = 'unknown' where id = new.project_id and embed = 'ok';
  return new;
end;
$$;

revoke execute on function public.project_reports_guard() from public, anon, authenticated;

create trigger project_reports_guard
  before insert on public.project_reports
  for each row execute function public.project_reports_guard();
