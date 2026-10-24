-- Musée des Malinos, « Essayer ici » (v0.4, PR 10, DEC-038).
-- - `embed_check_quota()` : la vérification technique d'une démo (route /embed-check du serveur
--   temps réel) est réservée aux modérateurs, au plus 20 fois par heure chacun. Le serveur n'a
--   pas de mémoire : c'est la base qui compte, avec le jeton du modérateur.
-- - `museum_demo(id, essai)` : adresse à afficher dans la visionneuse /demo/:id, seulement pour
--   un projet exposé et marqué « intégrable » (ou, pour l'essai d'un modérateur, pas encore
--   refusé). Projets exposés uniquement : rien de privé n'en sort.
-- Migration purement additive. Tests : tests/database.test.ts (PGlite).

create table public.embed_checks (
  id bigint generated always as identity primary key,
  moderator_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.embed_checks is 'Vérifications techniques de démos (plafond horaire des modérateurs).';

create index embed_checks_recent_idx on public.embed_checks (moderator_id, created_at desc);

alter table public.embed_checks enable row level security;
-- Aucune règle : personne ne lit ni n'écrit directement, seule la fonction ci-dessous y touche.
revoke all on public.embed_checks from anon, authenticated;

create function public.embed_check_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.is_moderator() then
    return false;
  end if;
  -- Ménage : on ne garde qu'un jour d'historique.
  delete from public.embed_checks where created_at < now() - interval '1 day';
  if (
    select count(*) from public.embed_checks c
    where c.moderator_id = me and c.created_at > now() - interval '1 hour'
  ) >= 20 then
    return false;
  end if;
  insert into public.embed_checks (moderator_id) values (me);
  return true;
end;
$$;

revoke execute on function public.embed_check_quota() from public, anon;
grant execute on function public.embed_check_quota() to authenticated;

create function public.museum_demo(p_id bigint, p_trial boolean default false)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.url
  from public.projects p
  where p.id = p_id
    and p.status = 'approved'
    and (p.embed = 'ok' or (coalesce(p_trial, false) and p.embed = 'unknown'));
$$;

revoke execute on function public.museum_demo(bigint, boolean) from public;
grant execute on function public.museum_demo(bigint, boolean) to anon, authenticated;
