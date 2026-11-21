"use client";

import { MemoryRepo } from "./repo-memory";
import { seedReports } from "./seed";
import type { StoredReport } from "./types";

const KEY = "bullhorn.reports.v2";
const VOTES = "bullhorn.votes.v2";

/**
 * Demo-mode repo: the whole "database" lives in this browser's localStorage, seeded with a believable week.
 * It re-reads storage on every call, so two tabs on one machine see each other's reports (the match alert works).
 */
export class LocalRepo extends MemoryRepo {
  constructor() {
    super();
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.rows = raw ? (JSON.parse(raw) as StoredReport[]) : seedReports();
      this.votes = new Set(JSON.parse(localStorage.getItem(VOTES) || "[]") as string[]);
      if (!raw) this.save();
    } catch {
      this.rows = seedReports();
    }
  }

  protected save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.rows));
      localStorage.setItem(VOTES, JSON.stringify([...this.votes]));
    } catch {
      // storage full (photos are data URLs here) or blocked: keep working in memory for this tab
    }
  }

  async list() {
    this.load();
    return super.list();
  }
  async get(id: string) {
    this.load();
    return super.get(id);
  }
  async insert(r: StoredReport) {
    this.load();
    return super.insert(r);
  }
  async update(id: string, patch: Partial<StoredReport>) {
    this.load();
    return super.update(id, patch);
  }
  async incrementMeToo(id: string) {
    this.load();
    return super.incrementMeToo(id);
  }
  async vote(id: string, voter: string) {
    this.load();
    return super.vote(id, voter);
  }
}

export function resetLocalDemo() {
  try {
    for (const k of [KEY, VOTES, "bullhorn.mine.v1", "bullhorn.seen.v1"]) localStorage.removeItem(k);
  } catch {}
}
