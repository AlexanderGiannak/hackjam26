/**
 * USF Tampa lost & found and help numbers.
 * The app covers the Tampa campus only (the largest USF campus).
 * Each entry was checked against the linked official page on 2026-11-21.
 */
export interface Contact {
  name: string;
  phone: string;
  note?: string;
  source: string;
}

export const TAMPA_CONTACTS: Contact[] = [
  {
    name: "USF Police (lost & found, valuables)",
    phone: "813-974-2628",
    note: "24/7 non-emergency line. Emergencies: 911.",
    source: "https://www.usf.edu/public-safety/university-police/about/contact-up.aspx",
  },
  {
    name: "MSC Information Desk",
    phone: "813-974-3180",
    note: "Non-valuable items found in the Marshall Student Center, held 30 days.",
    source: "https://www.usf.edu/student-affairs/msc/msc-services/lost-found.aspx",
  },
  {
    name: "Tampa Campus Library",
    phone: "813-974-2729",
    note: "Items left in the library, held 30 days at the Library Services desk.",
    source: "https://lib.usf.edu/services/lost-and-found/",
  },
  {
    name: "Shimberg Health Sciences Library",
    phone: "813-974-8432",
    source: "https://libraries.health.usf.edu/about/shimberg",
  },
  {
    name: "USF Card Center (lost ID cards)",
    phone: "813-974-4357",
    note: "Mon-Fri 9am-5pm. Deactivates and reprints IDs.",
    source: "https://www.usf.edu/it/resources/usf-card",
  },
  {
    name: "Facilities Service Center",
    phone: "813-974-2750",
    note: "Mon-Fri 8am-5pm. After-hours emergencies: 813-974-2845.",
    source: "https://www.usf.edu/facilities/service-center/contact-us.aspx",
  },
  {
    name: "Housing maintenance",
    phone: "813-974-3446",
    note: "Mon-Fri 8am-5pm. USF Village residents: 813-974-0764. After hours: your RA.",
    source: "https://www.usf.edu/housing/residential-experience/resident-services/maintenance-requests.aspx",
  },
  {
    name: "Parking & Transportation Services",
    phone: "813-974-3990",
    note: "Cars blocking ramps, fire lanes or spaces; broken gates. Email psweb@usf.edu.",
    source: "https://www.usf.edu/parking/about-us/contact-us.aspx",
  },
];

export const TAMPA_LINKS: { label: string; url: string }[] = [
  { label: "MSC Lost & Found", url: "https://www.usf.edu/student-affairs/msc/msc-services/lost-found.aspx" },
  { label: "USF Libraries Lost & Found", url: "https://lib.usf.edu/services/lost-and-found/" },
  { label: "USF Police contact", url: "https://www.usf.edu/public-safety/university-police/about/contact-up.aspx" },
  { label: "Lost USF ID (USFCard)", url: "https://www.usf.edu/it/resources/usf-card" },
];
