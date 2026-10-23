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
- **Idées et bugs** (migration `20261020120000_feedback.sql`) : table `feedback`, lecture et
  traitement par les modérateurs. Insertion directe par les joueurs connectés (auteur imposé par
  la base) ; les visiteurs passent par la fonction Edge `feedback`, qui vérifie Cloudflare
  Turnstile puis écrit avec la clé serveur (migration `20261021090000_feedback_turnstile.sql`).
- Visiteurs : profil, réglages et progression restent dans le `localStorage` (`src/services/`),
  versionnés (`{ v, data }`) et validés à la lecture.

- **Responsable du site** (migration `20261022120000_site_owner.sql`) : `site_owners`
  (illisible par l’API), `is_site_owner()` (accès à l’historique des connexions, DEC-022). Ajout
  à la main : `insert into public.site_owners (user_id) values ('<uuid>');`.
- **Logements** (migration `20261022090000_homes.sql`, v0.3) : `homes` (un par compte :
  `owner_id`, `access` = `private` / `invite` / `public`), `home_invites` (`owner_id`, `guest_id`,
  50 au plus par logement). Fonctions : `my_home()` (crée son logement au besoin, renvoie son
  mode d’accès), `can_enter_home(owner)` (utilisée par le serveur temps réel avec le jeton du
  joueur), `visitable_homes()` (logements ouverts ou où l’on est invité), `my_home_invites()`.
  Le propriétaire seul règle l’accès et invite ; l’invité peut refuser une invitation.
- **Progression** (migration `20261025090000_player_progress.sql`, v0.3) : `player_progress`
  (`user_id`, `quests`, `secrets` : objectifs remplis et secrets trouvés). Écriture seulement par
  `merge_my_progress(quests, secrets)` (réunit le navigateur et le compte, sans rien perdre ;
  identifiants filtrés, tailles limitées) et `reset_my_quests()` (« Recommencer »).
- **Décoration des logements** (migration `20261024090000_home_decor.sql`, v0.3) : colonne
  `homes.decor` (liste de meubles `{ t, x, y, r, v }`, null = studio d’origine), vérifiée par la
  contrainte `valid_home_decor` (40 meubles au plus, types autorisés, cases du studio). Lecture :
  `home_decor(owner)`, seulement pour ceux qui peuvent entrer. Le jeu revérifie chaque meuble
  (passages libres, entrée dégagée : `src/world/decor.ts`).
- **Rôles visibles** (migration `20261026090000_roles.sql`, v0.3) : `gold_members` (statut doré),
  `account_role(uuid)` (public : `gold`, `mod` ou rien), `my_account()` (profil et rôle pour le
  serveur temps réel), `set_gold` / `set_moderator` (responsable du site seulement).
- **Musée des Malinos** (migration `20261027090000_museum.sql`, v0.4, DEC-035) : `projects`
  (titre, résumé, adresse `https`, catégorie, 3 mots-clés, `status` = `pending` / `approved` /
  `rejected` / `withdrawn`, `embed` = démo intégrable, `thumbnail` prévu mais toujours vide).
  Tout le monde lit les projets **validés** ; l’auteur voit les siens ; les modérateurs voient
  tout. Proposition directe (en attente seulement) ; le reste passe par des fonctions :
  `update_my_project` (tant que c’est en attente), `withdraw_my_project`, `moderate_project` et
  `set_project_embed` (modérateurs), `museum_projects(catégorie, limite, décalage)` (liste
  publique, 20 par page, avec le pseudo de l’auteur). Adresses vérifiées par
  `valid_project_url` (pas d’IP, de port, d’identifiants, d’adresse locale ni de MalinosLand).
  Plafonds : 3 en attente, 10 exposés, 5 propositions par jour. `project_reports` : un
  signalement par membre et par projet (10 par jour), lu par les modérateurs ; il remet la démo
  intégrée « à vérifier ».

> Le schéma ci-dessous était la **cible** de départ : `profiles`, `reports`, `feedback`, `homes`
> et `home_invites` existent désormais (sous une forme parfois différente, voir les migrations) ;
> la galerie et les blocages côté serveur restent à faire.

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
- Musée : texte uniquement (≈ 1 Ko par projet → 1 000 projets ≈ 1 Mo) ; l’affiche est dessinée
  par le jeu. Miniature personnalisée : prévue plus tard (stockage fichiers limité).
- Pas d’historique de chat complet stocké (seulement un court historique en mémoire côté serveur).

## 5. RGPD

- Données minimales : pseudo, apparence, logement, contributions. Pas de nom réel requis.
- Suppression de compte : `on delete cascade` depuis `auth.users` supprime toutes les données liées.
- ✅ Suppression de compte dans le jeu (Réglages → Compte → Supprimer mon compte).
- Données affichées aux joueurs avant connexion (`PRIVACY_NOTE`, `src/config.ts`).
- ✅ Page de politique de confidentialité : `public/confidentialite.html`
  (https://malinosland.pages.dev/confidentialite.html), liée depuis l’accueil du jeu.
- À faire : export de ses données sur demande (requête SQL documentée).
