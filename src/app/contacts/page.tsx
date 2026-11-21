import Link from "next/link";
import { LinkIcon, PhoneIcon } from "@/components/Icons";
import { CAMPUSES } from "@/lib/campuses";

export const metadata = { title: "Lost & found contacts · Campus Helper" };

export default function ContactsPage() {
  return (
    <div>
      <Link href="/" className="link text-[15px]">← Back to home</Link>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Lost &amp; found contacts</h1>
      <p className="mt-1.5 max-w-2xl text-muted">
        Phone numbers for every USF campus, checked against official USF pages. Emergencies: call 911.
      </p>

      <nav className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
        {CAMPUSES.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="rounded-full border border-line bg-white px-4 py-1.5 hover:border-bull">
            {c.name}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-10">
        {CAMPUSES.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-24">
            <h2 className="text-2xl font-semibold">{c.name}</h2>
            {c.note && <p className="mt-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{c.note}</p>}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {c.contacts.map((p) => (
                <div key={p.name} className="flex flex-col rounded-2xl border border-line bg-white p-5">
                  <h3 className="font-semibold">{p.name}</h3>
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
            <h3 className="mb-2 mt-5 text-sm font-bold tracking-wider text-muted">MORE LOST &amp; FOUND INFO</h3>
            <ul className="flex flex-wrap gap-2">
              {c.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="btn-ghost px-4 py-2 text-sm">
                    <LinkIcon /> {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
