/**
 * Accès au stockage local du navigateur, robuste : un stockage indisponible
 * (navigation privée, quota) ou corrompu ne doit jamais empêcher de jouer.
 * Chaque valeur est versionnée pour permettre des migrations.
 */
import { LOCAL_ART_PREVIEW } from '../config';

// L'essai conserve ses propres réglages et sa progression, sans toucher au vrai profil.
const PREFIX = LOCAL_ART_PREVIEW ? 'malinosland:prototype:' : 'malinosland:';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class VersionedStorage {
  constructor(private readonly backend: KeyValueStorage | null = defaultStorage()) {}

  read<T>(key: string, version: number, parse: (raw: unknown) => T | null): T | null {
    if (!this.backend) return null;
    try {
      const raw = this.backend.getItem(PREFIX + key);
      if (!raw) return null;
      const data = JSON.parse(raw) as { v?: number; data?: unknown };
      if (data.v !== version) return null;
      return parse(data.data);
    } catch {
      return null;
    }
  }

  write(key: string, version: number, value: unknown): boolean {
    if (!this.backend) return false;
    try {
      this.backend.setItem(PREFIX + key, JSON.stringify({ v: version, data: value }));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      this.backend?.removeItem(PREFIX + key);
    } catch {
      /* ignoré */
    }
  }
}

export const storage = new VersionedStorage();
