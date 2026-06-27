// Postbuild: stamp the BUILT out/sw.js with a content-derived BUILD_ID and the
// full precache asset list. The dev copy (public/sw.js) ships valid defaults
// (BUILD_ID "dev", empty PRECACHE_ASSETS); this script rewrites those literals
// in the exported out/sw.js so the installed PWA precaches the real build
// assets and works offline on first launch. A new BUILD_ID means a new cache
// name, which triggers install/activate and purges the previous cache.
//
// Usage: node scripts/inject-sw-assets.mjs (npm runs it automatically as
// `postbuild`, after `next build`, locally and in CI).
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { createHash } from "node:crypto";

const BASE = "/reading-challenge";
const ROOT = join(process.cwd(), "out");
const SW = join(ROOT, "sw.js");

// Recursively collect every file under `dir`, returning absolute paths.
async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // directory missing → nothing to collect
  }
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

// Resolve a single path under out/; return [] if it does not exist.
async function fileIfPresent(p) {
  try {
    const s = await stat(p);
    return s.isFile() ? [p] : [];
  } catch {
    return [];
  }
}

// Collect top-level out/ files matching a regex (e.g. hashed icon variants
// like `icon.<hash>.svg` or `apple-icon.<hash>.png` that Next may emit).
async function matchTopLevel(re) {
  let entries;
  try {
    entries = await readdir(ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && re.test(e.name))
    .map((e) => join(ROOT, e.name));
}

// Map an absolute path under out/ to its served URL.
function toUrl(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join(posix.sep);
  return `${BASE}/${rel}`;
}

async function main() {
  const collected = [
    ...(await walk(join(ROOT, "_next"))),
    ...(await walk(join(ROOT, "icons"))),
    ...(await fileIfPresent(join(ROOT, "apple-icon.png"))),
    ...(await fileIfPresent(join(ROOT, "icon.svg"))),
    ...(await matchTopLevel(/^(icon|apple-icon)\..+\.(svg|png)$/)), // hashed icon variants
    ...(await fileIfPresent(join(ROOT, "manifest.webmanifest"))),
    ...(await fileIfPresent(join(ROOT, "index.html"))),
    ...(await fileIfPresent(join(ROOT, "404.html"))),
  ];

  const urls = Array.from(new Set(collected.map(toUrl))).sort();

  const buildId = createHash("sha256").update(urls.join("\n")).digest("hex").slice(0, 8);

  let sw = await readFile(SW, "utf8");
  sw = sw.replace('const BUILD_ID = "dev";', `const BUILD_ID = ${JSON.stringify(buildId)};`);
  sw = sw.replace("const PRECACHE_ASSETS = [];", `const PRECACHE_ASSETS = ${JSON.stringify(urls)};`);
  await writeFile(SW, sw);

  console.log(`[inject-sw-assets] BUILD_ID=${buildId} precache assets=${urls.length}`);
}

main().catch((err) => {
  console.error("[inject-sw-assets] failed:", err);
  process.exit(1);
});
