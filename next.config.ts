import type { NextConfig } from "next";

// Served from the apex custom domain https://laesemakker.dk/, so the app lives at
// the root path — no basePath/assetPrefix. NEXT_PUBLIC_BASE_PATH stays defined (as
// an empty string) because lib/config.ts and the manifest read it; keeping the key
// makes the "root-served" choice explicit rather than incidental.
const basePath = "";

const nextConfig: NextConfig = {
  output: "export", // static export → ./out (no server; localStorage-only app)
  trailingSlash: true, // routes resolve cleanly as static files on Pages
  images: { unoptimized: true }, // no image optimizer on static export (art is SVG)
  env: { NEXT_PUBLIC_BASE_PATH: basePath }, // expose to client (SW + manifest paths)
};

export default nextConfig;
