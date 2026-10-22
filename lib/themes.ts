import { CATEGORIES, type Category } from "./types";

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

/**
 * Raster tiles for browsers without WebGL2: Esri's gray canvas basemaps, which have no terrain or peak
 * symbols. A base layer plus a labels layer, dark or light to match the theme. Tiles stop at zoom 16 and are
 * scaled up past that.
 */
export function fallbackTileUrls(theme: ThemeId) {
  const t = THEMES.find((x) => x.id === theme) ?? THEMES.find((x) => x.id === DEFAULT_THEME)!;
  const tone = t.basemap === "dark" || t.basemap === "fiord" ? "Dark" : "Light";
  const url = (part: string) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${tone}_Gray_${part}/MapServer/tile/{z}/{y}/{x}`;
  return { base: url("Base"), labels: url("Reference") };
}

type Paint = Record<string, unknown>;

/**
 * Per-theme recoloring of the OpenFreeMap style, applied when it loads. Night Watch lifts the stock
 * near-black "dark" style to a softer charcoal that's easier on the eyes.
 */
const STYLE_OVERRIDES: Partial<Record<ThemeId, Record<string, Paint>>> = {
  night: {
    background: { "background-color": "#1b2129" },
    water: { "fill-color": "#152130" },
    waterway: { "line-color": "#152130" },
    water_name: { "text-color": "#6f8597", "text-halo-color": "#152130" },
    landcover_ice_shelf: { "fill-color": "#1b2129" },
    landcover_glacier: { "fill-color": "#1b2129" },
    landuse_residential: { "fill-color": "#1e252e" },
    landcover_wood: { "fill-color": "#1d2825" },
    landuse_park: { "fill-color": "#1d2825" },
    building: { "fill-color": "#232a33", "fill-outline-color": "#2b333e" },
    "aeroway-area": { "fill-color": "#2a323c" },
    "aeroway-runway": { "line-color": "#38424d" },
    "aeroway-taxiway": { "line-color": "#323b45" },
    "aeroway-runway-casing": { "line-color": "rgba(90,100,112,0.6)" },
    road_area_pier: { "fill-color": "#1e252e" },
    road_pier: { "line-color": "#1e252e" },
    highway_path: { "line-color": "#2a323c" },
    highway_minor: { "line-color": "#2e3741" },
    highway_major_casing: { "line-color": "rgba(95,106,118,0.7)" },
    highway_major_inner: { "line-color": "#36404c" },
    highway_major_subtle: { "line-color": "#323c47" },
    highway_motorway_casing: { "line-color": "rgba(105,116,128,0.8)" },
    highway_motorway_inner: { "line-color": "#424c59" },
    highway_motorway_subtle: { "line-color": "#2e3741" },
    railway: { "line-color": "#3c4550" },
    railway_minor: { "line-color": "#3c4550" },
    railway_transit: { "line-color": "#3c4550" },
    railway_dashline: { "line-color": "#1e252e" },
    railway_minor_dashline: { "line-color": "#1e252e" },
    railway_transit_dashline: { "line-color": "#1e252e" },
    highway_name_other: { "text-color": "#8b95a1", "text-halo-color": "#1f252d" },
    highway_name_motorway: { "text-color": "#97a1ad" },
    boundary_state: { "line-color": "#4a5462" },
    "boundary_country_z0-4": { "line-color": "#4a5462" },
    "boundary_country_z5-": { "line-color": "#4a5462" },
    ...Object.fromEntries(
      ["place_other", "place_suburb", "place_village", "place_town", "place_city", "place_city_large", "place_state"].map(
        (id) => [id, { "text-color": "#a6b0bb", "text-halo-color": "rgba(22,26,33,0.85)" }],
      ),
    ),
  },
};

/** Fetches a theme's basemap style and applies its recoloring. Falls back to the plain URL on failure. */
export async function loadBasemapStyle(theme: ThemeId): Promise<string | object> {
  const url = basemapUrl(theme);
  const overrides = STYLE_OVERRIDES[theme];
  if (!overrides) return url;
  try {
    const style = await fetch(url).then((r) => r.json());
    for (const layer of style.layers ?? []) {
      const paint = overrides[layer.id];
      if (paint) layer.paint = { ...layer.paint, ...paint };
    }
    return style;
  } catch {
    return url;
  }
}

/** Softer category colors for dark themes; the defaults in lib/types.ts are tuned for light maps. */
const CATEGORY_COLORS: Partial<Record<ThemeId, Record<Category, string>>> = {
  night: {
    vehicle: "#eaa53a",
    agents: "#e9695a",
    checkpoint: "#a885ea",
    detention: "#e04a68",
    other: "#8d9aab",
  },
};

export function categoryColor(theme: ThemeId, category: Category) {
  return CATEGORY_COLORS[theme]?.[category] ?? CATEGORIES[category].color;
}
