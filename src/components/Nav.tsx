"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/issues", label: "Campus", icon: "🗺️" },
  { href: "/report", label: "Report", icon: "📷", primary: true },
  { href: "/browse", label: "Found", icon: "🙌" },
  { href: "/me", label: "Mine", icon: "📋" },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/ops")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return t.primary ? (
            <Link key={t.href} href={t.href} className="-mt-5 flex flex-col items-center" aria-label="Report something">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bull text-2xl text-white shadow-lg ring-4 ring-white">{t.icon}</span>
              <span className="mt-0.5 text-[11px] font-semibold text-bull">{t.label}</span>
            </Link>
          ) : (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center py-2 text-[11px] font-medium ${active ? "text-bull" : "text-neutral-500"}`}>
              <span className={`text-xl ${active ? "" : "grayscale"}`}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
