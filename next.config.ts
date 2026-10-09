import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // WSL2 localhost forwarding is broken on this machine, so the app is
  // opened via the WSL IP (http://172.18.83.154:3000). Next.js 16 blocks
  // cross-origin dev assets by default — without this, pages render but
  // NO client JavaScript runs (dead buttons, no sign-in).
  // If the WSL IP changes (it does on WSL restart), update this entry.
  allowedDevOrigins: ["172.18.83.154"],
  async headers() {
    return [
      {
        // Apply security headers to all routes across the application
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
