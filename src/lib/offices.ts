import type { Office } from "./types";

/**
 * Seed copy of the `offices` table (also in supabase/schema.sql).
 * The app reads from Supabase when configured and falls back to this list.
 *
 * Phone numbers checked against official USF pages on 2026-11-21 (source URL above each row).
 * verified=true only when phone AND hours are confirmed. Library rows still need hours.
 * Do not guess contact details.
 */
export const OFFICES: Office[] = [
  {
    // https://www.usf.edu/public-safety/university-police/about/contact-up.aspx
    id: "upd",
    name: "USF Police (Lost & Found)",
    handles: "Lost and found property, especially valuables like phones, wallets, and laptops. Emergencies: call 911.",
    categories: ["phone", "wallet", "laptop", "keys", "bag", "valuables", "other"],
    hours: null,
    always_open: true,
    phone: "813-974-2628",
    email: null,
    url: "https://www.usf.edu/public-safety/university-police/about/contact-up.aspx",
    location: "13152 USF Genshaft Drive, Tampa",
    sort_order: 1,
    verified: true,
  },
  {
    // https://www.usf.edu/it/resources/usf-card
    id: "card",
    name: "USF Card Center",
    handles: "Lost or found USF ID cards. Found IDs should go here, not on a public list.",
    categories: ["id_card"],
    hours: [{ days: [1, 2, 3, 4, 5], open: "09:00", close: "17:00" }],
    phone: "813-974-4357",
    email: "help@usf.edu",
    url: "https://www.usf.edu/it/resources/usf-card",
    location: "Tampa Campus Library",
    sort_order: 2,
    verified: true,
  },
  {
    // https://lib.usf.edu/services/lost-and-found/  (hours still to confirm)
    id: "lib-tampa",
    name: "Tampa Campus Library Service Desk",
    handles: "Items left in the Tampa Campus Library (held 30 days), and library building issues.",
    categories: ["library"],
    hours: null,
    phone: "813-974-2729",
    email: null,
    url: "https://lib.usf.edu/forms/report-a-problem/",
    location: "4101 USF Apple Dr, 1st floor",
    sort_order: 3,
    verified: false,
  },
  {
    // https://libraries.health.usf.edu/about/shimberg  (hours still to confirm)
    id: "lib-shimberg",
    name: "Shimberg Health Sciences Library Desk",
    handles: "Items left in the Shimberg Health Sciences Library, and library building issues.",
    categories: ["library"],
    hours: null,
    phone: "813-974-8432",
    email: null,
    url: "https://libraries.health.usf.edu/about/shimberg",
    location: "12908 Bruce B. Downs Blvd",
    sort_order: 4,
    verified: false,
  },
  {
    // https://www.usf.edu/student-affairs/msc/msc-services/lost-found.aspx  (hours still to confirm)
    id: "msc",
    name: "MSC Information Desk",
    handles: "Non-valuable items found in the Marshall Student Center (held 30 days). Valuables go to USF Police daily.",
    categories: ["msc"],
    hours: null,
    phone: "813-974-3180",
    email: null,
    url: "https://www.usf.edu/student-affairs/msc/msc-services/lost-found.aspx",
    location: "Marshall Student Center",
    sort_order: 5,
    verified: false,
  },
  {
    // https://www.usf.edu/facilities/service-center/contact-us.aspx
    id: "facilities",
    name: "Facilities Service Center",
    handles:
      "Broken lights, doors, fountains, and furniture in non-residential buildings. After-hours emergencies: 813-974-2845 (24/7).",
    categories: ["facilities", "lighting", "fountain", "door", "furniture", "other"],
    hours: [{ days: [1, 2, 3, 4, 5], open: "08:00", close: "17:00" }],
    phone: "813-974-2750",
    email: "FM-ServiceCenter@usf.edu",
    url: "https://www.usf.edu/facilities/service-center/contact-us.aspx",
    location: "3820 USF Holly Drive (next to the USF Post Office)",
    sort_order: 6,
    verified: true,
  },
  {
    // https://www.usf.edu/housing/residential-experience/resident-services/maintenance-requests.aspx
    id: "housing",
    name: "Housing & Residential Education Maintenance",
    handles:
      "Maintenance problems in residence halls. USF Village residents call 813-974-0764. After hours, contact your RA on duty.",
    categories: ["housing"],
    hours: [{ days: [1, 2, 3, 4, 5], open: "08:00", close: "17:00" }],
    phone: "813-974-3446",
    email: null,
    url: "https://assetessentials.dudesolutions.com/USFH/",
    location: null,
    sort_order: 7,
    verified: true,
  },
];
