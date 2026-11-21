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

/** multipart/form-data: `report` (JSON, see NewReportSchema) + optional `photo` (JPEG, already resized and blurred). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused" }, 403);
  const tooMany = limited(createLimit, req, "create");
  if (tooMany) return tooMany;
  return handle(async (repo) => {
    const form = await req.formData();
    const raw = JSON.parse(String(form.get("report") ?? "{}"));
    const input = parseNewReport(raw); // validate before touching storage
    const photo = form.get("photo");
    let photo_url: string | null = null;
    if (photo instanceof Blob && photo.size > 0) {
      if (photo.size > MAX_PHOTO) return json({ error: "Photo is too large" }, 413);
      if (photo.type && photo.type !== "image/jpeg") return json({ error: "Photo must be a JPEG" }, 415);
      photo_url = await uploadPhoto(db!, await photo.arrayBuffer(), visibilityFor(input) === "private");
    }
    const created = await createReport(repo, input, photo_url);
    return json(created, 201);
  });
}
