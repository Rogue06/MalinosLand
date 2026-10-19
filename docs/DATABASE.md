# Base de données

> **En bref (version simple)** : sans compte, ton personnage est enregistré dans ton navigateur. Depuis la v0.2, les joueurs qui se connectent (GitHub ou Google) ont un **profil** (pseudo + apparence) dans une base de données gratuite (Supabase). Plus tard, elle gardera aussi les logements et les projets de la galerie. Les règles d’accès sont appliquées **dans la base elle-même**, pour qu’on ne puisse pas tricher.

## 1. État actuel (v0.2)

- **Supabase** (Postgres + Auth), offre gratuite, projet `malinosland` (Paris). Mode d’emploi et
  réglages : [COMPTES.md](COMPTES.md).
- Migrations SQL versionnées dans `supabase/migrations/` ; règles testées sans compte par
  `tests/database.test.ts` (PGlite).
- **En place** : table `profiles` (pseudo unique, apparence), RLS (lecture publique, écriture de
  son seul profil, colonnes modifiables limitées), `delete_my_account()` (RGPD), `my_profile()`
  (vérification des comptes par le serveur temps réel).
- **Modération** (migration `20261020090000_reports.sql`) : `moderators` (géré à la main),
  `is_moderator()`, `reports` (signalements : insertion par l’auteur connecté, 10 par jour ;
  lecture et changement de statut par les modérateurs).
- Visiteurs : profil, réglages et progression restent dans le `localStorage` (`src/services/`),
  versionnés (`{ v, data }`) et validés à la lecture.

> Le schéma ci-dessous est la **cible** des versions suivantes ; seule la table `profiles` existe
> (avec les colonnes `name`, `look`, `created_at`, `updated_at`).

## 2. Schéma envisagé

```sql
-- Profils publics (1 par compte Supabase Auth)
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null check (char_length(name) between 2 and 20),
  look        jsonb not null,           -- indices de palettes (voir src/content/avatars.ts)
  status      text not null default 'disponible',
  role        text not null default 'member' check (role in ('member','moderator','admin')),
  created_at  timestamptz not null default now()
);

-- Espaces personnels (v0.3)
create table homes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles on delete cascade,
  floor       int  not null,
  slot        int  not null,
  template    text not null,            -- gabarit de pièce
  layout      jsonb not null,           -- { v:1, items:[[type,x,y,rot,variant], …] } compact
  access      text not null default 'private' check (access in ('private','invite','public')),
  updated_at  timestamptz not null default now(),
  unique (floor, slot)
);

create table home_invites (
  home_id     uuid references homes on delete cascade,
  guest_id    uuid references profiles on delete cascade,
  expires_at  timestamptz,              -- invitations temporaires (optionnel)
  primary key (home_id, guest_id)
);

-- Galerie des Malinos (v0.4)
create table gallery_items (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles on delete cascade,
  title       text not null check (char_length(title) <= 80),
  description text check (char_length(description) <= 500),
  category    text not null,
  url         text not null check (url ~ '^https://'),
  repo_url    text check (repo_url ~ '^https://github\.com/'),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);

-- Modération
create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles on delete set null,
  target_type text not null,            -- 'profile' | 'gallery_item' | 'message'
  target_id   text not null,
  reason      text not null check (char_length(reason) <= 500),
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);

create table blocks (                   -- « masquer un utilisateur »
  user_id     uuid references profiles on delete cascade,
  blocked_id  uuid references profiles on delete cascade,
  primary key (user_id, blocked_id)
);
```

## 3. Règles d’accès (exemples RLS)

```sql
alter table homes enable row level security;

-- Lecture : propriétaire, invités valides, ou logement public.
create policy home_read on homes for select using (
  access = 'public'
  or owner_id = auth.uid()
  or exists (select 1 from home_invites i
             where i.home_id = homes.id and i.guest_id = auth.uid()
               and (i.expires_at is null or i.expires_at > now()))
);

-- Modification : propriétaire uniquement.
create policy home_write on homes for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table gallery_items enable row level security;
create policy gallery_public on gallery_items for select using (status = 'approved' or author_id = auth.uid());
create policy gallery_submit on gallery_items for insert with check (author_id = auth.uid() and status = 'pending');
```

L’entrée dans un logement en temps réel sera aussi vérifiée par le serveur temps réel (lecture de
`homes` avec les droits du joueur) : retirer une invitation coupe l’accès immédiatement.

## 4. Volumétrie (offre gratuite : 500 Mo)

- Profil ≈ 0,5 Ko → 10 000 membres ≈ 5 Mo.
- Logement : disposition compacte ≈ 1–4 Ko → 10 000 logements ≈ 40 Mo.
- Galerie : texte uniquement + miniature validée (stockage fichiers limité) ou visuel générique.
- Pas d’historique de chat complet stocké (seulement un court historique en mémoire côté serveur).

## 5. RGPD

- Données minimales : pseudo, apparence, logement, contributions. Pas de nom réel requis.
- Suppression de compte : `on delete cascade` depuis `auth.users` supprime toutes les données liées.
- ✅ Suppression de compte dans le jeu (Réglages → Compte → Supprimer mon compte).
- Données affichées aux joueurs avant connexion (`PRIVACY_NOTE`, `src/config.ts`).
- ✅ Page de politique de confidentialité : `public/confidentialite.html`
  (https://malinosland.pages.dev/confidentialite.html), liée depuis l’accueil du jeu.
- À faire : export de ses données sur demande (requête SQL documentée).
