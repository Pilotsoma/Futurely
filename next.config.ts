import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
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
