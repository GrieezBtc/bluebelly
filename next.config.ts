import type { NextConfig } from "next";

const remotePatterns = [
  { protocol: "https" as const, hostname: "images.pexels.com" },
  { protocol: "https" as const, hostname: "images.unsplash.com" },
  { protocol: "https" as const, hostname: "videos.pexels.com" },
  { protocol: "https" as const, hostname: "cdn.pixabay.com" },
  { protocol: "https" as const, hostname: "media.istockphoto.com" },
];

const nextConfig: NextConfig = {
  images: {
    // Runtime image optimisation is not guaranteed in every deployment target, so
    // Bemblo ships responsive sizes + lazy loading from the source CDN instead.
    unoptimized: true,
    remotePatterns,
  },
  async redirects() {
    // The old Moments feed page was merged into Home. Keep old links/bookmarks working.
    return [{ source: "/moments", destination: "/home", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
