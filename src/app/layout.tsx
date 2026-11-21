import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";
import { MatchWatcher } from "@/components/MatchWatcher";
import { SiteBottomNav, SiteHeader } from "@/components/SiteHeader";
import { APP_NAME } from "@/lib/brand";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
/** Rounded heavy face for the brand and the home cards (V3 wireframes). */
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["800", "900"] });

export const metadata: Metadata = {
  title: `${APP_NAME}: report anything at USF`,
  description: "Lost it, found it, or spotted something broken, a pothole or bad parking on the USF Tampa campus? We already know which office to tell.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#006747" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${nunito.variable} antialiased`}>
        <SiteHeader />
        <DemoBanner />
        <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:pb-20">{children}</main>
        <SiteBottomNav />
        <MatchWatcher />
      </body>
    </html>
  );
}
