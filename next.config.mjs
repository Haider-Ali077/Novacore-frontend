import { fileURLToPath } from "node:url";

// The SuperNova page. It has no backend of its own: every /api/... request is forwarded to the SuperNova
// backend at BACKEND_URL, so the page keeps calling the same paths as before and the browser sees one origin
// (no CORS needed, downloads and logos keep working).
const backend = (process.env.BACKEND_URL || "http://localhost:3001").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the root so lockfiles in parent folders are never picked up.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
  experimental: {
    // FS, TS and ABAP generation can take minutes; the forwarding proxy's default is 30 seconds.
    proxyTimeout: 10 * 60 * 1000,
  },
};
export default nextConfig;
