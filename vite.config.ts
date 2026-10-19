import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';

/**
 * Content-Security-Policy, générée au build :
 * - balise <meta> dans index.html (le serveur de dev de Vite a besoin de scripts inline : la CSP
 *   n'est donc appliquée qu'en production) ;
 * - fichier `_headers` pour l'hébergeur (format Cloudflare Pages), avec les autres en-têtes de
 *   sécurité.
 * Si VITE_REALTIME_URL est défini, son origine est ajoutée à `connect-src` (WebSocket du serveur).
 */
export function buildCsp(realtimeUrl?: string): string {
  const connect = ["'self'"];
  if (realtimeUrl && /^wss?:\/\//.test(realtimeUrl)) connect.push(new URL(realtimeUrl).origin);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function securityPlugin(realtimeUrl?: string): Plugin {
  const csp = buildCsp(realtimeUrl);
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

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [securityPlugin(loadEnv(mode, '.', 'VITE_').VITE_REALTIME_URL)],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Phaser change rarement : un chunk séparé reste en cache entre deux versions du jeu.
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/preact')) return 'preact';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
