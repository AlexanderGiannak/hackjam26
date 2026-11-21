"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/brand";
import { CameraIcon, DocIcon, HomeIcon, MapIcon, TrayIcon } from "./Icons";

/** The five student tabs from the V2 wireframes. Report is the raised camera button on phones. */
const TABS = [
  { href: "/", label: "Home", icon: HomeIcon, on: (p: string) => p === "/" },
  { href: "/issues", label: "Campus", icon: MapIcon, on: (p: string) => p.startsWith("/issues") },
  { href: "/fix", label: "Report", icon: CameraIcon, on: (p: string) => p.startsWith("/fix") },
  { href: "/browse?type=found", label: "Found", icon: TrayIcon, on: (p: string, t: string | null) => p.startsWith("/found") || (p.startsWith("/browse") && t === "found") },
  { href: "/me", label: "Mine", icon: DocIcon, on: (p: string) => p.startsWith("/me") || p.startsWith("/r/") },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-white/70 text-lg">
        📣
      </span>
      <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}

function Header() {
  const path = usePathname();
  const type = useSearchParams().get("type");
  const staff = path.startsWith("/ops");
  return (
    <header className="sticky top-0 z-30 bg-bull text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 text-[15px] font-medium lg:flex">
          {TABS.map(({ href, label, icon: Icon, on }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 transition ${on(path, type) && !staff ? "bg-white/15" : "hover:bg-white/10"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/ops"
          className={`rounded-full border border-white/60 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 ${staff ? "bg-white/15" : ""}`}
        >
          USF staff
        </Link>
      </div>
    </header>
  );
}

function BottomNav() {
  const path = usePathname();
  const type = useSearchParams().get("type");
  if (path.startsWith("/ops")) return null; // the staff console has its own step bar
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
        {TABS.map(({ href, label, icon: Icon, on }) => {
          const active = on(path, type);
          if (label === "Report")
            return (
              <Link key={href} href={href} className="-mt-6 flex flex-col items-center pb-2" aria-label="Snap and report">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-bull text-white shadow-md">
                  <Icon className="h-7 w-7" />
                </span>
                <span className="text-xs font-semibold text-bull">{label}</span>
              </Link>
            );
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active ? "font-semibold text-bull" : "text-ink"}`}>
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<div className="h-16 bg-bull" />}>
      <Header />
    </Suspense>
  );
}

export function SiteBottomNav() {
  return (
    <Suspense>
      <BottomNav />
    </Suspense>
  );
}
