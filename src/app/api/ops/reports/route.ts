import { RateLimiter } from "@/lib/ratelimit";
import { listAllForStaff } from "@/lib/service";
import { handle, isStaff, json, limited, withPhotos } from "@/lib/server/http";

export const runtime = "nodejs";

const guessLimit = new RateLimiter(20, 10 * 60_000);

/** Staff console feed: every report, private ones included, exact pins, signed photo URLs. */
export async function GET(req: Request) {
  if (!process.env.OPS_PASSCODE) return json({ error: "Staff console is off. Set OPS_PASSCODE on the server." }, 503);
  if (!isStaff(req)) {
    return limited(guessLimit, req, "ops") ?? json({ error: "Wrong passcode" }, 401);
  }
  return handle(async (repo) => json({ reports: await withPhotos(await listAllForStaff(repo)) }));
}
