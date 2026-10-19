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

const base = process.argv[2] || 'http://localhost:4173/';
// ?debug active l'accès de test (window.__malinosDebug), sans effet sur le jeu.
const url = base + (base.includes('?') ? '&' : '?') + 'debug';
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
if (process.env.E2E_QUALITY !== 'normal') {
  await context.addInitScript(() => {
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
  });
}

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
async function pollPage(target, fn, arg) {
  const deadline = Date.now() + TIMEOUT;
  let last;
  while (Date.now() < deadline) {
    try {
      if (await target.evaluate(fn, arg)) return;
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `délai de ${TIMEOUT / 1000} s dépassé${last ? ` (${last.message.split('\n')[0]})` : ''}`,
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
  );
}

/** Attend qu'aucun élément ne corresponde au sélecteur. */
function waitGone(selector) {
  return waitFor((sel) => !document.querySelector(sel), selector);
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

  await step('marcher jusqu’à Malo et lui parler', async () => {
    await teleport(12.5, 18.4, 'ny');
    await dbg(() => window.__malinosDebug.use('malo'));
    await waitUi('.dialog', 'Malo');
    await page.screenshot({ path: `${outDir}/04-malo.png` });
    for (let i = 0; i < 10 && (await page.locator('.dialog').count()) > 0; i++) {
      await page.keyboard.press('e');
      await page.waitForTimeout(150);
    }
    if ((await page.locator('.dialog').count()) > 0) throw new Error('le dialogue ne se ferme pas');
  });

  await step('panneau de bienvenue', async () => {
    await teleport(14.5, 17.5, 'px');
    await dbg(() => window.__malinosDebug.use('welcome-board'));
    await waitUi('.modal', 'Bienvenue à MalinosLand');
    await page.keyboard.press('Escape');
    await waitGone('.modal');
  });

  await step('ascenseur', async () => {
    await teleport(12.5, 10.6, 'ny');
    await dbg(() => window.__malinosDebug.use('elevator'));
    await waitUi('.modal', 'Choisis un étage.');
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

  await step('démo multi-onglets', async () => {
    const page2 = await openPage('onglet 2');
    await page2.goto(url, { waitUntil: 'networkidle' });
    await pollPage(page2, () => window.__malinosDebug !== undefined);
    await pollPage(page2, () => window.__malinosDebug.peers() > 0);
    await waitFor(() => window.__malinosDebug.peers() > 0);
    await page.screenshot({ path: `${outDir}/08-multi-onglets.png` });
    await page2.close();
  });

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
