/**
 * Capture d'un site par le navigateur de Cloudflare (Browser Rendering, offre gratuite :
 * 10 minutes par jour, 3 navigateurs à la fois). Utilisé par la route /preview (preview.ts).
 * Fonctionne seulement sur Cloudflare (pas dans les tests Node) : la logique autour est testée
 * à part, avec une fausse capture.
 */
import puppeteer from '@cloudflare/puppeteer';
import { demoTargetProblem } from './embed';
import { PREVIEW_SIZE, type Capture } from './preview';

/** Temps maximal de chargement de la page avant la capture. */
const LOAD_TIMEOUT_MS = 15_000;

export function browserCapture(binding: Fetcher): Capture {
  return async (url, hosts) => {
    const browser = await puppeteer.launch(binding);
    try {
      const page = await browser.newPage();
      // Page vue comme sur un ordinateur (1280 × 800), image réduite de moitié.
      await page.setViewport({ width: PREVIEW_SIZE.width * 2, height: PREVIEW_SIZE.height * 2 });
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const u = req.url();
        // Seulement des adresses https publiques (mêmes règles que la démo), et les données
        // intégrées à la page.
        if (u.startsWith('data:') || u.startsWith('blob:')) return void req.continue();
        const host = /^https:\/\/([^/?#:@]+)([/?#]|$)/.exec(u)?.[1];
        if (host && hosts.allowed.includes(host)) return void req.continue();
        if (demoTargetProblem(u, hosts.blocked)) return void req.abort();
        void req.continue();
      });
      page.on('dialog', (d) => void d.dismiss());
      // Une page un peu lente est quand même capturée telle qu'elle est.
      await page.goto(url, { waitUntil: 'networkidle2', timeout: LOAD_TIMEOUT_MS }).catch(() => {});
      await new Promise((r) => setTimeout(r, 600));
      const shot = await page.screenshot({
        type: 'webp',
        quality: 50,
        clip: {
          x: 0,
          y: 0,
          width: PREVIEW_SIZE.width * 2,
          height: PREVIEW_SIZE.height * 2,
          scale: 0.5,
        },
      });
      return new Uint8Array(shot as ArrayBuffer | Uint8Array);
    } finally {
      await browser.close();
    }
  };
}
