import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bemblo — Talk. Share. Connect.",
    template: "%s · Bemblo",
  },
  description:
    "Bemblo brings private conversations and lasting Moments together. Talk, share and connect in one clean social app where you control who sees what and how long messages stay.",
  applicationName: "Bemblo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bemblo",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/bemblo-icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/bemblo-icon.png", sizes: "512x512", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Bemblo — Talk. Share. Connect.",
    description: "Private conversations. Lasting Moments. You are in control.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a16" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
