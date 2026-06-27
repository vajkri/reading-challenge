// Static file server for the exported site, mounted under the basePath — so
// Playwright (and a quick manual check) exercise the real ./out artifact exactly
// as GitHub Pages serves it. Usage: node scripts/serve-out.mjs [port]
import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const PORT = Number(process.argv[2] || 4399);
const ROOT = join(process.cwd(), "out");
const PREFIX = "/reading-challenge";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

async function resolveFile(urlPath) {
  let p = urlPath.split("?")[0];
  if (p.startsWith(PREFIX)) p = p.slice(PREFIX.length);
  p = decodeURIComponent(p);
  if (p === "" || p === "/") p = "/index.html";

  let filePath = normalize(join(ROOT, p));
  if (!filePath.startsWith(ROOT)) return null; // path-traversal guard

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, "index.html");
    return filePath;
  } catch {
    // trailingSlash route → dir index, or a bare .html sibling
    for (const candidate of [join(filePath, "index.html"), filePath + ".html"]) {
      try {
        await stat(candidate);
        return candidate;
      } catch {
        /* keep trying */
      }
    }
    return null;
  }
}

createServer(async (req, res) => {
  const file = await resolveFile(req.url || "/");
  if (!file) {
    try {
      const body = await readFile(join(ROOT, "404.html"));
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("server error");
  }
}).listen(PORT, () => console.log(`serving ./out at http://localhost:${PORT}${PREFIX}/`));
