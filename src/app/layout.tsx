import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";
import { MatchWatcher } from "@/components/MatchWatcher";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Bullhorn: report anything at USF",
  description: "Snap it, and Bullhorn sends it to the USF office that owns it: lost and found, broken things, potholes, bad parking.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "Bullhorn", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#006747", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} antialiased`}>
        <header className="sticky top-0 z-30 bg-bull text-white shadow">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold text-base">📣</span>
              Bullhorn
            </Link>
            <Link href="/ops" className="rounded-full border border-white/30 px-3 py-1 text-xs font-medium text-white/90">
              USF staff
            </Link>
          </div>
        </header>
        <DemoBanner />
        <main className="mx-auto max-w-xl px-4 pb-28 pt-4">{children}</main>
        <MatchWatcher />
        <Nav />
      </body>
    </html>
  );
}
