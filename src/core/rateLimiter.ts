/**
 * Seau à jetons : `capacity` actions possibles d'un coup, rechargées à
 * `refillPerSecond`. Sert à limiter le chat, les envois réseau, etc.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  private refill(): void {
    const t = this.now();
    const elapsed = Math.max(0, t - this.last) / 1000;
    this.last = t;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
  }

  /** Consomme un jeton si possible. */
  tryTake(cost = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  /** Secondes avant qu'un jeton soit disponible (0 si déjà possible). */
  waitTime(cost = 1): number {
    this.refill();
    if (this.tokens >= cost) return 0;
    return (cost - this.tokens) / this.refillPerSecond;
  }
}
