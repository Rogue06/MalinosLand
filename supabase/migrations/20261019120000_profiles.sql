-- Comptes joueurs v0.2 : un profil public par compte (pseudo + apparence).
-- Les règles d'accès (RLS) sont vérifiées par la base : l'interface ne décide jamais seule.
-- Tests : tests/database.test.ts (PGlite, sans compte).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Même règles que sanitizeName (src/core/text.ts) : 2 à 20 caractères, sans espace autour.
  name text not null
    check (char_length(name) between 2 and 20 and name = btrim(name) and name !~ '[[:cntrl:]]'),
  -- Apparence de l'avatar (validée aussi par le jeu à la lecture) ; petite taille imposée.
  look jsonb not null default '{}'::jsonb
    check (jsonb_typeof(look) = 'object' and pg_column_size(look) <= 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil public d''un joueur : pseudo unique et apparence.';

-- Pseudo unique, sans tenir compte des majuscules.
create unique index profiles_name_key on public.profiles (lower(name));

alter table public.profiles enable row level security;

-- Pseudo et apparence sont visibles de tous dans le jeu : lecture publique.
create policy "Profils visibles par tous"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Chacun crée son propre profil"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Chacun modifie son propre profil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Pas de suppression directe : on supprime le compte entier (delete_my_account).

-- Seules ces colonnes sont modifiables par les joueurs (id et dates sont gérés par la base).
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, name, look), update (name, look) on public.profiles to authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Droit à l'effacement (RGPD) : supprime le compte de l'appelant, et son profil en cascade.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Connexion requise';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Utilisé par le serveur temps réel : avec le jeton de connexion du joueur, renvoie son profil
-- (ou rien pour un visiteur). La base vérifie elle-même le jeton : le serveur n'a aucun secret.
create function public.my_profile()
returns table (id uuid, name text)
language sql
stable
set search_path = ''
as $$
  select p.id, p.name from public.profiles p where p.id = (select auth.uid());
$$;

grant execute on function public.my_profile() to anon, authenticated;
