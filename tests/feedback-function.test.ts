import { describe, expect, it, vi } from 'vitest';
import {
  handleFeedback,
  parseInput,
  parseOrigins,
  pickServiceKey,
  type FeedbackDeps,
} from '../supabase/functions/feedback/handler';

const SITE = 'https://malinosland.pages.dev';
const good = {
  kind: 'idee',
  message: 'Un coin jeux de société',
  author_name: 'Eve',
  context: { lieu: 'Hall', ecran: '390×844' },
  token: 'jeton-turnstile-valide',
};

/** Faux Cloudflare + fausse base : enregistre les appels. */
function deps(opts: { human?: boolean; db?: Response } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fake = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('siteverify'))
      return new Response(JSON.stringify({ success: opts.human ?? true }));
    return opts.db ?? new Response(null, { status: 201 });
  });
  const d: FeedbackDeps = {
    turnstileSecret: 'secret-de-test',
    supabaseUrl: 'https://projet.supabase.co',
    serviceKey: 'sb_secret_test',
    allowedOrigins: [SITE],
    fetch: fake as unknown as typeof fetch,
  };
  return { d, calls };
}

const post = (body: unknown, origin = SITE) =>
  new Request('https://projet.supabase.co/functions/v1/feedback', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('fonction Edge « feedback » (visiteurs + Turnstile)', () => {
  it('humain vérifié : le message est enregistré avec la clé serveur, sans le jeton', async () => {
    const { d, calls } = deps();
    const res = await handleFeedback(post(good), d);
    expect(res.status).toBe(201);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    const verify = calls[0]!;
    expect(verify.url).toContain('siteverify');
    const form = new URLSearchParams(String(verify.init?.body));
    expect(form.get('secret')).toBe('secret-de-test');
    expect(form.get('response')).toBe(good.token);
    expect(form.get('remoteip')).toBe('1.2.3.4');
    const insert = calls[1]!;
    expect(insert.url).toBe('https://projet.supabase.co/rest/v1/feedback');
    const headers = insert.init?.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_test');
    expect(headers.Authorization).toBeUndefined();
    const row = JSON.parse(String(insert.init?.body)) as Record<string, unknown>;
    expect(row).toEqual({
      kind: 'idee',
      message: good.message,
      author_name: 'Eve',
      context: good.context,
    });
  });

  it('robot (jeton refusé par Cloudflare) : rien n’est enregistré', async () => {
    const { d, calls } = deps({ human: false });
    const res = await handleFeedback(post(good), d);
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(1);
  });

  it('origine inconnue, mauvaise méthode, corps invalide ou trop gros : refusés', async () => {
    const { d, calls } = deps();
    expect((await handleFeedback(post(good, 'https://pirate.example'), d)).status).toBe(403);
    expect(
      (
        await handleFeedback(
          new Request('https://x.co', { method: 'GET', headers: { Origin: SITE } }),
          d,
        )
      ).status,
    ).toBe(405);
    expect((await handleFeedback(post('pas du json'), d)).status).toBe(400);
    expect((await handleFeedback(post({ ...good, kind: 'pub' }), d)).status).toBe(400);
    expect((await handleFeedback(post({ ...good, message: 'x'.repeat(5000) }), d)).status).toBe(
      413,
    );
    expect(calls).toHaveLength(0);
  });

  it('pré-vol CORS autorisé pour le site seulement', async () => {
    const { d } = deps();
    const ok = await handleFeedback(
      new Request('https://x.co', { method: 'OPTIONS', headers: { Origin: SITE } }),
      d,
    );
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(SITE);
    const ko = await handleFeedback(
      new Request('https://x.co', { method: 'OPTIONS', headers: { Origin: 'https://autre.fr' } }),
      d,
    );
    expect(ko.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('limite de la base atteinte : 429 ; secret manquant : 503', async () => {
    const limited = deps({
      db: new Response('{"message":"Trop de messages pour le moment"}', { status: 400 }),
    });
    expect((await handleFeedback(post(good), limited.d)).status).toBe(429);
    const { d } = deps();
    expect((await handleFeedback(post(good), { ...d, turnstileSecret: undefined })).status).toBe(
      503,
    );
  });

  it('validation des champs', () => {
    expect(parseInput(good)).not.toBeNull();
    expect(parseInput({ ...good, message: 'abc' })).toBeNull();
    expect(parseInput({ ...good, author_name: 'x'.repeat(41) })).toBeNull();
    expect(parseInput({ ...good, author_name: null })?.author_name).toBeNull();
    expect(parseInput({ ...good, token: '' })).toBeNull();
    expect(parseInput({ ...good, context: { 'Mauvaise clé': 'x' } })).toBeNull();
    expect(parseInput({ ...good, message: 'Bonjour\u0007 tout le monde' })?.message).toBe(
      'Bonjour tout le monde',
    );
  });

  it('configuration : origines et clé serveur', () => {
    expect(parseOrigins(undefined)).toContain(SITE);
    expect(parseOrigins('https://a.fr, javascript:alert(1)')).toEqual(['https://a.fr']);
    expect(pickServiceKey('{"default":"sb_secret_x"}', 'ancienne')).toBe('sb_secret_x');
    expect(pickServiceKey(undefined, 'ancienne')).toBe('ancienne');
    expect(pickServiceKey('pas du json', undefined)).toBeUndefined();
  });
});
