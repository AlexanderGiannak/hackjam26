"use client";

import { useEffect, useState } from "react";
import { listReports } from "@/lib/store";
import type { Report } from "@/lib/types";
import { ItemCard } from "./ItemCard";

export function RecentLost() {
  const [rows, setRows] = useState<Report[] | null>(null);
  useEffect(() => {
    listReports("lost")
      .then((r) => setRows(r.filter((x) => x.status !== "closed").slice(0, 4)))
      .catch(() => setRows([]));
  }, []);
  if (!rows) return <div className="h-40" />;
  if (rows.length === 0) return <p className="text-muted">No open lost reports right now.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {rows.map((r) => (
        <ItemCard key={r.id} report={r} action={{ label: "I found this", href: `/found?for=${r.id}` }} />
      ))}
    </div>
  );
}
