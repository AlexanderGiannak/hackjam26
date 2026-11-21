import { RateLimiter } from "@/lib/ratelimit";
import { deskCheckIn, findByDropCode } from "@/lib/service";
import { handle, isStaff, json, limited, sameOrigin, withPhotos } from "@/lib/server/http";

export const runtime = "nodejs";

const guessLimit = new RateLimiter(20, 10 * 60_000);

function gate(req: Request): Response | null {
  if (!process.env.OPS_PASSCODE) return json({ error: "Staff console is off. Set OPS_PASSCODE on the server." }, 503);
  if (!isStaff(req)) return limited(guessLimit, req, "ops") ?? json({ error: "Wrong passcode" }, 401);
  return null;
}

/** Desk view: look up a turned-in item by the finder's drop-off code. */
export async function GET(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const code = new URL(req.url).searchParams.get("code") ?? "";
  return handle(async (repo) => {
    const hit = await findByDropCode(repo, code, { kind: "staff" });
    const [report] = await withPhotos([hit.report]);
    return json({ ...hit, report });
  });
}

/** Desk view: confirm the item is on the shelf (tag, shelf, hold date) or flag that it doesn't match. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused" }, 403);
  const blocked = gate(req);
  if (blocked) return blocked;
  const body = await req.json().catch(() => null);
  return handle(async (repo) => json({ report: await deskCheckIn(repo, String(body?.id ?? ""), body, { kind: "staff" }) }));
}
