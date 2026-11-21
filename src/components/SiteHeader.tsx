"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";

const NAV = [
  { href: "/lost", label: "Lost" },
  { href: "/found", label: "Found" },
  { href: "/fix", label: "Report a problem" },
  { href: "/browse", label: "Browse" },
  { href: "/issues", label: "Campus issues" },
  { href: "/me", label: "My reports" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-bull text-lg">📣</span>
          <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
        </Link>
        <nav className="hidden gap-5 text-[15px] font-medium lg:flex">
          {NAV.map((n) => {
            const on = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={on ? "border-b-2 border-bull pb-0.5 text-bull" : "pb-0.5 hover:text-bull"}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4 text-[15px] font-medium lg:hidden">
          <Link href="/issues" className={path.startsWith("/issues") ? "text-bull" : "text-muted"}>Campus</Link>
          <Link href="/me" className={path.startsWith("/me") ? "text-bull" : "text-muted"}>Mine</Link>
        </div>
      </div>
    </header>
  );
}
