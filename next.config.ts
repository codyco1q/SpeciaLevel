import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // WSL2 localhost forwarding is broken on this machine, so the app is
  // opened via the WSL IP (http://172.18.83.154:3000). Next.js 16 blocks
  // cross-origin dev assets by default — without this, pages render but
  // NO client JavaScript runs (dead buttons, no sign-in).
  // If the WSL IP changes (it does on WSL restart), update this entry.
  allowedDevOrigins: ["172.18.83.154"],
};

export default nextConfig;