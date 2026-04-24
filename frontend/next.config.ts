import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // The internal API URL the Next.js server uses to reach the FastAPI service.
  // Browser-side calls use NEXT_PUBLIC_API_URL.
  env: {
    INTERNAL_API_URL: process.env.INTERNAL_API_URL ?? "http://backend:8000",
  },
  // Auto-transform barrel imports → direct deep imports for these packages.
  // Avoids loading thousands of unused modules at boot/build time.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
