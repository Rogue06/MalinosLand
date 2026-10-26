import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../server/src/embed';
import {
  PREVIEW_MAX_BYTES,
  isWebp,
  previewImage,
  previewRoute,
  type Capture,
  type PreviewStore,
} from '../server/src/preview';

const GAME = 'https://malinosland.pages.dev';
const WORKER = 'https://rt.example.workers.dev';
const TOKEN = 'aaaa.bbbb.cccc';

/** Petite image WebP factice (en-tête « RIFF….WEBP » suivi de données). */
const webp = (size = 64) => {
  const b = new Uint8Array(size);
  b.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  b.set(
    [...'WEBP'].map((c) => c.charCodeAt(0)),
    8,
  );
  return b;
};

function memoryStore() {
  const data = new Map<string, Uint8Array>();
  const store: PreviewStore = {
    async get(k) {
      const v = data.get(k);
      return v ? (v.slice().buffer as ArrayBuffer) : null;
    },
    async put(k, v) {
      data.set(k, new Uint8Array(v as ArrayBuffer));
    },
    async delete(k) {
      data.delete(k);
    },
  };
  return { store, data };
}

/** Fausse base : modérateur si jeton TOKEN ; projet 7 → https://projet.fr/. */
function fakeDb(opts: { moderator?: boolean; url?: string } = {}) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetcher: Fetcher = async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: url.replace('https://db.example.co/rest/v1/', ''), body });
    const auth = new Headers(init?.headers).get('Authorization');
    const mod = (opts.moderator ?? true) && auth === `Bearer ${TOKEN}`;
    if (url.endsWith('rpc/embed_check_quota')) return Response.json(mod);
    if (url.endsWith('rpc/set_project_preview'))
      return mod ? new Response(null, { status: 204 }) : Response.json({}, { status: 400 });
    if (url.includes('projects?id=eq.7'))
      return Response.json([{ url: opts.url ?? 'https://projet.fr/' }]);
    throw new Error(url);
  };
  return { fetcher, calls };
}

const env = (store?: PreviewStore) => ({
  ALLOWED_ORIGINS: GAME,
  SUPABASE_URL: 'https://db.example.co',
  SUPABASE_KEY: 'sb_publishable_test_0123456789',
  ...(store ? { PREVIEWS: store } : {}),
});
const post = (body: unknown, auth = `Bearer ${TOKEN}`) =>
  new Request(`${WORKER}/preview`, {
    method: 'POST',
    headers: { Origin: GAME, Authorization: auth },
    body: JSON.stringify(body),
  });

describe('aperçus du musée : capture par un modérateur', () => {
  it('capture rangée, version notée dans la base', async () => {
    const { store, data } = memoryStore();
    const db = fakeDb();
    const seen: string[] = [];
    const capture: Capture = async (url) => {
      seen.push(url);
      return webp(2000);
    };
    const res = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      capture,
      db.fetcher,
      () => 1234567,
    );
    expect(await res.json()).toEqual({ ok: true, preview: (1234567).toString(36), bytes: 2000 });
    expect(seen).toEqual(['https://projet.fr/']);
    expect(data.get('apercu:7')?.byteLength).toBe(2000);
    expect(db.calls.map((c) => c.url)).toEqual([
      'rpc/embed_check_quota',
      'projects?id=eq.7&select=url',
      'rpc/set_project_preview',
    ]);
    expect(db.calls[2]!.body).toEqual({ p_id: 7, p_preview: (1234567).toString(36) });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(GAME);
  });

  it('refusée sans jeton ou à un non-modérateur : rien n’est capturé ni rangé', async () => {
    const { store, data } = memoryStore();
    let captured = 0;
    const capture: Capture = async () => {
      captured++;
      return webp();
    };
    expect(
      (
        await previewRoute(
          post({ id: 7, action: 'capture' }, ''),
          env(store),
          capture,
          fakeDb().fetcher,
        )
      ).status,
    ).toBe(403);
    const res = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      capture,
      fakeDb({ moderator: false }).fetcher,
    );
    expect(res.status).toBe(403);
    expect(captured).toBe(0);
    expect(data.size).toBe(0);
  });

  it('adresse interdite, capture trop lourde ou qui n’est pas une image : refus', async () => {
    const { store, data } = memoryStore();
    const local = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      async () => webp(),
      fakeDb({ url: 'https://imprimante.local/' }).fetcher,
    );
    expect(local.status).toBe(400);
    const heavy = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      async () => webp(PREVIEW_MAX_BYTES + 1),
      fakeDb().fetcher,
    );
    expect(heavy.status).toBe(413);
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    const notImage = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      async () => html,
      fakeDb().fetcher,
    );
    expect(notImage.status).toBe(502);
    const failing = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      async () => {
        throw new Error('délai');
      },
      fakeDb().fetcher,
    );
    expect(failing.status).toBe(502);
    expect(data.size).toBe(0);
  });

  it('retrait : la base d’abord (rôle vérifié), puis le stockage', async () => {
    const { store, data } = memoryStore();
    data.set('apercu:7', webp());
    const refused = await previewRoute(
      post({ id: 7, action: 'remove' }),
      env(store),
      async () => webp(),
      fakeDb({ moderator: false }).fetcher,
    );
    expect(refused.status).toBe(502);
    expect(data.has('apercu:7')).toBe(true);
    const ok = await previewRoute(
      post({ id: 7, action: 'remove' }),
      env(store),
      async () => webp(),
      fakeDb().fetcher,
    );
    expect(await ok.json()).toEqual({ ok: true, preview: null });
    expect(data.has('apercu:7')).toBe(false);
  });

  it('sans stockage ni navigateur sur le serveur : indisponible', async () => {
    expect(
      (
        await previewRoute(
          post({ id: 7, action: 'capture' }),
          env(),
          async () => webp(),
          fakeDb().fetcher,
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await previewRoute(
          post({ id: 7, action: 'capture' }),
          env(memoryStore().store),
          null,
          fakeDb().fetcher,
        )
      ).status,
    ).toBe(503);
  });
});

describe('aperçus du musée : image publique', () => {
  it('servie en WebP, lisible par le jeu, jamais interprétée', async () => {
    const { store, data } = memoryStore();
    data.set('apercu:7', webp(300));
    const res = await previewImage(new Request(`${WORKER}/apercu/7?v=abc`), env(store));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
    expect((await res.arrayBuffer()).byteLength).toBe(300);
    expect((await previewImage(new Request(`${WORKER}/apercu/8`), env(store))).status).toBe(404);
    expect((await previewImage(new Request(`${WORKER}/apercu/abc`), env(store))).status).toBe(404);
  });

  it('reconnaît une image WebP', () => {
    expect(isWebp(webp())).toBe(true);
    expect(isWebp(new Uint8Array(4))).toBe(false);
  });
});

describe('aperçus du musée : MalinosLand lui-même (DEC-041)', () => {
  it('le jeu peut être photographié (et seulement son adresse exacte)', async () => {
    const { store, data } = memoryStore();
    const seen: Array<{ url: string; allowed: readonly string[] }> = [];
    const capture: Capture = async (url, hosts) => {
      seen.push({ url, allowed: hosts.allowed });
      return webp(500);
    };
    const res = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      capture,
      fakeDb({ url: 'https://malinosland.pages.dev/' }).fetcher,
    );
    expect(res.status).toBe(200);
    expect(seen).toEqual([
      { url: 'https://malinosland.pages.dev/', allowed: ['malinosland.pages.dev'] },
    ]);
    expect(data.has('apercu:7')).toBe(true);
    const sub = await previewRoute(
      post({ id: 7, action: 'capture' }),
      env(store),
      capture,
      fakeDb({ url: 'https://essai.malinosland.pages.dev/' }).fetcher,
    );
    expect(sub.status).toBe(400);
  });
});
