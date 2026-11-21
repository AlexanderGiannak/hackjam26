import { RateLimiter } from "@/lib/ratelimit";
import { claimMatch } from "@/lib/service";
import { actorFrom, handle, json, limited, sameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";

const claimLimit = new RateLimiter(20, 60 * 60_000);

/** The owner of lost report [id] (x-owner-token) claims a matching found post. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused" }, 403);
  const tooMany = limited(claimLimit, req, "claim");
  if (tooMany) return tooMany;
  const { id } = await params;
  return handle(async (repo) => json(await claimMatch(repo, id, await req.json().catch(() => null), actorFrom(req))));
}
