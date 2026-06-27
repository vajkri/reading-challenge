"use client";

// Registers the service worker (production only) at the basePath-correct URL
// and scope, so the installed PWA opens under /reading-challenge/.
import { useEffect } from "react";
import { BASE_PATH } from "@/lib/config";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
      .catch(() => {
        /* registration failures are non-fatal */
      });
  }, []);
  return null;
}
