import { BUILDINGS, findBuilding, haversine, type Building } from "./buildings";

/** USF Tampa, roughly the Marshall Student Center lawn. */
export const CAMPUS_CENTER = { lat: 28.0612, lng: -82.4135 };

/** Generous box around USF Tampa. Reports outside it are refused (keeps the map and the data on campus). */
export const CAMPUS_BOUNDS = { south: 28.05, north: 28.075, west: -82.43, east: -82.4 };

export function onCampus(lat: number, lng: number): boolean {
  return lat >= CAMPUS_BOUNDS.south && lat <= CAMPUS_BOUNDS.north && lng >= CAMPUS_BOUNDS.west && lng <= CAMPUS_BOUNDS.east;
}

/** A pin closer than this to a building is treated as "in / at" that building (used for routing by building kind). */
export const AT_BUILDING_METERS = 70;

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversine(a.lat, a.lng, b.lat, b.lng);
}

export function closestBuilding(lat: number, lng: number): { building: Building; meters: number } {
  let best = BUILDINGS[0];
  let bestD = Infinity;
  for (const b of BUILDINGS) {
    const d = haversine(lat, lng, b.lat, b.lng);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return { building: best, meters: bestD };
}

/** Building the pin is at, or undefined when it is outdoors (road, lot, lawn). */
export function buildingAt(lat: number, lng: number): Building | undefined {
  const c = closestBuilding(lat, lng);
  return c.meters <= AT_BUILDING_METERS ? c.building : undefined;
}

/** Human label for a report's place: "Cooper Hall" or "Outdoors, 120 m from Cooper Hall". */
export function placeLabel(r: { building: string | null; lat: number | null; lng: number | null }): string {
  const b = findBuilding(r.building);
  if (b) return b.name;
  if (r.lat != null && r.lng != null) {
    const c = closestBuilding(r.lat, r.lng);
    return `Outdoors, ~${Math.round(c.meters / 10) * 10} m from ${c.building.name}`;
  }
  return r.building ?? "USF Tampa";
}

/** Round to ~110 m (3 decimals) so public pins do not reveal exactly where a person or their item was. */
export function roundCoord(x: number | null, decimals = 3): number | null {
  if (x == null) return null;
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
