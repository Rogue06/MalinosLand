// Installe la page d'accueil (dépôt PRIVÉ MalinosLand-accueil) dans ce projet, pour la voir en
// local ou la mettre en ligne. Les fichiers copiés sont ignorés par Git (.gitignore) : ils ne
// peuvent pas partir par erreur dans le dépôt public.
// Usage : npm run accueil [dossier]   (par défaut : ../MalinosLand-accueil)
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const from = process.argv[2] || '../MalinosLand-accueil';
const parts = ['index.html', 'src/landing', 'public/accueil'];

if (!existsSync(join(from, 'index.html'))) {
  console.error(
    `Page d'accueil introuvable dans « ${from} ».\n` +
      'Clone d’abord le dépôt privé à côté de ce projet :\n' +
      '  git clone https://github.com/Rogue06/MalinosLand-accueil.git ../MalinosLand-accueil',
  );
  process.exit(1);
}
for (const part of parts) {
  const src = join(from, part);
  if (!existsSync(src)) continue;
  cpSync(src, part, { recursive: true, force: true });
  console.log(`✓ ${part}`);
}
console.log(
  'Page d’accueil installée (ignorée par Git). Relance « npm run dev » ou « npm run build ».',
);
