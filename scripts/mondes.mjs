// Mondes de jeu (Chantier des mondes, puis les suivants) : ils vivent dans le dépôt PRIVÉ
// MalinosLand-mondes (DEC-050). Ce script les installe dans ce projet pour les voir, les tester ou
// les mettre en ligne. Les fichiers copiés sont ignorés par Git (.gitignore) : ils ne peuvent pas
// partir par erreur dans ce dépôt public.
//
//   npm run mondes [dossier]          copie le dépôt privé ici (par défaut ../MalinosLand-mondes)
//   npm run mondes -- --rendre [dos.] renvoie les fichiers modifiés ici vers le dépôt privé
//   node scripts/mondes.mjs --si-absent   sans dépôt privé : pose un serveur « en attente »
//                                       (lancé tout seul après npm install)
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Ce que contient le dépôt privé (mêmes chemins qu'ici). */
export const PARTS = [
  'src/sandbox',
  'chantier',
  'server/src/mondes',
  'tests/mondes',
  'scripts/mondes',
];
const STUB_MARK = 'server/src/mondes/.attente';

const args = process.argv.slice(2);
const back = args.includes('--rendre');
const ifMissing = args.includes('--si-absent');
const from = args.find((a) => !a.startsWith('--')) || join(root, '..', 'MalinosLand-mondes');
const here = (p) => join(root, p);

/**
 * Sans le dépôt privé, le serveur temps réel doit quand même se construire : sa classe
 * « ChantierRoom » est remplacée par une version en attente, qui refuse poliment les connexions.
 */
function stub() {
  if (existsSync(here('server/src/mondes/ChantierRoom.ts')) && !existsSync(here(STUB_MARK))) return; // le vrai monde est installé
  mkdirSync(here('server/src/mondes'), { recursive: true });
  writeFileSync(
    here('server/src/mondes/ChantierRoom.ts'),
    `// Fichier créé par scripts/mondes.mjs : le dépôt privé MalinosLand-mondes n'est pas installé.
import { DurableObject } from 'cloudflare:workers';

/** Monde de jeu absent : les connexions sont refusées (voir DEC-050, npm run mondes). */
export class ChantierRoom extends DurableObject {
  async fetch(): Promise<Response> {
    return new Response('Monde de jeu non installé', { status: 503 });
  }
}
`,
  );
  writeFileSync(here(STUB_MARK), 'serveur en attente du dépôt privé\n');
}

if (ifMissing) {
  stub();
  process.exit(0);
}

if (!existsSync(join(from, 'server/src/mondes/ChantierRoom.ts'))) {
  console.error(
    `Mondes de jeu introuvables dans « ${from} ».\n` +
      'Clone d’abord le dépôt privé à côté de ce projet :\n' +
      '  git clone https://github.com/Rogue06/MalinosLand-mondes.git ../MalinosLand-mondes',
  );
  process.exit(1);
}

for (const part of PARTS) {
  const [src, dst] = back ? [here(part), join(from, part)] : [join(from, part), here(part)];
  if (!existsSync(src)) continue;
  // Copie exacte : un fichier supprimé d'un côté disparaît aussi de l'autre.
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true, filter: (p) => !p.endsWith('.attente') });
  console.log(`✓ ${part}`);
}
if (!back) rmSync(here(STUB_MARK), { force: true });
console.log(
  back
    ? `Fichiers renvoyés vers ${from} : vérifie « git status » dans le dépôt privé, puis commite-les là-bas.`
    : 'Mondes de jeu installés (ignorés par Git). Relance « npm run dev » ou « npm run build ».',
);
