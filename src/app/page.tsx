import Link from "next/link";

const ACTIONS = [
  { href: "/lost", emoji: "🔎", title: "I lost something", sub: "Get the right offices to call, in order, and see possible matches." },
  { href: "/found", emoji: "🙌", title: "I found something", sub: "Find out exactly where to turn it in, and help the owner find it." },
  { href: "/fix", emoji: "🛠️", title: "Report something broken", sub: "We send it to the right team: Facilities, Housing, or the library." },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="pt-2">
        <h1 className="text-2xl font-bold leading-tight">You don&apos;t need to know which office to ask.</h1>
        <p className="mt-1 text-neutral-600">The app already does. Pick what happened.</p>
      </section>
      <section className="space-y-3">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="card flex items-center gap-4 transition hover:border-bull active:scale-[0.99]">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-light text-3xl">{a.emoji}</span>
            <span>
              <span className="block text-lg font-semibold">{a.title}</span>
              <span className="block text-sm text-neutral-600">{a.sub}</span>
            </span>
          </Link>
        ))}
      </section>
      <section className="grid grid-cols-2 gap-3">
        <Link href="/browse" className="btn-ghost">Browse found items</Link>
        <Link href="/issues" className="btn-ghost">Campus issues</Link>
      </section>
      <p className="text-center text-xs text-neutral-500">Emergency? Call 911.</p>
    </div>
  );
}
