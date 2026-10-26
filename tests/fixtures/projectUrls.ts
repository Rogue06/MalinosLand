/**
 * Adresses de projets du musée : cas partagés par tests/museum.test.ts (le jeu) et
 * tests/database.test.ts (la base). Les deux doivent rendre le même verdict.
 */
export const URL_CASES: Array<[string, boolean]> = [
  ['https://exemple.github.io/projet?x=1#haut', true],
  ['https://mon-site.fr', true],
  ['https://a.b.c.mon-site.education/chemin/vers/page', true],
  ['http://mon-site.fr', false],
  ['https://192.168.1.10/admin', false],
  ['https://127.0.0.1', false],
  ['https://[::1]/', false],
  ['https://localhost/test', false],
  ['https://serveur.local', false],
  ['https://mon-site.fr:8443/', false],
  ['https://user:motdepasse@mon-site.fr', false],
  // MalinosLand peut s'exposer lui-même (DEC-041) ; ses sous-adresses, non.
  ['https://malinosland.pages.dev/', true],
  ['https://malinosland.pages.dev/jouer/', true],
  ['https://essai.malinosland.pages.dev', false],
  ['https://xezisaqffltiuyeblknt.supabase.co/rest/v1/', false],
  ['javascript:alert(1)', false],
  ['https://MON-SITE.fr', false],
  ['https://mon site.fr', false],
  ['https://-mon-site.fr', false],
  ['https://mon-site.fr/a b', false],
  [`https://mon-site.fr/${'a'.repeat(300)}`, false],
];
