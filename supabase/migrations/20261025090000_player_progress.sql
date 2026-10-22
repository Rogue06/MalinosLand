-- Progression du joueur (v0.3, lot A) : objectifs « Premiers pas » et secrets trouvés, gardés
-- sur le compte pour suivre le joueur sur tous ses appareils. Le navigateur garde aussi sa copie
-- (visiteurs) ; à la connexion, les deux sont réunies (jamais rien de perdu).
-- Tests : tests/database.test.ts (PGlite).

create table public.player_progress (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  quests text[] not null default '{}',
  secrets text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint player_progress_size check (cardinality(quests) <= 50 and cardinality(secrets) <= 100)
);

comment on table public.player_progress is 'Objectifs et secrets trouvés, par compte.';

alter table public.player_progress enable row level security;

create policy "Chacun voit sa progression"
  on public.player_progress for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Écriture seulement par les fonctions ci-dessous (qui filtrent les identifiants).
revoke all on public.player_progress from anon, authenticated;
grant select on public.player_progress to authenticated;

-- Réunit la progression envoyée par le navigateur et celle du compte, et renvoie le total.
-- Identifiants acceptés : lettres minuscules et « _ » (1 à 24 caractères) ; le reste est ignoré.
create function public.merge_my_progress(p_quests text[], p_secrets text[])
returns table (quests text[], secrets text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  q text[];
  s text[];
begin
  if uid is null then
    raise exception 'Connexion requise';
  end if;
  q := array(
    select distinct x
    from unnest(coalesce(p_quests, '{}') || coalesce((
      select pp.quests from public.player_progress pp where pp.user_id = uid
    ), '{}')) as x
    where x ~ '^[a-z_]{1,24}$'
    order by x
    limit 50
  );
  s := array(
    select distinct x
    from unnest(coalesce(p_secrets, '{}') || coalesce((
      select pp.secrets from public.player_progress pp where pp.user_id = uid
    ), '{}')) as x
    where x ~ '^[a-z_]{1,24}$'
    order by x
    limit 100
  );
  insert into public.player_progress as pp (user_id, quests, secrets, updated_at)
  values (uid, q, s, now())
  on conflict (user_id) do update
    set quests = excluded.quests, secrets = excluded.secrets, updated_at = now();
  return query select q, s;
end;
$$;

revoke execute on function public.merge_my_progress(text[], text[]) from public, anon;
grant execute on function public.merge_my_progress(text[], text[]) to authenticated;

-- « Recommencer » les objectifs (les secrets trouvés restent).
create function public.reset_my_quests()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.player_progress set quests = '{}', updated_at = now()
  where user_id = (select auth.uid());
$$;

revoke execute on function public.reset_my_quests() from public, anon;
grant execute on function public.reset_my_quests() to authenticated;
