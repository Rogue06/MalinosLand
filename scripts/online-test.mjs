// Test multijoueur EN LIGNE de bout en bout : deux navigateurs indépendants (deux « joueurs »)
// se connectent au vrai serveur temps réel lancé en local, puis vérifient qu'ils se voient et se
// voient bouger, et que le chat passe.
//
// Prérequis (voir docs/TESTING.md) :
//   1. cd server && npm run dev                                   (serveur sur le port 8787)
//   2. VITE_REALTIME_URL=ws://localhost:8787/ws npm run build && npm run preview
//   3. npm run test:online
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
// Le jeu est dans le dossier /jouer/ du site.
const url = `${base}jouer/?debug`;
const executablePath =
  process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const TIMEOUT = 45000;
const errors = [];
const check = (ok, label) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`);
  if (!ok) errors.push(label);
};

async function poll(page, fn, arg) {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/** Un joueur = un contexte de navigateur séparé (pas de BroadcastChannel possible entre eux). */
async function player(name) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  await context.addInitScript((name) => {
    const put = (k, data) =>
      localStorage.setItem(`malinosland:${k}`, JSON.stringify({ v: 1, data }));
    put('profile', {
      name,
      look: {
        body: 0,
        skin: 1,
        hair: 0,
        hairColor: 0,
        top: 0,
        bottom: 0,
        accessory: 0,
        model: name === 'Bob' ? 0 : 1,
        voxelSkin: 4,
        voxelHair: 1,
        voxelTop: 4,
        voxelBottom: 3,
      },
    });
    put('settings', {
      quality: 'low',
      fpsLimit: 30,
      reducedMotion: true,
      showNames: true,
      showStats: false,
      multiTab: false,
    });
  }, name);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name} — erreur JS : ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} — console : ${m.text()}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await poll(page, () => window.__malinosDebug !== undefined);
  return page;
}

try {
  const alice = await player('Alice');
  const bob = await player('Bob');
  check(
    await poll(alice, () => window.__malinosDebug.peers() > 0),
    'Alice voit Bob (connectés au serveur)',
  );
  check(await poll(bob, () => window.__malinosDebug.peers() > 0), 'Bob voit Alice');
  check(
    await poll(bob, () =>
      window.__malinosDebug.art().peers.some((k) => k.includes('malino-v2:4:1:4:3')),
    ),
    'Bob voit le nouveau modèle d’Alice via le serveur',
  );
  check(
    await poll(alice, () => window.__malinosDebug.art().peers.some((k) => k.includes('classic:'))),
    'Alice voit le modèle classique de Bob via le serveur',
  );
  const transport = await alice.evaluate(() => document.querySelector('.chat-mode')?.textContent);
  check(transport === 'En ligne', `le jeu indique le mode « En ligne » (lu : ${transport})`);

  // Alice marche vers le hall : Bob doit voir sa position changer.
  await alice.evaluate(() => window.__malinosDebug.walkTo(12.5, 17.5));
  check(
    await poll(bob, () => {
      const peers = window.__malinosDebug.state().peersPos ?? [];
      return peers.some((p) => p.y < 20);
    }),
    'Bob voit Alice se déplacer',
  );

  await alice.keyboard.press('Enter');
  await alice.keyboard.type('Salut Bob !');
  await alice.keyboard.press('Enter');
  check(
    await poll(bob, () => document.querySelector('.chat-log')?.textContent.includes('Salut Bob !')),
    'Bob reçoit le message de chat d’Alice',
  );

  // Mention : Bob écrit « @Alice » → ligne mise en avant chez Alice.
  await bob.keyboard.press('Enter');
  await bob.keyboard.type('Coucou @Alice, tu viens ?');
  await bob.keyboard.press('Enter');
  check(
    await poll(alice, () =>
      [...document.querySelectorAll('.chat-log .msg.mention')].some((m) =>
        m.textContent.includes('@Alice'),
      ),
    ),
    'une mention @Alice est mise en avant chez Alice',
  );

  // Statut « absent » : l'onglet d'Alice est caché plus de 20 s → Bob la voit absente.
  await alice.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check(
    await poll(bob, () => (window.__malinosDebug.state().peersPos ?? []).some((p) => p.away)),
    'onglet caché depuis 20 s : les autres voient le statut « absent »',
  );
  await alice.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check(
    await poll(bob, () => (window.__malinosDebug.state().peersPos ?? []).every((p) => !p.away)),
    'retour sur l’onglet : le statut « absent » disparaît',
  );

  // Masquer : Alice masque Bob depuis la liste des joueurs ; elle ne voit plus ses messages.
  await alice.click('.presence-chip');
  await alice.getByRole('button', { name: 'Masquer', exact: true }).click();
  await alice.getByRole('button', { name: 'Signaler', exact: true }).click();
  check(
    await poll(alice, () => document.querySelector('.modal')?.textContent.includes('Connecte-toi')),
    'sans compte, le signalement demande de se connecter (masquer reste possible)',
  );
  if (process.env.SHOT_DIR)
    await alice.screenshot({ path: `${process.env.SHOT_DIR}/joueurs-masquer.png` });
  await alice.keyboard.press('Escape');
  await bob.keyboard.press('Enter');
  await bob.keyboard.type('Message masqué');
  await bob.keyboard.press('Enter');
  await bob.waitForTimeout(1500);
  check(
    !(await alice.evaluate(() =>
      document.querySelector('.chat-log')?.textContent.includes('Message masqué'),
    )),
    'Alice a masqué Bob : son message ne s’affiche pas',
  );
  await alice.click('.presence-chip');
  await alice.getByRole('button', { name: 'Afficher', exact: true }).click();
  await alice.keyboard.press('Escape');

  await bob.context().close();
  check(await poll(alice, () => window.__malinosDebug.peers() === 0), 'Alice voit Bob partir');

  // Chantier des mondes partagé : deux visiteurs se voient et se voient bouger.
  const cube = async (name) => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    await context.addInitScript((name) => {
      localStorage.setItem('malinosland:profile', JSON.stringify({ v: 1, data: { name } }));
    }, name);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${name} (chantier) — erreur JS : ${e.message}`));
    await page.goto(`${base}chantier/?debug`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Entrer dans le monde/ }).click();
    return page;
  };
  const zoe = await cube('Zoé');
  const leo = await cube('Léo');
  check(
    await poll(zoe, () => window.__chantier()?.peerNames().includes('Léo')),
    'chantier partagé : Zoé voit Léo',
  );
  check(
    await poll(leo, () => window.__chantier()?.peerNames().includes('Zoé')),
    'chantier partagé : Léo voit Zoé',
  );
  check(
    await poll(zoe, () =>
      /En ligne · 2 joueurs · sans compte/.test(
        document.querySelector('.net-pill')?.textContent ?? '',
      ),
    ),
    'chantier partagé : « En ligne · 2 joueurs · sans compte » affiché',
  );
  const start = await leo.evaluate(() => window.__chantier().peerPositions()[0]);
  await zoe.evaluate(() => {
    window.__chantier().player.x += 2;
  });
  check(
    await poll(leo, (x0) => window.__chantier().peerPositions()[0].x > x0 + 1.5, start.x),
    'chantier partagé : Léo voit Zoé se déplacer',
  );
  check(
    await zoe.evaluate(() => window.__chantier().shared.canBuild() === true),
    'chantier partagé : sans compte, on construit aussi (rien n’est gardé au départ)',
  );
  if (process.env.SHOT_DIR)
    await leo.screenshot({ path: `${process.env.SHOT_DIR}/chantier-partage.png` });
  await zoe.context().close();
  check(
    await poll(leo, () => window.__chantier().peerNames().length === 0),
    'chantier partagé : Léo voit Zoé partir',
  );
} catch (err) {
  errors.push(err.message);
}
await browser.close();

if (errors.length) {
  console.error(`❌ Test en ligne en échec :\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(
  '✅ Multijoueur en ligne : deux joueurs se voient, bougent et discutent (Hub et Chantier partagé)',
);
