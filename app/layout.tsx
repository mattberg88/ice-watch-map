import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "ICE Watch Bay Area";

export const metadata: Metadata = {
  title: appName,
  description: "Map of reported ICE activity in the Bay Area from community trackers and local news, with know-your-rights information.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
