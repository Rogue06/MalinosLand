/**
 * Bruitages d'ambiance d'une pièce (clavier du coworking, ascenseur du hall, borne d'arcade…) :
 * on ne les entend que les 10 premières secondes après être entré, pour ne pas lasser. Ils se
 * rejouent en entrant dans une autre pièce, ou en revenant dans la même après 30 secondes
 * d'absence. Revenir plus tôt reprend les secondes qui restaient, sans recommencer.
 * Logique pure et testée (tests/sound.test.ts) ; le son lui-même est dans services/audio.ts.
 */

/** Durée pendant laquelle on entend les bruitages d'une pièce. */
export const AMBIENCE_PLAY_MS = 10_000;
/** Absence minimale avant de les réentendre dans la même pièce. */
export const AMBIENCE_REPLAY_MS = 30_000;

export class AmbienceWindow<K extends string> {
  private current: K | null = null;
  private until = 0;
  /** Pour chaque pièce : fin de sa dernière fenêtre et moment où on l'a quittée. */
  private seen = new Map<K, { until: number; leftAt: number }>();

  constructor(
    private readonly playMs = AMBIENCE_PLAY_MS,
    private readonly replayMs = AMBIENCE_REPLAY_MS,
  ) {}

  /** Le joueur arrive dans un lieu (null : aucun). Renvoie jusqu'à quand jouer (0 : silence). */
  enter(kind: K | null, now: number): number {
    if (kind === this.current) return this.until;
    if (this.current) this.seen.set(this.current, { until: this.until, leftAt: now });
    this.current = kind;
    if (!kind) return (this.until = 0);
    const before = this.seen.get(kind);
    if (!before || now - before.leftAt >= this.replayMs) this.until = now + this.playMs;
    // Retour rapide : on reprend la fenêtre en cours (souvent : une porte franchie deux fois).
    else this.until = now < before.until ? before.until : 0;
    return this.until;
  }

  /**
   * Le son vient d'être autorisé par le navigateur (premier clic) : la pièce où l'on se trouve
   * n'a encore rien fait entendre, sa fenêtre commence maintenant.
   */
  restart(now: number): number {
    return (this.until = this.current ? now + this.playMs : 0);
  }

  /** Les bruitages doivent-ils jouer à cet instant ? */
  playing(now: number): boolean {
    return this.current !== null && now < this.until;
  }

  /** Fin de la fenêtre en cours (0 : silence). */
  get end(): number {
    return this.until;
  }
}
