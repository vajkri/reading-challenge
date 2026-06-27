// Generate the PWA icon set from app/icon.svg. Run: node scripts/gen-icons.mjs
// Output: public/icons/{icon-192,icon-512,icon-maskable-512}.png + app/apple-icon.png
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "app/icon.svg";
const BG = "#FFF1DD"; // the icon's own backdrop — flattened in so corners are opaque

await mkdir("public/icons", { recursive: true });

// High density so the 100x100 viewBox rasterizes crisply at large sizes.
const render = (size, out) =>
  sharp(SRC, { density: 512 })
    .resize(size, size, { fit: "contain", background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(out);

await render(192, "public/icons/icon-192.png");
await render(512, "public/icons/icon-512.png");
// Maskable: full-bleed background (already opaque) keeps the books inside the
// platform safe zone when the OS applies its mask.
await render(512, "public/icons/icon-maskable-512.png");
await render(180, "app/apple-icon.png");

console.log("✓ icons generated");
