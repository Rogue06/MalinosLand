# Sécurité et protection des joueurs

> **En bref (version simple)** : on protège les joueurs contre les messages piégés, le spam et les liens dangereux. En ligne, seuls le pseudo, l’apparence, la position et les messages sont transmis aux autres joueurs, sans être conservés. Pour la suite, toutes les permissions seront vérifiées par le serveur, et des outils de modération (signaler, masquer, expulser) arriveront progressivement.

## 1. Signaler une vulnérabilité

**Ne publie pas de faille dans une issue publique.** Utilise la fonction « Report a vulnerability »
(onglet _Security_ du dépôt GitHub, signalement privé) ou contacte le responsable du projet en
privé. Nous répondons dès que possible ; merci de laisser le temps de corriger avant toute
publication.

## 2. v0.1 : ce qui est en place

| Risque                     | Protection                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Injection de script (XSS)  | Aucun HTML construit à partir de données : Preact échappe le texte, Phaser dessine les textes sur canvas. `innerHTML`, `dangerouslySetInnerHTML`, `eval` **interdits par ESLint**.                                                                                                                                                                                                                                                                                                     |
| Content-Security-Policy    | Build de production : `script-src 'self'`, `object-src 'none'`, `connect-src 'self'`, `base-uri 'self'`… (balise méta injectée par Vite + `public/_headers` pour l’hébergeur, avec `frame-ancestors 'none'`). Testé : aucune violation au test de bout en bout.                                                                                                                                                                                                                        |
| Textes malveillants        | `sanitizeText` / `sanitizeName` : caractères de contrôle et d’inversion bidirectionnelle retirés, longueur bornée, pseudo limité aux lettres/chiffres/espaces/`-_.'`.                                                                                                                                                                                                                                                                                                                  |
| Messages réseau forgés     | `decodeMessage` valide chaque champ (types, bornes, listes fermées, taille). Apparence = indices de palettes fermées.                                                                                                                                                                                                                                                                                                                                                                  |
| Spam                       | Seau à jetons sur le chat ; débit de position limité.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Données locales corrompues | Stockage versionné, lecture validée, repli sur les valeurs par défaut.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Liens externes             | Uniquement le lien statique vers le dépôt, avec `rel="noopener noreferrer"`.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Secrets                    | Aucun secret nécessaire ; `.env*` ignorés par Git.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Vie privée                 | Visiteurs : pas de compte ni d’e-mail. Comptes (facultatifs) : Supabase Auth garde l’identifiant GitHub/Google et l’e-mail fourni ; la table `profiles` ne contient que pseudo et apparence ; suppression du compte dans le jeu. En ligne : pseudo, apparence, position et messages relayés en direct aux joueurs connectés, **non conservés** par le serveur. Aucun traceur, aucune police ou ressource tierce chargée. Texte affiché aux joueurs : `PRIVACY_NOTE` (`src/config.ts`). |

La démo multi-onglets ne fait **que** du `BroadcastChannel` (même origine, même navigateur).

## 3. Exigences pour les versions connectées (v0.2+)

- **Authentification** : Supabase Auth (lien magique, OAuth GitHub/Discord) ; sessions par jetons
  courts rafraîchis ; aucune clé de service dans le navigateur (seule la clé publique « anon »,
  protégée par RLS).
- **Création massive de comptes** : Cloudflare Turnstile (gratuit) + limites de débit par IP.
- **Validation côté serveur** de toute action : déplacements plausibles, accès aux salles,
  modifications de logement réservées au propriétaire. **Le client n’est jamais cru sur parole.**
- **Permissions en base** via RLS (voir [DATABASE.md](DATABASE.md)).
- **Requêtes abusives** : limites par connexion, par compte et par IP dans le Worker.
- **Liens de la galerie** : `https://` obligatoire, validation, modération avant publication,
  ouverture dans un nouvel onglet avec `noopener noreferrer`, aucun contenu tiers chargé
  automatiquement (pas d’iframe, pas d’aperçu distant).
- **Secrets** : variables d’environnement chiffrées de l’hébergeur / secrets GitHub, jamais dans le
  code. Rotation documentée. Inventaire (noms et rôles, jamais les valeurs) dans
  [REPRENDRE_LE_PROJET.md](REPRENDRE_LE_PROJET.md#inventaire-des-secrets-et-des-comptes).
- **Journalisation minimale** : erreurs et actions de modération, sans contenu de chat ni IP
  conservées au-delà du nécessaire.
- **Sauvegardes** : export régulier hors du dépôt public, procédure de restauration testée.

## 4. Modération

| Outil                                             | Version |
| ------------------------------------------------- | ------- |
| Masquer un utilisateur (côté joueur)              | ✅ 0.2  |
| Signaler un membre ou un contenu                  | ✅ 0.2  |
| Page de modération (signalements, « traité »)     | ✅ 0.2  |
| Expulser quelqu’un de son logement                | 0.3     |
| Retirer immédiatement une invitation              | 0.3     |
| Rôles modérateur / administrateur                 | 0.4     |
| Suspendre un compte, supprimer un contenu signalé | 0.4     |

- **Masquer** : liste des joueurs connectés (bouton « N Malinos » en haut) → « Masquer ». Avatar,
  messages, bulles et émotes cachés pour soi seulement (liste gardée dans le navigateur).
- **Signaler** : réservé aux joueurs connectés (anti-abus), 10 par jour au maximum (vérifié par la
  base). Le signalement contient le motif, des précisions et les 5 derniers messages du joueur vus
  par l’auteur. Table `reports` : écriture par l’auteur seulement, lecture et traitement par les
  **modérateurs** (`public.moderators`, géré à la main ; `is_moderator()`).
- **Page de modération** dans le jeu (⚙️ Réglages → 🛡️ Modération), visible des modérateurs :
  signalements, et onglet « Idées & bugs » (table `feedback`, ouverte en écriture à tous, même
  sans compte : 10 messages par jour pour un compte, 30 par heure au total pour les visiteurs).
- À venir : exclure un joueur du serveur temps réel (le code de fermeture 4004 existe déjà),
  suspendre un compte.

## 5. RGPD

Avant l’ouverture des comptes : politique de confidentialité, finalités, durée de conservation,
suppression de compte en un clic (cascade en base), export des données, consentement explicite.

## Comptes (v0.2)

- Permissions **en base** (RLS + droits par colonne), testées par `tests/database.test.ts`.
- Jeton de connexion : jamais dans une URL ; vérifié par la base pour le serveur temps réel.
- Identité garantie par le serveur : identifiant et pseudo du compte imposés, marque ✓ ajoutée
  par le serveur uniquement ; en-tête interne Worker → Durable Object toujours réécrit.
- Seule la clé **publique** Supabase est utilisée (jeu, serveur, workflows). Les clés `secret` /
  `service_role` et les « Client secret » OAuth restent dans les tableaux de bord.
