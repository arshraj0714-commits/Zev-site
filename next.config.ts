import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Netlify builds Next.js natively — do NOT use output: "standalone" */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
