import { z } from "zod";
import { myReports } from "@/lib/service";
import { handle, json, withPhotos } from "@/lib/server/http";

export const runtime = "nodejs";

const Body = z.object({ entries: z.array(z.object({ id: z.string().max(64), token: z.string().max(80) })).max(50) });

/** The reports this device created (proved by their owner tokens), with live match counts. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request" }, 400);
  return handle(async (repo) => {
    const mine = await myReports(repo, parsed.data.entries);
    const photos = await withPhotos(mine.map((m) => m.report));
    return json({ mine: mine.map((m, i) => ({ ...m, report: photos[i] })) });
  });
}
