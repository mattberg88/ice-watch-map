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

type Paint = Record<string, unknown>;

/**
 * Per-theme recoloring of the OpenFreeMap style, applied when it loads. Night Watch lifts the stock
 * near-black "dark" style to a softer charcoal that's easier on the eyes.
 */
const STYLE_OVERRIDES: Partial<Record<ThemeId, Record<string, Paint>>> = {
  night: {
    background: { "background-color": "#232a33" },
    water: { "fill-color": "#1c2935" },
    waterway: { "line-color": "#1c2935" },
    water_name: { "text-color": "#6f8597", "text-halo-color": "#1c2935" },
    landcover_ice_shelf: { "fill-color": "#232a33" },
    landcover_glacier: { "fill-color": "#232a33" },
    landuse_residential: { "fill-color": "#262e38" },
    landcover_wood: { "fill-color": "#25302d" },
    landuse_park: { "fill-color": "#25302d" },
    building: { "fill-color": "#2b333d", "fill-outline-color": "#333c47" },
    "aeroway-area": { "fill-color": "#2a323c" },
    "aeroway-runway": { "line-color": "#38424d" },
    "aeroway-taxiway": { "line-color": "#323b45" },
    "aeroway-runway-casing": { "line-color": "rgba(90,100,112,0.6)" },
    road_area_pier: { "fill-color": "#262e38" },
    road_pier: { "line-color": "#262e38" },
    highway_path: { "line-color": "#323b46" },
    highway_minor: { "line-color": "#36404b" },
    highway_major_casing: { "line-color": "rgba(95,106,118,0.7)" },
    highway_major_inner: { "line-color": "#3e4855" },
    highway_major_subtle: { "line-color": "#3a4450" },
    highway_motorway_casing: { "line-color": "rgba(105,116,128,0.8)" },
    highway_motorway_inner: { "line-color": "#4a5563" },
    highway_motorway_subtle: { "line-color": "#36404b" },
    railway: { "line-color": "#3c4550" },
    railway_minor: { "line-color": "#3c4550" },
    railway_transit: { "line-color": "#3c4550" },
    railway_dashline: { "line-color": "#262e38" },
    railway_minor_dashline: { "line-color": "#262e38" },
    railway_transit_dashline: { "line-color": "#262e38" },
    highway_name_other: { "text-color": "#8b95a1", "text-halo-color": "#1f252d" },
    highway_name_motorway: { "text-color": "#97a1ad" },
    boundary_state: { "line-color": "#4a5462" },
    "boundary_country_z0-4": { "line-color": "#4a5462" },
    "boundary_country_z5-": { "line-color": "#4a5462" },
    ...Object.fromEntries(
      ["place_other", "place_suburb", "place_village", "place_town", "place_city", "place_city_large", "place_state"].map(
        (id) => [id, { "text-color": "#a6b0bb", "text-halo-color": "rgba(27,32,40,0.85)" }],
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
