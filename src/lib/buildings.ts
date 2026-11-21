/**
 * USF Tampa buildings used in dropdowns and for routing.
 * kind drives Fix-it routing: academic -> Facilities, dorm -> Housing, library -> library desk/form.
 * Coordinates are building centroids from OpenStreetMap (checked 2026-11-21), used for nearest-building
 * from photo GPS and the map.
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
  // Residence halls (traditional & suite-style). Centroids from OpenStreetMap, 2026-11-21.
  { code: "BEA", name: "Beacon Hall", kind: "dorm", lat: 28.0674, lng: -82.4126 },
  { code: "BET", name: "Beta Hall", kind: "dorm", lat: 28.065, lng: -82.4093 },
  { code: "CAS", name: "Castor Hall (Betty Castor Hall)", kind: "dorm", lat: 28.0639, lng: -82.4111 },
  { code: "CYP", name: "Cypress Hall", kind: "dorm", lat: 28.0661, lng: -82.4088 },
  { code: "END", name: "Endeavor Hall", kind: "dorm", lat: 28.0661, lng: -82.4115 },
  { code: "GRK", name: "Greek Village", kind: "dorm", lat: 28.0673, lng: -82.4064 },
  { code: "HOR", name: "Horizon Hall", kind: "dorm", lat: 28.0667, lng: -82.4124 },
  { code: "JUN", name: "Juniper Hall", kind: "dorm", lat: 28.0598, lng: -82.4183 },
  { code: "MAP", name: "Maple Hall", kind: "dorm", lat: 28.0652, lng: -82.4089 },
  { code: "PIN", name: "Pinnacle Hall", kind: "dorm", lat: 28.0661, lng: -82.4125 },
  { code: "POP", name: "Poplar Hall", kind: "dorm", lat: 28.0598, lng: -82.419 },
  { code: "SUM", name: "Summit Hall", kind: "dorm", lat: 28.0667, lng: -82.4113 },
  // Apartment-style housing
  { code: "HOL", name: "Holly Apartments", kind: "dorm", lat: 28.0657, lng: -82.4104 },
  { code: "KOS", name: "Kosove Hall / Kosove Apartments", kind: "dorm", lat: 28.0646, lng: -82.4114 },
];

/** Dropdown sections, in display order. */
export const BUILDING_GROUPS: { label: string; match: (b: Building) => boolean }[] = [
  { label: "Libraries", match: (b) => b.kind === "library" },
  { label: "Student life", match: (b) => b.kind === "student_life" },
  { label: "Academic buildings", match: (b) => b.kind === "academic" },
  { label: "Residence halls", match: (b) => b.kind === "dorm" && !["HOL", "KOS"].includes(b.code) },
  { label: "Apartments", match: (b) => ["HOL", "KOS"].includes(b.code) },
];

/** Old building names/codes that reports may still be saved under, mapped to the current name. */
const RENAMED: Record<string, string> = {
  "Communication & Media Studies": "Communication and Information Sciences",
  CMC: "Communication and Information Sciences",
  // housing list replaced 2026-11-21
  "Juniper-Poplar Hall": "Juniper Hall",
  JPH: "Juniper Hall",
  "Castor / Andros Complex": "Castor Hall (Betty Castor Hall)",
  AND: "Castor Hall (Betty Castor Hall)",
  "Castor Hall": "Castor Hall (Betty Castor Hall)",
  "Kosove Hall": "Kosove Hall / Kosove Apartments",
  "Kosove Apartments": "Kosove Hall / Kosove Apartments",
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

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
