import { nearbyIssues } from "@/lib/service";
import { handle, json } from "@/lib/server/http";
import { ISSUE_TYPES, type IssueType } from "@/lib/types";

export const runtime = "nodejs";

/** Open issues of the same type within 40 m: "someone already reported this". */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  const type = q.get("type") as IssueType;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !ISSUE_TYPES.includes(type)) return json({ error: "lat, lng and type are required" }, 400);
  return handle(async (repo) => json({ nearby: await nearbyIssues(repo, lat, lng, type) }));
}
