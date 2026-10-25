import React from "react";
import "./globals.css";

export const metadata = {
  title: "Familienstiftung-Rechner",
  description:
    "Offline-fähiger PWA-Rechner für eine Familienstiftung mit Darlehen, Miete und AfA.",
  applicationName: "Familienstiftung-Rechner",
  authors: [{ name: "Familienstiftung" }],
  generator: "Next.js",
  keywords: [
    "Familienstiftung",
    "Vermögensplanung",
    "Steuer",
    "Immobilien",
    "Darlehen",
    "ETF",
    "PWA",
  ],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Familienstiftung",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    title: "Familienstiftung-Rechner",
    description:
      "Offline-fähiger PWA-Rechner für eine Familienstiftung mit Darlehen, Miete und AfA.",
    siteName: "Familienstiftung-Rechner",
  },
  twitter: {
    card: "summary",
    title: "Familienstiftung-Rechner",
    description:
      "Offline-fähiger PWA-Rechner für eine Familienstiftung mit Darlehen, Miete und AfA.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: "#0f4c81",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return React.createElement(
    "html",
    { lang: "de" },
    React.createElement("body", null, children),
  );
}
