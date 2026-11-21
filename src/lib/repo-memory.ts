import type { Repo } from "./service";
import type { StoredReport } from "./types";

/** In-memory repo. Used by tests, and as the base of the browser demo repo. */
export class MemoryRepo implements Repo {
  constructor(
    protected rows: StoredReport[] = [],
    protected votes: Set<string> = new Set(),
  ) {}

  protected save(): void {}

  async list() {
    return this.rows.map((r) => ({ ...r }));
  }
  async get(id: string) {
    const r = this.rows.find((x) => x.id === id);
    return r ? { ...r } : null;
  }
  async insert(r: StoredReport) {
    this.rows = [r, ...this.rows];
    this.save();
  }
  async update(id: string, patch: Partial<StoredReport>) {
    this.rows = this.rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    this.save();
  }
  async incrementMeToo(id: string) {
    let n = 0;
    this.rows = this.rows.map((r) => (r.id === id ? { ...r, me_too_count: (n = r.me_too_count + 1), updated_at: new Date().toISOString() } : r));
    this.save();
    return n;
  }
  async vote(id: string, voter: string) {
    const k = `${id}:${voter}`;
    if (this.votes.has(k)) return false;
    this.votes.add(k);
    this.save();
    return true;
  }
}
