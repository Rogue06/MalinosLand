-- Musée des Malinos : MalinosLand peut s'exposer dans son propre musée (DEC-041).
-- L'adresse exacte du jeu (https://malinosland.pages.dev/…) est acceptée comme projet ; ses
-- sous-adresses (essais de mise en ligne : xxx.malinosland.pages.dev) et Supabase restent
-- refusées. « Essayer ici » reste impossible pour ce site (refusé par le serveur : un cadre de la
-- même origine que le jeu ne serait plus isolé).
-- Remplacement de la fonction (même signature) : aucune suppression, migration additive.

create or replace function public.valid_project_url(u text)
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
    and substring(u from '^https://([^/?#]+)') !~ '\.malinosland\.pages\.dev$'
    and substring(u from '^https://([^/?#]+)') !~ '(^|\.)supabase\.(co|com|in)$';
$$;
