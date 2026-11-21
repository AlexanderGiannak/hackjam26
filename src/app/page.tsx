import Link from "next/link";
import { BoxIcon, SearchIcon, WrenchIcon } from "@/components/Icons";
import { CampusNow } from "@/components/CampusNow";
import { RecentLost } from "@/components/RecentLost";

const ACTIONS = [
  {
    href: "/lost",
    icon: SearchIcon,
    title: "I lost something",
    sub: "See where to look and who to call",
    long: "See where to look and who to call, in order.",
    primary: true,
  },
  {
    href: "/found",
    icon: BoxIcon,
    title: "I found something",
    sub: "Find out where to turn it in",
    long: "Find out where to turn it in and post it so the owner can see it.",
  },
  {
    href: "/fix",
    icon: WrenchIcon,
    title: "Report a problem",
    sub: "Broken stuff, potholes, bad parking",
    long: "Snap it: broken lights, leaks, potholes, bad parking, hazards. We send it to the office that owns it.",
  },
];

export default function Home() {
  return (
    <div>
      <section className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">What happened?</h1>
        <p className="mt-3 text-lg text-muted sm:text-xl">
          You don&apos;t need to know which office to ask. Pick one and we&apos;ll tell you where to go next on the USF Tampa campus.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
        {ACTIONS.map(({ href, icon: Icon, title, sub, long, primary }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-5 rounded-3xl px-6 py-6 transition active:scale-[0.99] md:flex-col md:items-start md:gap-4 md:px-8 md:py-8 ${
              primary ? "bg-bull text-white hover:bg-bull-dark" : "border-[1.5px] border-ink bg-white hover:bg-tint"
            }`}
          >
            <Icon className="h-8 w-8 shrink-0" />
            <span>
              <span className="block text-xl font-semibold md:text-2xl">{title}</span>
              <span className={`mt-0.5 block md:mt-2 ${primary ? "text-white/90" : "text-muted"}`}>
                <span className="md:hidden">{sub}</span>
                <span className="hidden md:inline">{long}</span>
              </span>
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">Current lost items</h2>
          <Link href="/browse" className="link">
            <span className="md:hidden">Browse all</span>
            <span className="hidden md:inline">Browse all lost items</span>
          </Link>
        </div>
        <RecentLost />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">Campus right now</h2>
          <Link href="/issues" className="link">Campus issues</Link>
        </div>
        <CampusNow />
      </section>

      <section className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-muted">
        <Link href="/me" className="link">My reports</Link>
        <Link href="/contacts" className="link">Tampa lost &amp; found phone numbers</Link>
        <Link href="/ops" className="link">USF staff console</Link>
        <span>
          Emergency? <a href="tel:911" className="link">Call 911</a>. A student project, not an official USF service.
        </span>
      </section>
    </div>
  );
}
