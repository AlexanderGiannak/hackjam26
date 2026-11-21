/**
 * Fixed-window rate limiter keyed by client. In-memory, so on serverless it limits per warm instance:
 * enough to stop a script draining the Gemini quota or flooding reports during a demo, not a real WAF.
 */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();

  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  /** true if allowed */
  take(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || now >= h.reset) {
      this.hits.set(key, { n: 1, reset: now + this.windowMs });
      if (this.hits.size > 5000) this.sweep(now);
      return true;
    }
    if (h.n >= this.limit) return false;
    h.n++;
    return true;
  }

  retryAfterSeconds(key: string, now = Date.now()): number {
    const h = this.hits.get(key);
    return h ? Math.max(1, Math.ceil((h.reset - now) / 1000)) : 0;
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (now >= v.reset) this.hits.delete(k);
  }
}
