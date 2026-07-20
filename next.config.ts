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
  // Allow large request bodies for product/stock uploads (zip files as base64).
  // Base64 adds ~33% overhead, so a 10MB zip becomes ~13MB. 50MB is a safe ceiling.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Also increase the API route body size limit
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

export default nextConfig;
