import type { NextConfig } from "next";

/** On Vercel the backend is served at /_/backend via experimentalServices.
 *  Locally we proxy to the dev server on port 3001. */
const BACKEND_DEST =
  process.env.VERCEL
    ? "/_/backend"
    : process.env.BACKEND_PROXY_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_DEST}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
