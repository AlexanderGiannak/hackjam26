import { RateLimiter } from "@/lib/ratelimit";
import { createReport, listPublic } from "@/lib/service";
import { handle, json, limited, sameOrigin, withPhotos } from "@/lib/server/http";
import { db, uploadPhoto } from "@/lib/server/repo-supabase";
import { visibilityFor } from "@/lib/privacy";
import { parseNewReport } from "@/lib/validate";

export const runtime = "nodejs";

const createLimit = new RateLimiter(12, 10 * 60_000);
const MAX_PHOTO = 2_500_000;

/** Public feed. Private reports and lost-item descriptions are removed by `publicView`. */
export async function GET(req: Request) {
  return handle(async (repo) => {
    const type = new URL(req.url).searchParams.get("type");
    const t = type === "lost" || type === "found" || type === "issue" ? type : undefined;
    return json({ reports: await withPhotos(await listPublic(repo, t)) });
  });
}

/** multipart/form-data: `report` (JSON, see NewReportSchema) + up to 3 `photo` fields (JPEG, already resized and blurred). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused" }, 403);
  const tooMany = limited(createLimit, req, "create");
  if (tooMany) return tooMany;
  return handle(async (repo) => {
    const form = await req.formData().catch(() => null);
    if (!form) return json({ error: "Expected multipart form data" }, 400);
    let raw: unknown;
    try {
      raw = JSON.parse(String(form.get("report") ?? "{}"));
    } catch {
      return json({ error: "Bad report JSON" }, 400);
    }
    const input = parseNewReport(raw); // validate before touching storage
    const files = form.getAll("photo").filter((p): p is File => typeof p !== "string" && p.size > 0);
    if (files.length > 3) return json({ error: "At most 3 photos" }, 400);
    for (const f of files) {
      if (f.size > MAX_PHOTO) return json({ error: "Photo is too large" }, 413);
      if (f.type && f.type !== "image/jpeg") return json({ error: "Photo must be a JPEG" }, 415);
    }
    const isPrivate = visibilityFor(input) === "private";
    const photos: string[] = [];
    for (const f of files) photos.push(await uploadPhoto(db!, await f.arrayBuffer(), isPrivate));
    const created = await createReport(repo, input, photos);
    return json(created, 201);
  });
}
