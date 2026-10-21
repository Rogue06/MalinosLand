-- Décoration des logements (v0.3, lot 2) : liste des meubles posés par le propriétaire.
-- null : studio d'origine. Le jeu revérifie aussi chaque meuble (src/world/decor.ts) ; la base
-- garantit la forme des données et la liste des meubles autorisés (src/content/furniture.ts,
-- même liste : vérifié par tests/decor.test.ts). Tests : tests/database.test.ts (PGlite).

alter table public.homes add column decor jsonb;

-- Forme d'une décoration : au plus 40 meubles { t, x, y, r, v } sur le sol du studio.
create function public.valid_home_decor(d jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  e jsonb;
begin
  if jsonb_typeof(d) is distinct from 'array' or jsonb_array_length(d) > 40 then
    return false;
  end if;
  for e in select value from jsonb_array_elements(d) loop
    if jsonb_typeof(e) <> 'object' then
      return false;
    end if;
    if (select count(*) from jsonb_object_keys(e)) <> 5 then
      return false;
    end if;
    if jsonb_typeof(e -> 't') is distinct from 'string'
      or jsonb_typeof(e -> 'x') is distinct from 'number'
      or jsonb_typeof(e -> 'y') is distinct from 'number'
      or jsonb_typeof(e -> 'r') is distinct from 'number'
      or jsonb_typeof(e -> 'v') is distinct from 'number' then
      return false;
    end if;
    if not ((e ->> 't') = any (array[
      'sofa', 'armchair', 'chair', 'beanbag', 'bench',
      'desk_pc', 'coffee_table', 'round_table',
      'bed', 'bookshelf', 'mirror', 'lamp_floor',
      'plant', 'plant_big', 'flowers', 'rug', 'cat',
      'arcade', 'chess_table', 'foosball', 'telescope'
    ])) then
      return false;
    end if;
    -- Nombres entiers écrits simplement (« 3 », pas « 3.0 ») : sol du studio de 10 × 9 cases.
    if (e ->> 'x') !~ '^([1-9]|10)$'
      or (e ->> 'y') !~ '^[1-9]$'
      or (e ->> 'r') !~ '^[0-3]$'
      or (e ->> 'v') !~ '^[0-3]$' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- (Pas de « revoke » : la contrainte ci-dessous s'exécute avec les droits de celui qui écrit.)

alter table public.homes
  add constraint homes_decor_valid check (decor is null or public.valid_home_decor(decor));

-- Le propriétaire modifie aussi la décoration (la RLS limite déjà à son propre logement).
grant update (decor) on public.homes to authenticated;

-- Décoration d'un logement, pour ceux qui ont le droit d'y entrer (null sinon, ou d'origine).
create function public.home_decor(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select h.decor
  from public.homes h
  where h.owner_id = p_owner
    and public.can_enter_home(p_owner);
$$;

revoke execute on function public.home_decor(uuid) from public;
grant execute on function public.home_decor(uuid) to anon, authenticated;
