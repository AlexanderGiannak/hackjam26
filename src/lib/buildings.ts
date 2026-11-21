/**
 * USF Tampa buildings used in dropdowns and for routing.
 * kind drives Fix-it routing: academic -> Facilities, dorm -> Housing, library -> library desk/form.
 * Coordinates are building centroids from OpenStreetMap (checked 2026-11-21), used for nearest-building
 * from photo GPS and the map. The Village is the one pin still unconfirmed (see TODO below).
 */
export type BuildingKind = "academic" | "dorm" | "library" | "student_life";

export interface Building {
  code: string;
  name: string;
  kind: BuildingKind;
  lat: number;
  lng: number;
  /** office id of the lost-and-found / service desk inside this building, if any */
  deskOfficeId?: string;
}

export const BUILDINGS: Building[] = [
  { code: "LIB", name: "Tampa Campus Library", kind: "library", lat: 28.0596, lng: -82.4122, deskOfficeId: "lib-tampa" },
  { code: "MDL", name: "Shimberg Health Sciences Library", kind: "library", lat: 28.0638, lng: -82.4251, deskOfficeId: "lib-shimberg" },
  { code: "MSC", name: "Marshall Student Center", kind: "student_life", lat: 28.0637, lng: -82.4134, deskOfficeId: "msc" },
  { code: "REC", name: "Campus Recreation Center", kind: "student_life", lat: 28.0603, lng: -82.4075 },
  { code: "BSN", name: "Muma College of Business", kind: "academic", lat: 28.0583, lng: -82.4098 },
  { code: "ENB", name: "Engineering Building II", kind: "academic", lat: 28.0587, lng: -82.4153 },
  { code: "ISA", name: "Interdisciplinary Sciences", kind: "academic", lat: 28.0614, lng: -82.414 },
  { code: "CPR", name: "Cooper Hall", kind: "academic", lat: 28.0595, lng: -82.4108 },
  { code: "SOC", name: "Social Sciences", kind: "academic", lat: 28.0614, lng: -82.4097 },
  { code: "CIS", name: "Communication and Information Sciences", kind: "academic", lat: 28.0585, lng: -82.4111 },
  { code: "JPH", name: "Juniper-Poplar Hall", kind: "dorm", lat: 28.0598, lng: -82.4187 },
  // TODO(team): The Village is not mapped in OpenStreetMap; confirm this pin on the USF campus map.
  { code: "VIL", name: "The Village", kind: "dorm", lat: 28.0681, lng: -82.419 },
  { code: "HOL", name: "Holly Apartments", kind: "dorm", lat: 28.0657, lng: -82.4104 },
  { code: "AND", name: "Castor / Andros Complex", kind: "dorm", lat: 28.0639, lng: -82.4111 },
];

/** Old building names/codes that reports may still be saved under, mapped to the current name. */
const RENAMED: Record<string, string> = {
  "Communication & Media Studies": "Communication and Information Sciences",
  CMC: "Communication and Information Sciences",
};

/** Current building name for a stored value, so old reports still filter, match, and route. */
export function canonicalBuildingName<T extends string | null | undefined>(name: T): T | string {
  return name && Object.hasOwn(RENAMED, name) ? RENAMED[name] : name;
}

export function findBuilding(name: string | null | undefined): Building | undefined {
  const n = canonicalBuildingName(name);
  if (!n) return undefined;
  return BUILDINGS.find((b) => b.name === n || b.code === n);
}

/** Nearest building to a GPS point, or undefined if farther than maxMeters (i.e. probably off campus). */
export function nearestBuilding(lat: number, lng: number, maxMeters = 400): Building | undefined {
  let best: Building | undefined;
  let bestD = Infinity;
  for (const b of BUILDINGS) {
    const d = haversine(lat, lng, b.lat, b.lng);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return bestD <= maxMeters ? best : undefined;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
