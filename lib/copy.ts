// =====================================================================
// Centralized user-facing copy (i18n-ready).
//
// All Danish strings live in copy/da.json, grouped by app area. Dynamic
// bits use {token} placeholders (e.g. {name}, {count}) — resolve them
// with interp() at render time.
//
// TO ADD ENGLISH (or any locale): the ONLY step is
//   1. create copy/en.json with the SAME shape as da.json, and
//   2. add an entry to the `dicts` map below ({ da, en }).
// Then switch LOCALE (or make it dynamic). Nothing else needs to change.
//
// JSON import works because tsconfig has resolveJsonModule: true.
// =====================================================================

import da from "@/copy/da.json";

/** Active locale. Single source of truth for which dictionary `copy` resolves to. */
export const LOCALE = "da";

/**
 * Locale tag for date formatting (part of the locale config). A future
 * copy/en.json locale would set its own, e.g. "en-GB".
 */
export const DATE_LOCALE = "da-DK";

/**
 * Locale → dictionary map. Adding a locale = add one import + one entry here.
 * Typed against `da` so every future locale is structurally checked at compile time.
 */
const dicts: Record<string, typeof da> = { da };

/**
 * The active copy dictionary, typed as the exact shape of da.json so callers
 * get full autocomplete and key checking (e.g. copy.progress.captions[stage]).
 */
export const copy: typeof da = dicts[LOCALE];

/**
 * Interpolate {token} placeholders in a template string.
 *
 * @example interp(copy.progress.startSub, { name: "Max" })
 *          // "Max keder sig lidt. Sæt et mål og kom i gang!"
 * @example interp(copy.progress.deadline.daysLeft, { count: 5 })
 *          // "5 dage tilbage"
 *
 * Unknown tokens are left untouched (the raw {token} stays in place), so a
 * missing var is visible rather than silently dropped.
 */
export function interp(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    token in vars ? String(vars[token]) : match,
  );
}
