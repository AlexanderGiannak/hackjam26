import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Campus Helper",
  description: "Lost it, found it, or spotted something broken at USF? We already know which office to ask.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#006747" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <header className="sticky top-0 z-20 bg-bull text-white shadow">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Campus Helper
            </Link>
            <nav className="flex gap-4 text-sm font-medium text-white/90">
              <Link href="/browse">Found items</Link>
              <Link href="/issues">Issues</Link>
            </nav>
          </div>
        </header>
        <DemoBanner />
        <main className="mx-auto max-w-xl px-4 pb-16 pt-4">{children}</main>
      </body>
    </html>
  );
}
