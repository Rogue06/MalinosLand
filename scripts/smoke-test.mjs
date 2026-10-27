// Test de fumée de bout en bout : crée un personnage, entre dans le monde, se
// déplace, utilise des objets, ouvre un 2e onglet, et vérifie qu'aucune erreur
// JavaScript (ni violation de CSP) ne survient.
//
// Usage : npm run build && npm run preview          (dans un autre terminal)
//         npm run test:e2e [url] [dossier-captures]
//
// Variables utiles :
//   CHROMIUM_PATH=/chemin/vers/chrome   navigateur à utiliser
//   E2E_CPU_THROTTLE=4                  simule une machine 4× plus lente (comme les serveurs de CI)
//   E2E_QUALITY=normal                  teste en qualité graphique normale (basse par défaut)
//
// Sur GitHub Actions, chaque étape et chaque erreur sont aussi écrites en
// « annotations » (visibles sur la page de la PR et lisibles via l'API).
import { chromium } from 'playwright-core';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';

// Adresse du SITE (page d'accueil) ; le jeu est dans le dossier /jouer/.
const site = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
// ?debug active l'accès de test (window.__malinosDebug), sans effet sur le jeu.
const url = `${site}jouer/?debug`;
const outDir = process.argv[3] || 'screenshots';
const executablePath =
  process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const throttle = Number(process.env.E2E_CPU_THROTTLE || 1);
const inCI = process.env.GITHUB_ACTIONS === 'true';
// Les serveurs de CI n'ont pas de carte graphique : on laisse du temps.
const TIMEOUT = 45000;
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const errors = [];
const summary = [];
const oneLine = (s) => String(s).replace(/\s+/g, ' ').slice(0, 900);
const notice = (msg) => {
  console.log(msg);
  summary.push(msg);
  if (inCI) console.log(`::notice title=e2e::${oneLine(msg)}`);
};
const fail = (msg) => {
  errors.push(msg);
  if (inCI) console.log(`::error title=e2e::${oneLine(msg)}`);
};

function finish() {
  if (inCI && process.env.GITHUB_STEP_SUMMARY) {
    const lines = ['## Test de bout en bout', '', ...summary.map((s) => `- ${s}`)];
    if (errors.length) lines.push('', '### Erreurs', '', ...errors.map((e) => `- ❌ ${e}`));
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  }
  if (errors.length > 0) {
    console.error('❌ Échec du test de fumée :\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log(`✅ Test de fumée réussi (captures dans ${outDir}/)`);
}

let browser;
try {
  browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  notice(`Navigateur : ${executablePath ?? 'par défaut'} (version ${browser.version()})`);
} catch (err) {
  fail(`Impossible de lancer le navigateur (${executablePath ?? 'par défaut'}) : ${err.message}`);
  finish();
}

const context = await browser.newContext({ viewport: { width: 1366, height: 800 } });
context.setDefaultTimeout(TIMEOUT);
// Qualité « basse » : ce test vérifie la logique et l'interface, pas les graphismes. Sur les
// serveurs de CI sans carte graphique, le rendu complet sature le processeur (≈ 3 i/s) au point
// de retarder la page. Les réglages ne sont posés qu'au premier chargement (si absents).
const lowQuality = () => {
  const key = 'malinosland:settings';
  if (localStorage.getItem(key)) return;
  const settings = {
    quality: 'low',
    fpsLimit: 30,
    reducedMotion: true,
    showNames: true,
    showStats: false,
    multiTab: true,
  };
  localStorage.setItem(key, JSON.stringify({ v: 1, data: settings }));
};
if (process.env.E2E_QUALITY !== 'normal') await context.addInitScript(lowQuality);

async function openPage(label) {
  const page = await context.newPage();
  page.on('pageerror', (e) => fail(`${label} — erreur JS : ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') fail(`${label} — console : ${m.text()}`);
  });
  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  return page;
}

const page = await openPage('onglet 1');
const dbg = (fn, arg) => page.evaluate(fn, arg);
/**
 * Attend qu'une condition évaluée dans la page devienne vraie. Le sondage est fait depuis
 * Node (et non par une minuterie de la page) : sur les serveurs de CI, Chrome peut ralentir
 * fortement les minuteries d'une page, ce qui bloquait page.waitForFunction.
 */
async function pollPage(target, fn, arg, label = 'condition') {
  const deadline = Date.now() + TIMEOUT;
  let last;
  let attempts = 0;
  let slowest = 0;
  while (Date.now() < deadline) {
    const t0 = Date.now();
    try {
      attempts++;
      const ok = await target.evaluate(fn, arg);
      slowest = Math.max(slowest, Date.now() - t0);
      if (ok) return;
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `${label} : délai de ${TIMEOUT / 1000} s dépassé après ${attempts} vérification(s), la plus lente en ${slowest} ms` +
      (last ? ` (${last.message.split('\n')[0]})` : ''),
  );
}
const waitFor = (fn, arg) => pollPage(page, fn, arg);

let current = '';
const started = Date.now();
async function step(name, fn) {
  current = name;
  const t0 = Date.now();
  await fn();
  notice(`✔ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

/**
 * Attend qu'un élément d'interface soit affiché (présent, de taille non nulle, contenant
 * éventuellement un texte). Vérification faite directement dans la page : avec Chrome 155 sur
 * les serveurs de CI très lents, l'attente de visibilité de Playwright peut ne jamais aboutir
 * alors que la fenêtre est bien affichée.
 */
function waitUi(selector, text = '', target = page) {
  return pollPage(
    target,
    ([sel, txt]) =>
      [...document.querySelectorAll(sel)].some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (!txt || el.textContent.includes(txt));
      }),
    [selector, text],
    `affichage de ${selector}${text ? ` « ${text} »` : ''}`,
  );
}

/** Attend qu'aucun élément ne corresponde au sélecteur. */
function waitGone(selector) {
  return pollPage(
    page,
    (sel) => !document.querySelector(sel),
    selector,
    `disparition de ${selector}`,
  );
}

/** Attend qu'aucune fenêtre ni dialogue ne soit ouvert (le jeu peut traiter les touches en retard). */
async function waitIdle() {
  await waitFor(() => {
    const s = window.__malinosDebug.state();
    return s.panel === null && s.dialog === null;
  });
  // Laisse passer le délai anti-rebond du clavier et quelques images.
  await page.waitForTimeout(800);
}

/** Téléporte le joueur (les longs trajets sont couverts par les tests unitaires). */
async function teleport(x, y, f = 'py') {
  await waitIdle();
  const ok = await dbg(([x, y, f]) => window.__malinosDebug.teleport(x, y, f), [x, y, f]);
  if (!ok) throw new Error(`téléportation impossible en ${x},${y}`);
  await page.waitForTimeout(300);
}

try {
  await step('site d’accueil puis entrée en visiteur', async () => {
    await page.goto(site, { waitUntil: 'networkidle' });
    // Version publique (sans le dépôt privé de la page d'accueil) : la racine mène au jeu.
    if ((await page.locator('.patch-title').count()) === 0) {
      await page.waitForURL(/\/jouer\/$/);
      notice('Page d’accueil absente (dépôt public) : la racine redirige bien vers le jeu.');
      return;
    }
    if ((await page.locator('[data-provider="google"]').count()) === 0)
      throw new Error('bouton « Continuer avec Google » absent');
    const steps = await page.locator('[data-roadmap] > li').count();
    if (steps < 5) throw new Error(`feuille de route incomplète (${steps} étapes)`);
    if ((await page.locator('canvas.sticker').count()) === 0)
      throw new Error('personnages autocollants non dessinés');
    await page.screenshot({ path: `${outDir}/00-site.png` });
    await page.locator('.lien-visiteur').click();
    await page.waitForURL(/\/jouer\/$/);
  });

  await step('chargement de l’écran d’accueil', async () => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.getByText('Entrer dans MalinosLand').waitFor();
    await page.screenshot({ path: `${outDir}/01-accueil.png` });
  });

  await step('création du personnage et entrée dans le monde', async () => {
    await page.getByPlaceholder('ex. Léa, Max_IA…').fill('Testeur');
    await page.getByText('Entrer dans MalinosLand').click();
    await page.locator('#game canvas').waitFor();
    await waitFor(() => window.__malinosDebug !== undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/02-arrivee.png` });
  });

  await step('carte d’arrivée : trois envies, puis une première réussite sans compte', async () => {
    await waitUi('.today-card', 'Qu’est-ce qui te ferait plaisir');
    await page.screenshot({ path: `${outDir}/02b-envies.png` });
    await page.locator('.today-card .intent-btn', { hasText: 'Comprendre l’IA' }).click();
    await waitUi('.modal', 'Aujourd’hui');
    await waitGone('.today-card');
    // Première idée : le défi du quiz, ouvert directement (sans marcher jusqu’à la borne).
    const first = page.locator('.modal .activity').first();
    if (!(await first.textContent()).includes('Quiz IA')) fail('le quiz devrait venir en premier');
    await first.getByRole('button', { name: 'Jouer' }).click();
    await waitUi('.modal', 'Quiz IA des Malinos');
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('déplacement au clavier', async () => {
    const before = await dbg(() => window.__malinosDebug.pos());
    await page.keyboard.down('ArrowUp');
    await waitFor((b) => {
      const p = window.__malinosDebug.pos();
      return Math.hypot(p.x - b.x, p.y - b.y) > 0.5;
    }, before);
    await page.keyboard.up('ArrowUp');
    await page.screenshot({ path: `${outDir}/03-clavier.png` });
  });

  await step('chat', async () => {
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bonjour les Malinos !');
    await page.keyboard.press('Enter');
    await waitUi('.chat-log .msg', 'Bonjour les Malinos !');
  });

  await step('marcher jusqu’à Joshua et lui parler', async () => {
    await teleport(12.5, 18.4, 'ny');
    await dbg(() => window.__malinosDebug.use('joshua'));
    await waitUi('.dialog', 'Joshua');
    await page.screenshot({ path: `${outDir}/04-joshua.png` });
    for (let i = 0; i < 10 && (await page.locator('.dialog').count()) > 0; i++) {
      await page.keyboard.press('e');
      await page.waitForTimeout(150);
    }
    if ((await page.locator('.dialog').count()) > 0) throw new Error('le dialogue ne se ferme pas');
  });

  await step('panneau de bienvenue', async () => {
    await teleport(14.5, 19.5, 'px');
    await dbg(() => window.__malinosDebug.use('welcome-board'));
    await waitUi('.modal', 'Bienvenue à MalinosLand');
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('ascenseur', async () => {
    await teleport(12.5, 10.6, 'ny');
    await dbg(() => window.__malinosDebug.use('elevator'));
    await waitUi('.modal', 'Mon logement');
    await page.screenshot({ path: `${outDir}/05-ascenseur.png` });
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('café au salon', async () => {
    await teleport(2.5, 11.6, 'ny');
    await dbg(() => window.__malinosDebug.use('coffee'));
    await waitUi('.toast', 'Tu te sers un café');
  });

  await step('s’asseoir sur le canapé', async () => {
    await teleport(2.5, 12.6, 'py');
    await dbg(() => window.__malinosDebug.useType('sofa'));
    await waitFor(() => window.__malinosDebug.seated());
    await page.screenshot({ path: `${outDir}/06-salon.png` });
  });

  await step('terrasse (zone et objectif)', async () => {
    await teleport(29.5, 7.5, 'py');
    await waitUi('.zone-chip', 'Terrasse');
    await page.screenshot({ path: `${outDir}/07-terrasse.png` });
  });

  await step('panneau « Que faire maintenant ? » et « Y aller »', async () => {
    await teleport(4.5, 15.5, 'nx');
    await page.click('button[aria-label="Aujourd’hui"]');
    await waitUi('.modal', 'Aujourd’hui');
    const count = await page.evaluate(() => document.querySelectorAll('.activity').length);
    if (count < 3) fail(`au moins 3 idées attendues, ${count} affichées`);
    await page.screenshot({ path: `${outDir}/07a-que-faire.png` });
    // Seul objectif restant à ce stade : le miroir. « Y aller » y mène et ouvre l’éditeur.
    await page
      .locator('.activity', { hasText: 'Change de style au miroir' })
      .getByRole('button')
      .click();
    await waitUi('.modal', 'Mon avatar');
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('écran « Que faire ? » à l’entrée du hall', async () => {
    await teleport(9.5, 19.5, 'px');
    await dbg(() => window.__malinosDebug.use('ecran-que-faire'));
    await waitUi('.modal', 'Aujourd’hui');
    await page.screenshot({ path: `${outDir}/07c-ecran-hall.png` });
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('Quiz IA : la borne de la salle de jeux, une partie libre au clavier', async () => {
    await teleport(37.5, 2.6, 'ny');
    await dbg(() => window.__malinosDebug.use('arcade-jeux-1'));
    await waitUi('.modal', 'Quiz IA des Malinos');
    await page.getByRole('button', { name: /Partie libre/ }).click();
    for (let i = 1; i <= 5; i++) {
      await waitUi('.quiz-progress', `Question ${i}/5`);
      await page.keyboard.press('1');
      await waitUi('.quiz-verdict');
      if (i === 1) await page.screenshot({ path: `${outDir}/07d-quiz.png` });
      await page.keyboard.press('Enter');
    }
    await waitUi('.quiz-score', '/5');
    const saved = await page.evaluate(() => localStorage.getItem('malinosland:quiz'));
    if (!saved || !saved.includes('"played":1')) fail(`score du quiz non gardé : ${saved}`);
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('Musée des Malinos : le panneau d’entrée ouvre « Exposer mon projet »', async () => {
    await teleport(14.5, 12.5, 'px');
    await dbg(() => window.__malinosDebug.use('gallery-sign'));
    await waitUi('.modal', 'Musée des Malinos');
    // Hors ligne : pas de compte possible, le panneau le dit au lieu d'afficher le formulaire.
    await waitUi('.modal', 'version en ligne');
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('Musée des Malinos : stand → fiche du projet → lien vers le site', async () => {
    // Projets d'exemple (outil de débogage, sans réseau) : les stands affichent leurs affiches.
    await dbg(() => window.__malinosDebug.museumSample());
    await teleport(20.5, 13.5, 'ny');
    await dbg(() => window.__malinosDebug.use('stand-1'));
    await waitUi('.modal', 'Malino Notes');
    await waitUi('.modal', 'Site externe');
    const link = await page.locator('.modal a', { hasText: 'Ouvrir le site' }).evaluate((a) => ({
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
    }));
    if (
      link.href !== 'https://exemple.org/notes' ||
      link.target !== '_blank' ||
      link.rel !== 'noopener noreferrer'
    )
      fail(`lien du projet inattendu : ${JSON.stringify(link)}`);
    await page.screenshot({ path: `${outDir}/07e-musee-fiche.png` });
    await page.keyboard.press('Escape');
    await waitGone('.modal');
    // Un vrai clic de souris sur l'affiche d'un autre stand ouvre aussi sa fiche (le stand reste
    // cliquable après le changement de son image).
    const spot = await dbg(() => window.__malinosDebug.screenOf('stand-4'));
    if (!spot) fail('stand-4 hors de l’écran');
    await page.mouse.click(spot.x, spot.y);
    await waitFor(() => window.__malinosDebug.state().panel === 'project');
    await page.keyboard.press('Escape');
    await waitGone('.modal');
    await dbg(() => window.__malinosDebug.use('museum-kiosk'));
    await waitUi('.modal', 'Toutes les créations');
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('jour et nuit (heure de Paris imposée)', async () => {
    const night = await page.evaluate(() => window.__malinosDebug.time(23));
    if (night?.phase !== 'nuit' || night.lights < 0.9)
      fail(`nuit attendue, reçu ${JSON.stringify(night)}`);
    await waitUi('.sky-chip', '23:00');
    await page.screenshot({ path: `${outDir}/07b-terrasse-nuit.png` });
    const day = await page.evaluate(() => window.__malinosDebug.time(13));
    if (day?.phase !== 'jour') fail(`jour attendu, reçu ${JSON.stringify(day)}`);
    await page.evaluate(() => window.__malinosDebug.time());
  });

  await step('logement : studio', async () => {
    await waitIdle();
    const home = `home-${'a'.repeat(32)}`;
    await dbg((h) => window.__malinosDebug.travel(h), home);
    await waitFor((h) => window.__malinosDebug?.room() === h, home);
    await waitFor(() => window.__malinosDebug.state().zone === 'studio');
    await waitUi('.zone-chip', 'Chez');
    await waitUi('.chat-to', 'Logement');
    await page.screenshot({ path: `${outDir}/08-studio.png` });
  });

  await step('logement : éditeur de décoration (poser, refuser, annuler)', async () => {
    const before = await dbg(() => window.__malinosDebug.decor().length);
    await dbg(() => window.__malinosDebug.decorStart());
    await page.locator('.decor-bar').waitFor();
    await page.locator('.decor-item', { hasText: 'Pouf' }).click();
    await dbg(() => window.__malinosDebug.decorTap(7, 6));
    await waitFor((n) => window.__malinosDebug.decor().length === n + 1, before);
    // Sur l'ascenseur : refusé, avec une explication.
    await page.locator('.decor-item', { hasText: 'Canapé' }).click();
    await dbg(() => window.__malinosDebug.decorTap(5, 1));
    await waitUi('.decor-msg', 'entrée');
    await page.screenshot({ path: `${outDir}/08-decoration.png` });
    await page.keyboard.press('Escape');
    await page.locator('.decor-head button', { hasText: 'Annuler' }).click();
    await waitGone('.decor-bar');
    await waitFor((n) => window.__malinosDebug.decor().length === n, before);
  });

  await step('logement : retour devant l’ascenseur du Hub', async () => {
    await dbg(() => window.__malinosDebug.travel('hub'));
    await waitFor(() => window.__malinosDebug?.room() === 'hub');
    await waitFor(() => {
      const p = window.__malinosDebug.pos();
      return Math.hypot(p.x - 11.9, p.y - 10.6) < 0.5;
    });
  });

  await step('démo multi-onglets', async () => {
    const page2 = await openPage('onglet 2');
    await page2.goto(url, { waitUntil: 'networkidle' });
    await pollPage(page2, () => window.__malinosDebug !== undefined);
    await pollPage(page2, () => window.__malinosDebug.peers() > 0);
    await waitFor(() => window.__malinosDebug.peers() > 0);
    await page.screenshot({ path: `${outDir}/08-multi-onglets.png` });
    await page2.close();
  });

  await step('téléphone : chat replié, bouton d’action, zoom à deux doigts', async () => {
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    phone.setDefaultTimeout(TIMEOUT);
    if (process.env.E2E_QUALITY !== 'normal') await phone.addInitScript(lowQuality);
    const p = await phone.newPage();
    p.on('pageerror', (e) => fail(`téléphone — erreur JS : ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error') fail(`téléphone — console : ${m.text()}`);
    });
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.getByPlaceholder('ex. Léa, Max_IA…').fill('Mobile');
    await p.getByText('Entrer dans MalinosLand').click();
    await pollPage(p, () => window.__malinosDebug !== undefined);
    // Carte d’arrivée : on peut passer. Puis le menu ☰ remplace les boutons secondaires.
    await waitUi('.today-card', 'Passer', p);
    await p.locator('.today-skip').tap();
    await pollPage(p, () => !document.querySelector('.today-card'), null, 'carte passée');
    if (await p.locator('button.menu-wide[title="Réglages"]').isVisible())
      fail('téléphone : les boutons secondaires devraient être dans le menu ☰');
    await p.locator('button[aria-label="Menu"]').tap();
    await p.locator('.menu-list button', { hasText: 'Réglages' }).tap();
    await waitUi('.modal', 'Réglages', p);
    await p.keyboard.press('Escape');
    await pollPage(p, () => !document.querySelector('.modal'), null, 'réglages fermés');
    // Chat replié au départ sur petit écran.
    await waitUi('.chat.collapsed .chat-peek', '', p);
    // Près de Joshua, le bouton d'action remplace la touche E.
    await p.evaluate(() => window.__malinosDebug.teleport(12, 15.2, 'nx'));
    await waitUi('.hint', 'Joshua', p);
    await p.locator('.hint').tap();
    await pollPage(p, () => window.__malinosDebug.state().dialog !== null, null, 'dialogue ouvert');
    await p.screenshot({ path: `${outDir}/09-telephone.png` });
    await p.keyboard.press('Escape');
    await pollPage(p, () => window.__malinosDebug.state().dialog === null, null, 'dialogue fermé');
    await p.locator('.chat-peek').tap();
    await waitUi('.chat-log', '', p);
    // Pincer : deux doigts qui s'écartent.
    const z0 = await p.evaluate(() => window.__malinosDebug.zoom());
    const cdp = await phone.newCDPSession(p);
    const fingers = (d) => [
      { x: 195 - d, y: 300, id: 1 },
      { x: 195 + d, y: 300, id: 2 },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(30) });
    for (let d = 40; d <= 120; d += 20) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(d) });
      await p.waitForTimeout(60);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pollPage(p, (z) => window.__malinosDebug.zoom() > z, z0, 'zoom à deux doigts');
    await phone.close();
  });

  await step('retour un autre jour : « Reprends ici », 3 suites au plus', async () => {
    const back = await browser.newContext({ viewport: { width: 1280, height: 760 } });
    back.setDefaultTimeout(TIMEOUT);
    if (process.env.E2E_QUALITY !== 'normal') await back.addInitScript(lowQuality);
    await back.addInitScript(() => {
      // Seulement au premier chargement : un rechargement doit garder ce que le jeu a noté.
      if (localStorage.getItem('malinosland:intent')) return;
      const put = (k, data) =>
        localStorage.setItem(`malinosland:${k}`, JSON.stringify({ v: 1, data }));
      put('profile', {
        name: 'Revenant',
        look: { body: 0, skin: 1, hair: 6, hairColor: 7, top: 2, bottom: 3, accessory: 2 },
      });
      // Envie choisie un jour précédent : la carte du retour peut s’afficher aujourd’hui.
      put('intent', { intent: 'learn', answered: true, shownDay: 1 });
    });
    const p = await back.newPage();
    p.on('pageerror', (e) => fail(`retour — erreur JS : ${e.message}`));
    await p.goto(url, { waitUntil: 'networkidle' });
    await waitUi('.today-card', 'Reprends ici', p);
    const n = await p.locator('.today-card .activity').count();
    if (n < 1 || n > 3) fail(`retour : 1 à 3 suites attendues, ${n} affichées`);
    await p.screenshot({ path: `${outDir}/02c-reprends-ici.png` });
    await p.locator('.today-card button[aria-label="Fermer"]').click();
    await pollPage(p, () => !document.querySelector('.today-card'), null, 'carte fermée');
    // Une fois par jour : rechargée, la page ne la remontre pas.
    await p.reload({ waitUntil: 'networkidle' });
    await pollPage(p, () => window.__malinosDebug !== undefined);
    await p.waitForTimeout(1500);
    if ((await p.locator('.today-card').count()) > 0) fail('retour : carte remontrée le même jour');
    await back.close();
  });

  await step(
    'Chantier des mondes : couper un arbre, fabriquer des planches, les poser',
    async () => {
      const ch = await browser.newContext({ viewport: { width: 1280, height: 760 } });
      ch.setDefaultTimeout(TIMEOUT);
      const p = await ch.newPage();
      p.on('pageerror', (e) => fail(`chantier — erreur JS : ${e.message}`));
      await p.goto(`${site}chantier/?debug&essai`, { waitUntil: 'networkidle' });
      // Le monde partagé demande un serveur : le test joue en mode d'essai hors ligne (?essai).
      await p.getByText('Essai : survie seul').click();
      await p.locator('.sandbox-canvas').waitFor();
      await pollPage(p, () => !!window.__chantier?.(), null, 'partie lancée');
      // Face au tronc le plus proche du départ, regard droit dessus.
      const ok = await p.evaluate(() => {
        const g = window.__chantier();
        const w = g.world;
        let best = null;
        const s0 = w.spawn;
        for (let y = s0.y - 30; y < s0.y + 30; y++)
          for (let x = s0.x - 30; x < s0.x + 30; x++)
            for (let z = 2; z < 46; z++)
              // Le joueur se tient sur la case x - 2 (pieds à x - 1,5) : elle doit être libre aussi.
              if (
                w.get(x, y, z) === 5 &&
                [x - 1, x - 2].every(
                  (cx) =>
                    w.get(cx, y, z) === 0 &&
                    w.get(cx, y, z + 1) === 0 &&
                    ![0, 6, 26].includes(w.get(cx, y, z - 1)),
                )
              ) {
                const d = Math.hypot(x - s0.x, y - s0.y);
                if (!best || d < best.d) best = { x, y, z, d };
              }
        if (!best) return false;
        Object.assign(g.player, { x: best.x - 1.5, y: best.y + 0.5, z: best.z, vz: 0 });
        g.yaw = 0;
        g.pitch = -0.35;
        g.mining = true;
        return true;
      });
      if (!ok) fail('chantier : aucun tronc accessible trouvé');
      await pollPage(p, () => window.__chantier().inv.count(5) > 0, null, 'tronc récolté');
      await p.evaluate(() => (window.__chantier().mining = false));
      await p.keyboard.press('KeyE');
      await waitUi('.panel', 'Ton sac', p);
      await p.locator('.recipe').first().getByRole('button', { name: 'Fabriquer' }).click();
      await pollPage(p, () => window.__chantier().inv.count(4) === 4, null, '4 planches');
      await p.screenshot({ path: `${outDir}/10-chantier-sac.png` });
      await p.keyboard.press('Escape');
      await p.evaluate(() => {
        const g = window.__chantier();
        g.inv.assign(4, 0);
        g.inv.selected = 0;
        g.pitch = -0.9;
      });
      await p.waitForTimeout(300);
      await p.evaluate(() => window.__chantier().placeOrUse());
      await pollPage(p, () => window.__chantier().inv.count(4) === 3, null, 'planche posée');
      await p.screenshot({ path: `${outDir}/10b-chantier-pose.png` });
      await ch.close();
    },
  );

  const fps = await dbg(() => window.__malinosDebug.fps());
  notice(`Images par seconde mesurées (indicatif, sans GPU) : ${fps}`);
} catch (err) {
  fail(`étape « ${current} » échouée : ${err.message.split('\n')[0]}`);
  const state = await page
    .evaluate(() => window.__malinosDebug?.state())
    .catch((e) => `indisponible (${e.message})`);
  fail(`état au moment de l’échec : ${JSON.stringify(state)}`);
  const dom = await page
    .evaluate(() => {
      const describe = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return `${sel}: absent`;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return `${sel}: ${Math.round(r.width)}×${Math.round(r.height)} display=${cs.display} visibility=${cs.visibility} opacity=${cs.opacity} animation=${cs.animationName}`;
      };
      return [
        describe('.modal-backdrop'),
        describe('.modal'),
        describe('.hud'),
        `hud: ${[...(document.querySelector('.hud')?.children ?? [])].map((c) => c.className).join(' | ')}`,
        `reduced-motion=${matchMedia('(prefers-reduced-motion: reduce)').matches}`,
        `visibilité=${document.visibilityState} focus=${document.hasFocus()}`,
        `texte de la fenêtre : « ${(document.querySelector('.modal')?.textContent ?? '').slice(0, 60)} »`,
      ].join(' ; ');
    })
    .catch((e) => `indisponible (${e.message})`);
  fail(`DOM au moment de l’échec : ${dom}`);
  await page.screenshot({ path: `${outDir}/erreur.png` }).catch(() => {});
}
notice(`Durée totale : ${((Date.now() - started) / 1000).toFixed(1)} s`);
await browser.close();
finish();
