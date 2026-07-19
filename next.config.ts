import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone if NOT deploying to Netlify
  ...(process.env.NETLIFY ? {} : { output: "standalone" }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
