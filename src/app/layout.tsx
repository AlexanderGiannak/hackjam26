import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";
import { MatchWatcher } from "@/components/MatchWatcher";
import { SiteHeader } from "@/components/SiteHeader";
import { APP_NAME } from "@/lib/brand";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${APP_NAME}: report anything at USF`,
  description: "Lost it, found it, or spotted something broken, a pothole or bad parking on the USF Tampa campus? We already know which office to tell.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <SiteHeader />
        <DemoBanner />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">{children}</main>
        <MatchWatcher />
      </body>
    </html>
  );
}
