/**
 * Visual themes being trialled. Add `?styles` to the URL to show a picker, or `?style=<id>` to load one.
 * Each theme sets `data-theme` on the app root (see globals.css) and picks an OpenFreeMap basemap.
 */
export const THEMES = [
  { id: "classic", label: "Current", basemap: "positron" },
  { id: "night", label: "1 · Night Watch", basemap: "dark" },
  { id: "civic", label: "2 · Civic Alert", basemap: "positron" },
  { id: "newsprint", label: "3 · Newsprint", basemap: "positron" },
  { id: "glass", label: "4 · Floating Glass", basemap: "bright" },
  { id: "fiord", label: "5 · Harbor", basemap: "fiord" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function basemapUrl(theme: ThemeId) {
  const t = THEMES.find((x) => x.id === theme) ?? THEMES[0];
  return `https://tiles.openfreemap.org/styles/${t.basemap}`;
}
