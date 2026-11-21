import { RateLimiter } from "@/lib/ratelimit";
import { meToo } from "@/lib/service";
import { handle, json, limited, sameOrigin, voterId } from "@/lib/server/http";

export const runtime = "nodejs";

const voteLimit = new RateLimiter(30, 60 * 60_000);

/** One vote per device per issue (enforced by the me_too_votes primary key), and 30 votes an hour per network. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused" }, 403);
  const tooMany = limited(voteLimit, req, "vote");
  if (tooMany) return tooMany;
  const { id } = await params;
  return handle(async (repo) => json(await meToo(repo, id, await voterId(req))));
}
