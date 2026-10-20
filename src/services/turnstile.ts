/**
 * Cloudflare Turnstile (anti-robots de la boîte à idées et de la borne à bugs). Le script de
 * Cloudflare n'est chargé que lorsqu'un VISITEUR (sans compte) ouvre l'une des deux : rien pour
 * les joueurs connectés, rien hors ligne. Le jeton obtenu est vérifié par la fonction Edge
 * « feedback » (supabase/functions/feedback), qui seule connaît la clé secrète.
 */
export interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'auto' | 'light' | 'dark';
      language?: string;
      size?: 'normal' | 'flexible' | 'compact';
    },
  ): string | undefined;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile absent'));
    script.onerror = () => {
      loading = null;
      reject(new Error('Turnstile injoignable'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
