import Link from "next/link";
import { BoxIcon, CameraIcon, SearchIcon } from "@/components/Icons";

const CARDS = [
  {
    href: "/lost",
    icon: SearchIcon,
    title: "I lost something",
    sub: "No photo needed. We tell you where to check and who to call.",
    card: "border border-line bg-white text-ink hover:border-ink/30",
    chip: "bg-canvas text-ink",
    subColor: "text-ink/80",
  },
  {
    href: "/found",
    icon: BoxIcon,
    title: "I found something",
    sub: "Takes 30 seconds. We tell you where to drop it off.",
    card: "bg-ink text-white hover:bg-black",
    chip: "bg-white/15 text-white",
    subColor: "text-white/85",
  },
  {
    href: "/fix",
    icon: CameraIcon,
    title: "Snap & report",
    sub: "AI reads the photo and sends it to the right USF office.",
    card: "bg-bull text-white hover:bg-bull-dark",
    chip: "bg-white/15 text-white",
    subColor: "text-white/85",
  },
];

/** Home, from HackJam Wireframes V3: three big doors, nothing else in the way. */
export default function Home() {
  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col justify-center gap-6">
      <h1 className="sr-only">FixMyUni: lost it, found it, or something&apos;s broken at USF Tampa</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {CARDS.map(({ href, icon: Icon, title, sub, card, chip, subColor }) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-56 flex-col justify-center rounded-[2rem] p-6 transition active:scale-[0.99] sm:p-7 md:min-h-72 ${card}`}
          >
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${chip}`}>
              <Icon className="h-7 w-7" />
            </span>
            <span className="mt-4 block font-display text-[2rem] font-black leading-[1.05] tracking-tight">{title}</span>
            <span className={`mt-2 block text-[17px] ${subColor}`}>{sub}</span>
          </Link>
        ))}
      </div>
      <p className="text-center text-sm text-muted">
        Need a phone number? <Link href="/contacts" className="link">Tampa lost &amp; found contacts</Link>. Campus problems on a map:{" "}
        <Link href="/issues" className="link">Campus</Link>. Emergency? <a href="tel:911" className="link">Call 911</a>.
      </p>
    </div>
  );
}
