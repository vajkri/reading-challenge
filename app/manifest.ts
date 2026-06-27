import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/config";

// Next emits a static /manifest.webmanifest and auto-injects
// <link rel="manifest" href="${basePath}/manifest.webmanifest">. The icon `src`
// values are author-provided, so they must include the basePath themselves.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Læseudfordring",
    short_name: "Læseudfordring",
    description: "En læseudfordring der motiverer børn til at læse.",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF6E9",
    theme_color: "#F6A623",
    lang: "da",
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `${BASE_PATH}/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
