import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '../src/content/avatars';
import { parseHttpsUrl } from '../src/config';
import { accountPlayerId } from '../src/multiplayer/protocol';
import { reconcileProfiles } from '../src/services/account';
import { buildCsp } from '../vite.config';

const local = { name: 'Local', look: DEFAULT_APPEARANCE };
const remote = { name: 'Compte', look: DEFAULT_APPEARANCE };

describe('comptes joueurs', () => {
  it('à la connexion, le profil du compte l’emporte ; sinon on enregistre celui du navigateur', () => {
    expect(reconcileProfiles(local, remote)).toEqual({ use: remote, upload: false });
    expect(reconcileProfiles(null, remote)).toEqual({ use: remote, upload: false });
    expect(reconcileProfiles(local, null)).toEqual({ use: local, upload: true });
    expect(reconcileProfiles(null, null)).toEqual({ use: null, upload: false });
  });

  it('identifiant réseau d’un compte : UUID sans tirets, rien d’autre', () => {
    expect(accountPlayerId('0B1C2D3E-0000-4000-8000-000000000001')).toBe(
      '0b1c2d3e000040008000000000000001',
    );
    expect(accountPlayerId('pas-un-uuid')).toBeNull();
  });

  it('adresse Supabase : https uniquement', () => {
    expect(parseHttpsUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co');
    expect(parseHttpsUrl('http://abc.supabase.co')).toBeNull();
    expect(parseHttpsUrl('javascript:alert(1)')).toBeNull();
  });

  it('la CSP n’autorise que le serveur temps réel et le projet Supabase', () => {
    const csp = buildCsp('wss://rt.example.workers.dev/ws', 'https://abc.supabase.co');
    expect(csp).toContain(
      "connect-src 'self' wss://rt.example.workers.dev https://rt.example.workers.dev https://abc.supabase.co",
    );
    expect(buildCsp()).toContain("connect-src 'self';");
    expect(buildCsp()).not.toContain('challenges.cloudflare.com');
    const withCaptcha = buildCsp(undefined, 'https://abc.supabase.co', true);
    expect(withCaptcha).toContain("script-src 'self' https://challenges.cloudflare.com;");
    expect(withCaptcha).toContain('frame-src https://challenges.cloudflare.com;');
    // Cadres : Turnstile et la visionneuse des démos (serveur temps réel), jamais tout https:.
    const online = buildCsp('wss://rt.example.workers.dev/ws', 'https://abc.supabase.co', true);
    expect(online).toContain(
      'frame-src https://challenges.cloudflare.com https://rt.example.workers.dev;',
    );
    expect(online).not.toMatch(/frame-src[^;]*https:(;| )/);
    expect(buildCsp()).not.toContain('frame-src');
  });
});
