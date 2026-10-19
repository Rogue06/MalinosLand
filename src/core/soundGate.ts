/**
 * Décide si l'arrivée d'un message doit faire un son, sans jamais devenir agaçant :
 * - un seul son à la fois (écart minimal entre deux sons) ;
 * - un joueur qui envoie beaucoup de messages en peu de temps est rendu muet un moment ;
 * - une mention (@pseudo) a son propre son, limité par joueur.
 * Logique pure, testée dans tests/sound.test.ts.
 */
export type MessageSound = 'message' | 'mention';

export interface SoundGateOptions {
  /** Écart minimal entre deux sons de message (ms). */
  messageGapMs?: number;
  /** Écart minimal entre deux sons de mention (ms). */
  mentionGapMs?: number;
  /** Au-delà de `floodCount` messages en `floodWindowMs`, le joueur est muet `muteMs`. */
  floodCount?: number;
  floodWindowMs?: number;
  muteMs?: number;
  /** Une seule mention sonore par joueur pendant ce délai (ms). */
  mentionPerPeerMs?: number;
}

export class SoundGate {
  private lastSound = -Infinity;
  private lastMention = -Infinity;
  private readonly recent = new Map<string, number[]>();
  private readonly mutedUntil = new Map<string, number>();
  private readonly lastPeerMention = new Map<string, number>();
  private readonly o: Required<SoundGateOptions>;

  constructor(
    private readonly now: () => number = () => performance.now(),
    opts: SoundGateOptions = {},
  ) {
    this.o = {
      messageGapMs: 2500,
      mentionGapMs: 1000,
      floodCount: 4,
      floodWindowMs: 10_000,
      muteMs: 60_000,
      mentionPerPeerMs: 15_000,
      ...opts,
    };
  }

  /** À appeler pour chaque message reçu d'un autre joueur. */
  decide(peerId: string, isMention: boolean): MessageSound | null {
    const t = this.now();
    const times = (this.recent.get(peerId) ?? []).filter((x) => t - x < this.o.floodWindowMs);
    times.push(t);
    this.recent.set(peerId, times);
    if (times.length > this.o.floodCount) this.mutedUntil.set(peerId, t + this.o.muteMs);
    if ((this.mutedUntil.get(peerId) ?? -Infinity) > t) return null;

    if (
      isMention &&
      t - (this.lastPeerMention.get(peerId) ?? -Infinity) >= this.o.mentionPerPeerMs
    ) {
      if (t - this.lastMention < this.o.mentionGapMs) return null;
      this.lastPeerMention.set(peerId, t);
      this.lastMention = t;
      this.lastSound = t;
      return 'mention';
    }
    if (t - this.lastSound < this.o.messageGapMs) return null;
    this.lastSound = t;
    return 'message';
  }
}
