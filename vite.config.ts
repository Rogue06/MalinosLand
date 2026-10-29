import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';

/**
 * Content-Security-Policy, générée au build :
 * - balise <meta> dans index.html (le serveur de dev de Vite a besoin de scripts inline : la CSP
 *   n'est donc appliquée qu'en production) ;
 * - fichier `_headers` pour l'hébergeur (format Cloudflare Pages), avec les autres en-têtes de
 *   sécurité.
 * Si VITE_REALTIME_URL (WebSocket du serveur) ou VITE_SUPABASE_URL (comptes) sont définis, leur
 * origine est ajoutée à `connect-src`, et seulement elle. Avec VITE_TURNSTILE_SITEKEY, le script
 * et le cadre de Cloudflare Turnstile (anti-robots de la boîte à idées) sont autorisés.
 * Cadres : seulement Turnstile et la visionneuse des démos du musée (`/demo/:id`, servie par le
 * serveur temps réel) ; jamais `https:` en entier (DEC-038).
 */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export function buildCsp(realtimeUrl?: string, supabaseUrl?: string, turnstile = false): string {
  const connect = ["'self'"];
  if (realtimeUrl && /^wss?:\/\//.test(realtimeUrl)) {
    // WebSocket du monde, et même hôte en HTTP(S) pour ses petites routes (historique).
    const origin = new URL(realtimeUrl).origin;
    connect.push(origin, origin.replace(/^ws/, 'http'));
  }
  if (supabaseUrl && /^https:\/\//.test(supabaseUrl)) connect.push(new URL(supabaseUrl).origin);
  // Serveur temps réel en http(s) : visionneuse des démos et images d'aperçu du musée.
  const realtimeHttp =
    realtimeUrl && /^wss?:\/\//.test(realtimeUrl)
      ? new URL(realtimeUrl).origin.replace(/^ws/, 'http')
      : null;
  const frames = [
    ...(turnstile ? [TURNSTILE_ORIGIN] : []),
    // Visionneuse des démos du musée : même hôte que le serveur temps réel.
    ...(realtimeHttp ? [realtimeHttp] : []),
  ];
  return [
    "default-src 'self'",
    turnstile ? `script-src 'self' ${TURNSTILE_ORIGIN}` : "script-src 'self'",
    ...(frames.length > 0 ? [`frame-src ${frames.join(' ')}`] : []),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${realtimeHttp ? ` ${realtimeHttp}` : ''}`,
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function securityPlugin(realtimeUrl?: string, supabaseUrl?: string, turnstile = false): Plugin {
  const csp = buildCsp(realtimeUrl, supabaseUrl, turnstile);
  return {
    name: 'malinosland-security',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: [
          '# En-têtes de sécurité (format Cloudflare Pages), générés par vite.config.ts.',
          '/*',
          '  X-Content-Type-Options: nosniff',
          '  X-Frame-Options: DENY',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
          `  Content-Security-Policy: ${csp}; frame-ancestors 'none'`,
          '',
        ].join('\n'),
      });
    },
  };
}

/**
 * Page d'accueil (racine du site) : elle vit dans un dépôt PRIVÉ (`MalinosLand-accueil`) et n'est
 * copiée ici qu'au moment de la mise en ligne, ou chez le responsable (`npm run accueil`). Sans
 * elle (dépôt public, intégration continue), la racine redirige simplement vers le jeu.
 */
function homeFallbackPlugin(): Plugin {
  return {
    name: 'malinosland-accueil-absent',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: [
          '<!doctype html>',
          '<html lang="fr">',
          '<head>',
          '<meta charset="UTF-8" />',
          '<meta http-equiv="refresh" content="0; url=./jouer/" />',
          '<link rel="icon" href="./favicon.svg" type="image/svg+xml" />',
          '<title>MalinosLand</title>',
          '</head>',
          '<body><p><a href="./jouer/">Entrer dans MalinosLand</a></p></body>',
          '</html>',
          '',
        ].join('\n'),
      });
    },
  };
}

// Import dynamique : pas besoin des types Node pour ce simple test de présence.
const fs = (await import('node:' + 'fs')) as { existsSync(path: string): boolean };
const withHome = fs.existsSync('index.html') && fs.existsSync('src/landing/main.ts');
/** Mondes de jeu (dépôt PRIVÉ MalinosLand-mondes, DEC-050) : leurs pages, s'ils sont installés. */
const mondes: Record<string, string> = fs.existsSync('chantier/index.html')
  ? { chantier: 'chantier/index.html' }
  : {};
/**
 * Pages construites : la page d'accueil (racine, légère, sans Phaser) si présente, le jeu, et le
 * prototype « Chantier des mondes » (`/chantier/`, page à part, non reliée au jeu : DEC-043).
 */
const pages: Record<string, string> = withHome
  ? { accueil: 'index.html', jouer: 'jouer/index.html', ...mondes }
  : { jouer: 'jouer/index.html', ...mondes };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: './',
    // Les mondes de jeu sont-ils construits avec le site ? (sinon, la borne du Chantier le dit)
    define: { __MONDES__: JSON.stringify(!!mondes.chantier) },
    plugins: [
      securityPlugin(env.VITE_REALTIME_URL, env.VITE_SUPABASE_URL, !!env.VITE_TURNSTILE_SITEKEY),
      ...(withHome ? [] : [homeFallbackPlugin()]),
    ],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: pages,
        output: {
          // Phaser change rarement : un chunk séparé reste en cache entre deux versions du jeu.
          manualChunks(id) {
            if (id.includes('node_modules/phaser')) return 'phaser';
            if (id.includes('node_modules/preact')) return 'preact';
            // Three.js : seulement pour le prototype du Chantier des mondes (DEC-043).
            if (id.includes('node_modules/three')) return 'three';
            return undefined;
          },
        },
      },
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
