-- Logements v0.3 (lot 1) : un studio par compte, avec un mode d'accès et des invitations.
-- L'entrée en temps réel est vérifiée par le serveur, qui appelle can_enter_home avec le jeton
-- du joueur : c'est la base qui décide (DEC-021). Tests : tests/database.test.ts (PGlite).

create table public.homes (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- private : personne d'autre ; invite : les invités ; public : tout le monde (même sans compte).
  access text not null default 'private' check (access in ('private', 'invite', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.homes is 'Logement d''un joueur (un par compte) et son mode d''accès.';

alter table public.homes enable row level security;

create policy "Chacun voit son logement"
  on public.homes for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Chacun crée son logement"
  on public.homes for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Chacun règle l'accès à son logement"
  on public.homes for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Seul le mode d'accès est modifiable (le propriétaire est fixé par la base).
revoke all on public.homes from anon, authenticated;
grant select on public.homes to authenticated;
grant insert (access), update (access) on public.homes to authenticated;

create trigger homes_touch_updated_at
  before update on public.homes
  for each row execute function public.touch_updated_at();

create table public.home_invites (
  owner_id uuid not null default auth.uid() references public.homes (owner_id) on delete cascade,
  guest_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, guest_id),
  check (owner_id <> guest_id)
);

comment on table public.home_invites is 'Invitations d''un propriétaire à entrer dans son logement.';

alter table public.home_invites enable row level security;

create policy "Propriétaire et invité voient l'invitation"
  on public.home_invites for select
  to authenticated
  using ((select auth.uid()) in (owner_id, guest_id));

create policy "Le propriétaire invite"
  on public.home_invites for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- Le propriétaire retire une invitation ; l'invité peut aussi la refuser.
create policy "Propriétaire ou invité retire l'invitation"
  on public.home_invites for delete
  to authenticated
  using ((select auth.uid()) in (owner_id, guest_id));

revoke all on public.home_invites from anon, authenticated;
grant select, delete on public.home_invites to authenticated;
grant insert (guest_id) on public.home_invites to authenticated;

-- Anti-abus : 50 invitations au plus par logement.
create function public.home_invites_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.home_invites i where i.owner_id = new.owner_id) >= 50 then
    raise exception 'Trop d''invitations pour ce logement';
  end if;
  return new;
end;
$$;

revoke execute on function public.home_invites_limit() from public, anon, authenticated;

create trigger home_invites_limit
  before insert on public.home_invites
  for each row execute function public.home_invites_limit();

-- Mon logement : le crée s'il n'existe pas encore, renvoie son mode d'accès.
create function public.my_home()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  mode text;
begin
  if uid is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.homes (owner_id) values (uid) on conflict (owner_id) do nothing;
  select h.access into mode from public.homes h where h.owner_id = uid;
  return mode;
end;
$$;

revoke execute on function public.my_home() from public, anon;
grant execute on function public.my_home() to authenticated;

-- Utilisée par le serveur temps réel, avec le jeton du joueur (ou sans, pour un visiteur) :
-- le joueur peut-il entrer dans le logement de p_owner ? Le propriétaire entre toujours chez lui.
create function public.can_enter_home(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- coalesce : un visiteur (sans compte) obtient « non » et pas « inconnu ».
  select coalesce(p_owner = (select auth.uid()), false)
    or exists (
      select 1
      from public.homes h
      where h.owner_id = p_owner
        and (
          h.access = 'public'
          or (
            h.access = 'invite'
            and exists (
              select 1
              from public.home_invites i
              where i.owner_id = p_owner and i.guest_id = (select auth.uid())
            )
          )
        )
    );
$$;

revoke execute on function public.can_enter_home(uuid) from public;
grant execute on function public.can_enter_home(uuid) to anon, authenticated;

-- Logements que l'on peut visiter : ouverts à tous, ou où l'on est invité (100 au plus).
create function public.visitable_homes()
returns table (owner_id uuid, name text, access text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.owner_id, coalesce(p.name, 'Malino'), h.access
  from public.homes h
  left join public.profiles p on p.id = h.owner_id
  where h.owner_id is distinct from (select auth.uid())
    and (
      h.access = 'public'
      or (
        h.access = 'invite'
        and exists (
          select 1
          from public.home_invites i
          where i.owner_id = h.owner_id and i.guest_id = (select auth.uid())
        )
      )
    )
  order by p.name nulls last
  limit 100;
$$;

revoke execute on function public.visitable_homes() from public;
grant execute on function public.visitable_homes() to anon, authenticated;

-- Invités de mon logement, avec leur pseudo.
create function public.my_home_invites()
returns table (guest_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.guest_id, coalesce(p.name, 'Malino')
  from public.home_invites i
  left join public.profiles p on p.id = i.guest_id
  where i.owner_id = (select auth.uid())
  order by p.name nulls last;
$$;

revoke execute on function public.my_home_invites() from public, anon;
grant execute on function public.my_home_invites() to authenticated;
