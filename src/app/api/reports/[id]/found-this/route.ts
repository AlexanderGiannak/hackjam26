import { RateLimiter } from "@/lib/ratelimit";
import { foundThis } from "@/lib/service";
import { handle, json, limited, sameOrigin, voterId } from "@/lib/server/http";

export const runtime = "nodejs";

const limit = new RateLimiter(30, 60 * 60_000);

/** "I found this" on a lost post: one thumbs-up per device, plus optional private details for the owner. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused" }, 403);
  const tooMany = limited(limit, req, "found-this");
  if (tooMany) return tooMany;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(async (repo) => json(await foundThis(repo, id, await voterId(req), body)));
}
