-- Lot B2 : rôles visibles dans le jeu (DEC-027).
-- - Statut doré (« Le Décodeur en chef », pour Renaud) : pseudo doré et titre sous le pseudo.
-- - Modérateurs : petit badge 🛡️ à côté du pseudo.
-- Seul le responsable du site donne ou retire ces rôles, depuis le jeu (fonctions ci-dessous) ;
-- la base vérifie elle-même qui appelle. Le responsable n'a pas de signe distinctif.
-- Tests : tests/database.test.ts (PGlite).

create table public.gold_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.gold_members is 'Comptes au statut doré (pseudo doré et titre dans le jeu).';

-- Aucune règle : personne ne lit ni n'écrit cette table directement par l'API.
alter table public.gold_members enable row level security;
revoke all on public.gold_members from anon, authenticated;

-- Rôle affiché d'un compte : 'gold', 'mod' ou null. Information publique (visible de tous dans
-- le jeu) : le serveur temps réel la demande sans jeton. Le responsable n'est jamais affiché
-- comme modérateur, même s'il en fait partie.
create function public.account_role(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.gold_members g where g.user_id = p_user) then 'gold'
    when exists (select 1 from public.moderators m where m.user_id = p_user)
      and not exists (select 1 from public.site_owners o where o.user_id = p_user) then 'mod'
  end;
$$;

revoke execute on function public.account_role(uuid) from public;
grant execute on function public.account_role(uuid) to anon, authenticated;

-- Profil et rôle du joueur connecté, pour le serveur temps réel (qui ajoute le rôle à ses
-- messages). Nouvelle fonction plutôt que de modifier my_profile : l'ancien serveur continue de
-- fonctionner pendant la mise en ligne.
create function public.my_account()
returns table (id uuid, name text, role text)
language sql
stable
set search_path = ''
as $$
  select p.id, p.name, public.account_role(p.id)
  from public.profiles p
  where p.id = (select auth.uid());
$$;

grant execute on function public.my_account() to anon, authenticated;

-- Le responsable nomme ou retire un modérateur (le compte doit avoir un profil).
create function public.set_moderator(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_site_owner() then
    raise exception 'Réservé au responsable du site';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'Compte inconnu';
  end if;
  if p_on then
    insert into public.moderators (user_id) values (p_user) on conflict do nothing;
  else
    delete from public.moderators where user_id = p_user;
  end if;
end;
$$;

revoke execute on function public.set_moderator(uuid, boolean) from public, anon;
grant execute on function public.set_moderator(uuid, boolean) to authenticated;

-- Le responsable donne ou retire le statut doré.
create function public.set_gold(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_site_owner() then
    raise exception 'Réservé au responsable du site';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'Compte inconnu';
  end if;
  if p_on then
    insert into public.gold_members (user_id) values (p_user) on conflict do nothing;
  else
    delete from public.gold_members where user_id = p_user;
  end if;
end;
$$;

revoke execute on function public.set_gold(uuid, boolean) from public, anon;
grant execute on function public.set_gold(uuid, boolean) to authenticated;
