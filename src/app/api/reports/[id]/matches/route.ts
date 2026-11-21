import { matchesFor } from "@/lib/service";
import { actorFrom, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (repo) => json({ matches: await matchesFor(repo, id, actorFrom(req)) }));
}
