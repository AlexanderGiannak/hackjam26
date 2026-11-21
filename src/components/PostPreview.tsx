import { colorHex, type ReportType } from "@/lib/types";
import { BoxIcon, ClockIcon, ImageIcon, PinIcon } from "./Icons";

/** The post card from the wireframes: photo on top, LOST/FOUND label, status pill, title and details. */
export function PostPreview({
  type,
  photoUrl,
  title,
  color,
  building,
  pickup,
  status,
  time = "Posted just now",
}: {
  type: Exclude<ReportType, "broken">;
  photoUrl?: string | null;
  title: string;
  color: string;
  building: string;
  pickup?: string | null;
  status?: string;
  time?: string;
}) {
  const lost = type === "lost";
  const hex = colorHex(color);
  const muted = "italic text-muted";
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="flex aspect-[16/9] items-center justify-center border-b border-line bg-[#e7e7e3] text-muted">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm">
            <ImageIcon />
            {lost ? "No photo yet" : "Add a photo to post"}
          </span>
        )}
      </div>
      <div className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-wider text-bull">{lost ? "LOST" : "FOUND"}</span>
          <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold">
            {status ?? (lost ? "Still looking" : "Waiting for owner")}
          </span>
        </div>
        <h3 className={`text-2xl font-bold ${title ? "" : "italic text-muted"}`}>
          {title || (lost ? "What did you lose?" : "What did you find?")}
        </h3>
        <ul className="space-y-1.5 text-[15px]">
          <li className="flex items-center gap-2">
            <span
              className={`h-5 w-5 shrink-0 rounded-full ${hex ? "border border-black/15" : "border-[1.5px] border-dashed border-muted"}`}
              style={hex ? { background: hex } : undefined}
            />
            <span className={color ? "capitalize" : muted}>{color || "Color not picked"}</span>
          </li>
          <li className="flex items-center gap-2">
            <PinIcon className="h-5 w-5 shrink-0" />
            <span className={building ? "" : muted}>
              {building ? `${lost ? "Last seen near" : "Found near"} ${building}` : "Building not picked"}
            </span>
          </li>
          {lost ? (
            <li className="flex items-center gap-2 text-muted">
              <ClockIcon className="h-5 w-5 shrink-0" />
              {time}
            </li>
          ) : (
            <li className="flex items-center gap-2">
              <BoxIcon className="h-5 w-5 shrink-0" />
              <span className={pickup ? "" : muted}>
                {pickup ? `Pick up at ${pickup}` : "Pickup spot shows after you pick a building"}
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
