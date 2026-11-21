"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/lost", label: "Lost" },
  { href: "/found", label: "Found" },
  { href: "/fix", label: "Report broken" },
  { href: "/browse", label: "Browse lost items" },
  { href: "/contacts", label: "Contacts" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bull text-sm font-bold text-white">CH</span>
          <span className="text-xl font-bold tracking-tight">Campus Helper</span>
        </Link>
        <nav className="hidden gap-6 text-[15px] font-medium md:flex">
          {NAV.map((n) => {
            const on = path === n.href || (n.href === "/browse" && path.startsWith("/browse"));
            return (
              <Link key={n.href} href={n.href} className={on ? "border-b-2 border-bull pb-0.5 text-bull" : "pb-0.5 hover:text-bull"}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/contacts" className="text-[15px] font-medium text-muted md:hidden">USF</Link>
      </div>
    </header>
  );
}
