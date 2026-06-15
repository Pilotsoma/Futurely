import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // On Vercel, vercel.json routes handle /api/* directly — no rewrite needed.
    // Locally, proxy to the Express dev server on port 3001.
    if (process.env.VERCEL) return []
    const dest = process.env.BACKEND_PROXY_URL ?? "http://localhost:3001"
    return [{ source: "/api/:path*", destination: `${dest}/api/:path*` }]
  },
};

export default nextConfig;
