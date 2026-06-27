// Runtime base path, mirrors `basePath` in next.config.ts. Used for asset URLs
// that Next does NOT auto-prefix (service-worker registration, manifest paths).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
