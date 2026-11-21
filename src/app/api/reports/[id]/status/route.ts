import { changeStatus } from "@/lib/service";
import { actorFrom, handle, json, sameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";

/** Staff (x-ops-key) can set any status. A reporter (x-owner-token) can only close or hand in their own report. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused" }, 403);
  const { id } = await params;
  return handle(async (repo) => json({ report: await changeStatus(repo, id, await req.json().catch(() => null), actorFrom(req)) }));
}
