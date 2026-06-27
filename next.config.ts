import type { NextConfig } from "next";

// GitHub Pages *project* site is served from https://<user>.github.io/<repo>/,
// so every asset must be prefixed with the repo path. Applied in dev too so that
// `next dev` and the deployed site share the exact same base path (SW scope,
// manifest URLs and internal links stay identical between dev and prod).
const basePath = "/reading-challenge";

const nextConfig: NextConfig = {
  output: "export", // static export → ./out (no server; localStorage-only app)
  basePath,
  assetPrefix: basePath,
  trailingSlash: true, // routes resolve cleanly as static files on Pages
  images: { unoptimized: true }, // no image optimizer on static export (art is SVG)
  env: { NEXT_PUBLIC_BASE_PATH: basePath }, // expose to client (SW + manifest paths)
};

export default nextConfig;
