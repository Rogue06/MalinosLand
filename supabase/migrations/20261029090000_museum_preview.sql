-- Musée des Malinos : aperçu automatique des projets (v0.4, DEC-040).
-- Quand un modérateur le demande (à la validation), le serveur temps réel prend une capture du
-- site (navigateur de Cloudflare) et la range dans son stockage gratuit ; la base note seulement
-- une « version » de l'aperçu dans `projects.thumbnail`, pour que le jeu sache qu'il existe.
-- - `set_project_preview(id, version)` : modérateurs seulement (version null : aperçu masqué).
-- - `museum_gallery(...)` : comme `museum_projects`, avec la version de l'aperçu.
-- Migration purement additive (aucune suppression : pas de confirmation demandée par Supabase).
-- Tests : tests/database.test.ts (PGlite).

create function public.set_project_preview(p_id bigint, p_preview text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Réservé aux modérateurs';
  end if;
  if p_preview is not null and p_preview !~ '^[a-z0-9]{1,16}$' then
    raise exception 'Version d''aperçu invalide';
  end if;
  update public.projects set thumbnail = p_preview where id = p_id;
  if not found then
    raise exception 'Projet introuvable';
  end if;
end;
$$;

revoke execute on function public.set_project_preview(bigint, text) from public, anon;
grant execute on function public.set_project_preview(bigint, text) to authenticated;

create function public.museum_gallery(
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
  approved_at timestamptz,
  preview text
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.title, p.summary, p.url, p.category, p.tags, p.embed,
         coalesce(pr.name, 'Malino'), p.approved_at, p.thumbnail
  from public.projects p
  left join public.profiles pr on pr.id = p.owner_id
  where p.status = 'approved' and (p_category is null or p.category = p_category)
  order by p.approved_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 20)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.museum_gallery(text, integer, integer) to anon, authenticated;
