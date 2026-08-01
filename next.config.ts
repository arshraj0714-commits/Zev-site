import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  // Allow large request bodies for Server Actions (if used in future).
  // NOTE: This does NOT affect API Route Handlers — Vercel's serverless
  // function body limit (4.5MB) applies to those regardless.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
