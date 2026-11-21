import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "BlueBelly — Talk. Share. Connect.",
    template: "%s · BlueBelly",
  },
  description:
    "BlueBelly brings private conversations and lasting Moments together. Talk, share and connect in one clean social app where you control who sees what and how long messages stay.",
  applicationName: "BlueBelly",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BlueBelly",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/bemblo-icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/bemblo-icon.png", sizes: "512x512", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "BlueBelly — Talk. Share. Connect.",
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
    { color: "#12041f" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} dark`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
