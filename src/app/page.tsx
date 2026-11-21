import Link from "next/link";
import { BoxIcon, CameraIcon, ChevronRight, SearchIcon, TrayIcon } from "@/components/Icons";
import { CampusNow, FoundWaiting } from "@/components/CampusNow";
import { APP_NAME } from "@/lib/brand";

/** Home, from HackJam Wireframes V2: one big "Snap & report", the lost and found paths, and the campus right now. */
export default function Home() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-8">
      <div className="space-y-4">
        <section>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            See it. Snap it.
            <br />
            <span className="text-bull">USF hears it.</span>
          </h1>
          <p className="mt-3 text-lg text-muted">
            Broken light, pothole, car blocking a ramp, a wallet on a bench. You don&apos;t need to know which office to tell. {APP_NAME} does.
          </p>
        </section>

        <Link
          href="/fix"
          className="flex items-center gap-5 rounded-3xl bg-bull p-5 text-white transition hover:bg-bull-dark active:scale-[0.99] sm:p-6"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <CameraIcon className="h-8 w-8" />
          </span>
          <span>
            <span className="block text-2xl font-bold">Snap &amp; report</span>
            <span className="mt-0.5 block text-white/90">AI reads the photo and sends it to the right USF office.</span>
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/lost" className="rounded-3xl border border-line bg-white p-4 transition hover:border-ink/30 active:scale-[0.99] sm:p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas">
              <SearchIcon className="h-5 w-5" />
            </span>
            <span className="mt-3 block text-lg font-bold">I lost something</span>
            <span className="mt-1 block text-sm text-muted">No photo needed. Get alerted on a match.</span>
          </Link>
          <Link href="/found" className="rounded-3xl border border-line bg-white p-4 transition hover:border-ink/30 active:scale-[0.99] sm:p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas">
              <BoxIcon className="h-5 w-5" />
            </span>
            <span className="mt-3 block text-lg font-bold">I found something</span>
            <span className="mt-1 block text-sm text-muted">Snap it. We show you where to turn it in.</span>
          </Link>
        </div>

        <Link
          href="/browse?type=found"
          className="flex items-center gap-4 rounded-3xl border border-line bg-white p-4 transition hover:border-ink/30 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas">
            <TrayIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Found items</span>
            <span className="block text-sm text-muted">
              <FoundWaiting />
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
        </Link>

        <p className="hidden pt-2 text-sm text-muted lg:block">
          Need a phone number?{" "}
          <Link href="/contacts" className="link">Tampa lost &amp; found contacts</Link>. Emergency? <a href="tel:911" className="link">Call 911</a>.
        </p>
      </div>

      <CampusNow />

      <p className="text-sm text-muted lg:hidden">
        Need a phone number?{" "}
        <Link href="/contacts" className="link">Tampa lost &amp; found contacts</Link>. Emergency? <a href="tel:911" className="link">Call 911</a>.
      </p>
    </div>
  );
}
