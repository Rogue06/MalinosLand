import { Store } from '../core/store';
import { sanitizeName, sanitizeText } from '../core/text';
import { storage } from './storage';

/**
 * Modération côté joueur : liste des joueurs masqués (gardée dans ce navigateur) et
 * préparation des signalements (envoyés à la base par services/account.ts).
 */

export interface HiddenPlayer {
  id: string;
  name: string;
}

const KEY = 'hidden';
const VERSION = 1;
const MAX_HIDDEN = 200;
const ID_RE = /^[a-z0-9]{8,32}$/;

export function parseHidden(raw: unknown): HiddenPlayer[] {
  if (!Array.isArray(raw)) return [];
  const out: HiddenPlayer[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const name = sanitizeName(r.name);
    if (typeof r.id === 'string' && ID_RE.test(r.id) && name && !out.some((h) => h.id === r.id))
      out.push({ id: r.id, name });
  }
  return out.slice(-MAX_HIDDEN);
}

/** Joueurs masqués : leur avatar, leurs messages et leurs bulles ne s'affichent plus. */
export const hiddenStore = new Store<HiddenPlayer[]>(storage.read(KEY, VERSION, parseHidden) ?? []);
hiddenStore.subscribe((list) => storage.write(KEY, VERSION, list));

export function isHidden(id: string): boolean {
  return hiddenStore.get().some((h) => h.id === id);
}

export function hidePlayer(id: string, name: string): void {
  if (isHidden(id)) return;
  hiddenStore.set(parseHidden([...hiddenStore.get(), { id, name }]));
}

export function unhidePlayer(id: string): void {
  hiddenStore.set(hiddenStore.get().filter((h) => h.id !== id));
}

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam ou publicité' },
  { id: 'harcelement', label: 'Insultes ou harcèlement' },
  { id: 'contenu', label: 'Contenu choquant ou inapproprié' },
  { id: 'usurpation', label: 'Se fait passer pour quelqu’un d’autre' },
  { id: 'autre', label: 'Autre' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

export const REPORT_DETAILS_MAX = 500;
const REPORT_MESSAGES_MAX = 5;

export interface ReportDraft {
  reported_player: string;
  reported_account: string | null;
  reported_name: string;
  reason: ReportReason;
  details: string;
  messages: string[];
}

/** Identifiant de compte (UUID) d'un joueur vérifié, à partir de son identifiant réseau. */
export function accountFromPlayerId(playerId: string): string | null {
  if (!/^[0-9a-f]{32}$/.test(playerId)) return null;
  const p = playerId;
  return `${p.slice(0, 8)}-${p.slice(8, 12)}-${p.slice(12, 16)}-${p.slice(16, 20)}-${p.slice(20)}`;
}

/**
 * Prépare un signalement : texte nettoyé, et les derniers messages de ce joueur vus dans le
 * chat (contexte pour les modérateurs).
 */
export function buildReport(
  player: { id: string; name: string; verified: boolean },
  reason: ReportReason,
  details: string,
  chat: { peerId?: string; text: string }[],
): ReportDraft {
  const messages = chat
    .filter((c) => c.peerId === player.id)
    .slice(-REPORT_MESSAGES_MAX)
    .map((c) => sanitizeText(c.text, 200));
  return {
    reported_player: player.id,
    reported_account: player.verified ? accountFromPlayerId(player.id) : null,
    reported_name: player.name.slice(0, 40),
    reason,
    details: sanitizeText(details, REPORT_DETAILS_MAX),
    messages,
  };
}
