import "./globals.css";

export const metadata = {
  title: "Familienstiftung-Rechner",
  description:
    "Offline-fähiger PWA-Rechner für eine Familienstiftung mit Darlehen, Miete und AfA.",
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
};

export const viewport = {
  themeColor: "#0f4c81",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
