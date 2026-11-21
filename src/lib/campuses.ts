/**
 * Lost & found / help numbers for every USF campus.
 * Each entry was checked against the linked official page on 2026-11-21.
 */
export interface Contact {
  name: string;
  phone: string;
  note?: string;
  source: string;
}

export interface Campus {
  id: string;
  name: string;
  note?: string;
  contacts: Contact[];
  links: { label: string; url: string }[];
}

export const CAMPUSES: Campus[] = [
  {
    id: "tampa",
    name: "Tampa",
    contacts: [
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
    ],
    links: [
      { label: "MSC Lost & Found", url: "https://www.usf.edu/student-affairs/msc/msc-services/lost-found.aspx" },
      { label: "USF Libraries Lost & Found", url: "https://lib.usf.edu/services/lost-and-found/" },
      { label: "USF Police contact", url: "https://www.usf.edu/public-safety/university-police/about/contact-up.aspx" },
      { label: "Lost USF ID (USFCard)", url: "https://www.usf.edu/it/resources/usf-card" },
    ],
  },
  {
    id: "stpete",
    name: "St. Petersburg",
    contacts: [
      {
        name: "USF St. Petersburg Police (lost & found, valuables)",
        phone: "727-873-4444",
        note: "STP-police@usf.edu, 530 3rd Street South. Emergencies: 911.",
        source: "https://www.stpetersburg.usf.edu/police/about/office-directory.aspx",
      },
      {
        name: "Nelson Poynter Library front desk",
        phone: "727-873-4123",
        note: "Found USF ID cards are kept at the library front desk.",
        source: "https://lib.usf.edu/services/lost-and-found/",
      },
      {
        name: "Housing Front Desk",
        phone: "727-873-5101",
        note: "Mon-Fri 8am-5pm. After hours: your RA or the RA on duty.",
        source: "https://www.stpetersburg.usf.edu/student-life/housing/experience/maintenance.aspx",
      },
      {
        name: "Facilities on-call",
        phone: "813-629-3427",
        note: "Mon-Fri 3:30pm-6am, weekends and holidays 24 hours.",
        source: "https://www.stpetersburg.usf.edu/resources/facilities/staff-directory.aspx",
      },
    ],
    links: [
      { label: "USF Libraries Lost & Found", url: "https://lib.usf.edu/services/lost-and-found/" },
      { label: "Police office directory", url: "https://www.stpetersburg.usf.edu/police/about/office-directory.aspx" },
      { label: "Facilities work request", url: "https://www.stpetersburg.usf.edu/resources/facilities/work-request.aspx" },
      { label: "Housing maintenance", url: "https://www.stpetersburg.usf.edu/student-life/housing/experience/maintenance.aspx" },
    ],
  },
  {
    id: "sarasota",
    name: "Sarasota-Manatee (teach-out site)",
    note: "Campus facilities moved to New College of Florida on July 1, 2026. Call ahead to confirm.",
    contacts: [
      {
        name: "Campus security office (lost & found)",
        phone: "941-993-8548",
        note: "Turn items in to room B131.",
        source: "https://www.sarasotamanatee.usf.edu/campus-life/campus-safety/police/faq.aspx",
      },
      {
        name: "Campus police office",
        phone: "941-487-4210",
        note: "Emergencies: 911.",
        source: "https://www.sarasotamanatee.usf.edu/campus-life/health-and-safety/campus-safety/staff-and-contact.aspx",
      },
      {
        name: "Library",
        phone: "941-359-4225",
        source: "https://lib.usf.edu/services/lost-and-found/",
      },
    ],
    links: [
      { label: "Campus police FAQ (lost & found)", url: "https://www.sarasotamanatee.usf.edu/campus-life/campus-safety/police/faq.aspx" },
      { label: "USF Libraries Lost & Found", url: "https://lib.usf.edu/services/lost-and-found/" },
    ],
  },
];
