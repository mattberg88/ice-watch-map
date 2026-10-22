/**
 * Visual themes. Night Watch is the default; add `?styles` to the URL to show a picker, or `?style=<id>` to load one.
 * Each theme sets `data-theme` on the app root (see globals.css) and picks an OpenFreeMap basemap.
 */
export const THEMES = [
  { id: "night", label: "Night Watch (default)", basemap: "dark" },
  { id: "classic", label: "Light", basemap: "positron" },
  { id: "civic", label: "Civic Alert", basemap: "positron" },
  { id: "newsprint", label: "Newsprint", basemap: "positron" },
  { id: "glass", label: "Floating Glass", basemap: "bright" },
  { id: "fiord", label: "Harbor", basemap: "fiord" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "night";

export function basemapUrl(theme: ThemeId) {
  const t = THEMES.find((x) => x.id === theme) ?? THEMES.find((x) => x.id === DEFAULT_THEME)!;
  return `https://tiles.openfreemap.org/styles/${t.basemap}`;
}
