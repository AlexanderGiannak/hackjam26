import { getReport } from "@/lib/service";
import { actorFrom, handle, json, withPhotos } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async (repo) => {
    const { report, owner } = await getReport(repo, id, actorFrom(req));
    const [withPhoto] = await withPhotos([report]);
    return json({ report: withPhoto, owner });
  });
}
