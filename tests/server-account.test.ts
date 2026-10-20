import { describe, expect, it } from 'vitest';
import {
  checkHomeAccess,
  decodeAccountHeader,
  encodeAccountHeader,
  readProtocols,
  verifyAccount,
} from '../server/src/account';

const TOKEN = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
const ROW = { id: '0b1c2d3e-0000-4000-8000-000000000001', name: 'Élodie' };
const env = { SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_KEY: 'sb_publishable_x' };

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('serveur : vérification du compte', () => {
  it('lit le jeton dans les sous-protocoles, jamais n’importe quoi', () => {
    expect(readProtocols(`malinos.v1, jwt.${TOKEN}`)).toEqual({ offered: true, token: TOKEN });
    expect(readProtocols('malinos.v1')).toEqual({ offered: true, token: null });
    expect(readProtocols(null)).toEqual({ offered: false, token: null });
    expect(readProtocols('malinos.v1, jwt.pas-un-jeton').token).toBeNull();
  });

  it('demande le profil à la base avec le jeton du joueur', async () => {
    const { fn, calls } = fakeFetch(200, [ROW]);
    expect(await verifyAccount(TOKEN, env, fn)).toEqual(ROW);
    expect(calls[0]!.url).toBe('https://exemple.supabase.co/rest/v1/rpc/my_profile');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers.apikey).toBe('sb_publishable_x');
  });

  it('visiteur si jeton refusé, profil absent, base injoignable ou comptes désactivés', async () => {
    expect(await verifyAccount(TOKEN, env, fakeFetch(401, {}).fn)).toBeNull();
    expect(await verifyAccount(TOKEN, env, fakeFetch(200, []).fn)).toBeNull();
    expect(await verifyAccount(TOKEN, env, fakeFetch(200, [{ id: 'x', name: 'A' }]).fn)).toBeNull();
    const failing = (async () => {
      throw new Error('réseau');
    }) as unknown as typeof fetch;
    expect(await verifyAccount(TOKEN, env, failing)).toBeNull();
    expect(await verifyAccount(TOKEN, {}, fakeFetch(200, [ROW]).fn)).toBeNull();
    expect(await verifyAccount(null, env, fakeFetch(200, [ROW]).fn)).toBeNull();
  });

  it('en-tête interne : aller-retour, et rejet des valeurs bricolées', () => {
    expect(decodeAccountHeader(encodeAccountHeader(ROW))).toEqual(ROW);
    expect(decodeAccountHeader('%7B%22id%22%3A1%7D')).toBeNull();
    expect(decodeAccountHeader('%%%')).toBeNull();
    expect(decodeAccountHeader(null)).toBeNull();
  });
});

describe('serveur : droit d’entrer dans un logement', () => {
  const OWNER = '0b1c2d3e-0000-4000-8000-0000000000aa';

  it('demande à la base, avec le jeton du joueur s’il en a un', async () => {
    const { fn, calls } = fakeFetch(200, true);
    expect(await checkHomeAccess(OWNER, TOKEN, env, fn)).toBe(true);
    expect(calls[0]!.url).toBe('https://exemple.supabase.co/rest/v1/rpc/can_enter_home');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ p_owner: OWNER });
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    const visitor = fakeFetch(200, true);
    await checkHomeAccess(OWNER, null, env, visitor.fn);
    expect(
      (visitor.calls[0]!.init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it('refus si la base dit non, répond mal, est injoignable ou absente', async () => {
    expect(await checkHomeAccess(OWNER, TOKEN, env, fakeFetch(200, false).fn)).toBe(false);
    expect(await checkHomeAccess(OWNER, TOKEN, env, fakeFetch(200, 'true').fn)).toBe(false);
    expect(await checkHomeAccess(OWNER, TOKEN, env, fakeFetch(500, true).fn)).toBe(false);
    const broken = (async () => {
      throw new Error('réseau');
    }) as unknown as typeof fetch;
    expect(await checkHomeAccess(OWNER, TOKEN, env, broken)).toBe(false);
    expect(await checkHomeAccess(OWNER, TOKEN, {}, fakeFetch(200, true).fn)).toBe(false);
  });
});
