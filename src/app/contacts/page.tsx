import Link from "next/link";
import { LinkIcon, PhoneIcon } from "@/components/Icons";
import { TAMPA_CONTACTS, TAMPA_LINKS } from "@/lib/contacts";

export const metadata = { title: "Lost & found contacts · Campus Helper" };

export default function ContactsPage() {
  return (
    <div>
      <Link href="/" className="link text-[15px]">← Back to home</Link>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">USF Tampa lost &amp; found contacts</h1>
      <p className="mt-1.5 max-w-2xl text-muted">
        Who to call on the Tampa campus, checked against official USF pages. Emergencies: call 911.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {TAMPA_CONTACTS.map((p) => (
          <div key={p.name} className="flex flex-col rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">{p.name}</h2>
            {p.note && <p className="mt-1 text-sm text-muted">{p.note}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
              <a href={`tel:${p.phone.replace(/\D/g, "")}`} className="btn-primary px-4 py-2 text-sm">
                <PhoneIcon /> {p.phone}
              </a>
              <a href={p.source} target="_blank" rel="noreferrer" className="text-xs text-muted underline">
                Source
              </a>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-bold tracking-wider text-muted">MORE LOST &amp; FOUND INFO</h2>
      <ul className="flex flex-wrap gap-2">
        {TAMPA_LINKS.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noreferrer" className="btn-ghost px-4 py-2 text-sm">
              <LinkIcon /> {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
