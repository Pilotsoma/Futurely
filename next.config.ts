import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dompurify is browser-only (uses window/document); exclude from the SSR bundle
  serverExternalPackages: ['dompurify'],

  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
