"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { setWorkerUrl } from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";
import { CircleMarker, MapContainer, Pane, Polyline, Popup, useMap } from "react-leaflet";
import { CATEGORIES, type PublicReport } from "@/lib/types";
import { agoText, useT, type Dict, type Lang } from "@/lib/i18n";
import { basemapUrl, categoryColor, fallbackTileUrls, loadBasemapStyle, type ThemeId } from "@/lib/themes";
import { PIN_PANES, pinPane } from "@/lib/sources";

interface Props {
  reports: PublicReport[];
  center: [number, number];
  zoom: number;
  /** Selected theme; picks and recolors the OpenFreeMap basemap. */
  basemap: ThemeId;
}

// Keep the map on the Bay Area: no zooming out past the region or panning away from it. The bounds reach
// past the outermost reports so popups near the edges can still pan fully into view.
const BAY_AREA_BOUNDS: [[number, number], [number, number]] = [
  [36.55, -123.6],
  [39.0, -121.05],
];
const MIN_ZOOM = 9;

// Copied into public/ by scripts/copy-maplibre-worker.mjs; the bundler can't serve it.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/** OpenFreeMap vector basemap: free, no API key. The style swaps in place when the theme changes. */
function Basemap({ style }: { style: ThemeId }) {
  const map = useMap();
  const layerRef = useRef<L.MaplibreGL | null>(null);
  const rasterRef = useRef<{ base: L.TileLayer; labels: L.TileLayer } | null>(null);
  const styleRef = useRef(style);
  styleRef.current = style;

  useEffect(() => {
    const layer = L.maplibreGL({ style: basemapUrl(styleRef.current) });
    layer.options.attribution =
      '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    let base: L.Layer = layer;
    try {
      // MapLibre needs WebGL2, which some computers have turned off (no hardware acceleration, blocked
      // graphics drivers) and older browsers lack. Without it, adding the layer throws and takes the page down.
      if (!document.createElement("canvas").getContext("webgl2")) throw new Error("WebGL2 unavailable");
      layer.addTo(map);
      layerRef.current = layer;
    } catch (e) {
      // Fall back to raster tiles so the pins still show.
      console.warn("Vector basemap unavailable, using raster tiles:", e);
      try {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      } catch {} // a half-initialized GL layer can throw on removal
      const urls = fallbackTileUrls(styleRef.current);
      const options: L.TileLayerOptions = { maxNativeZoom: 16, maxZoom: 20, referrerPolicy: "strict-origin-when-cross-origin" };
      const raster = {
        base: L.tileLayer(urls.base, {
          ...options,
          attribution:
            'Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        }),
        labels: L.tileLayer(urls.labels, options),
      };
      rasterRef.current = raster;
      base = L.layerGroup([raster.base, raster.labels]).addTo(map);
    }
    // Leaflet doesn't notice container resizes (phone rotation, panel changes), which leaves the GL canvas half drawn.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(map.getContainer());
    return () => {
      resize.disconnect();
      layerRef.current = null;
      rasterRef.current = null;
      try {
        map.removeLayer(base);
      } catch {}
    };
  }, [map]);

  useEffect(() => {
    // Swapping the style is cheaper and safer than removing and re-adding the GL layer.
    if (rasterRef.current) {
      const urls = fallbackTileUrls(style);
      rasterRef.current.base.setUrl(urls.base);
      rasterRef.current.labels.setUrl(urls.labels);
    }
    let cancelled = false;
    loadBasemapStyle(style).then((resolved) => {
      if (!cancelled) layerRef.current?.getMaplibreMap()?.setStyle(resolved as never);
    });
    return () => {
      cancelled = true;
    };
  }, [style]);

  return null;
}

const FRESH_HOURS = 7 * 24;

/** Reports from the last 7 days are solid; anything older is a faint ghost pin. */
function ageStyle(iso: string) {
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000;
  return hours > FRESH_HOURS ? { opacity: 0.5, stale: true } : { opacity: 0.95, stale: false };
}

function formatWhen(iso: string, lang: Lang) {
  const olderThanADay = Date.now() - Date.parse(iso) > 86_400_000;
  return new Date(iso).toLocaleString(lang, olderThanADay
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { hour: "numeric", minute: "2-digit" });
}

/** Reports sharing a related_key, oldest first, so they can be joined with a line. */
function relatedGroups(reports: PublicReport[]) {
  const groups = new Map<string, PublicReport[]>();
  for (const r of reports) {
    if (!r.related_key) continue;
    groups.set(r.related_key, [...(groups.get(r.related_key) ?? []), r]);
  }
  for (const list of groups.values()) list.sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
  return groups;
}

/**
 * Pin look by how the source rated the report, so the three read differently at a glance:
 * confirmed = large, solid, light ring (plus a halo); reported (sighting / earlier incident) = solid with a
 * thin dark edge; unconfirmed = smaller, hollow, dashed outline.
 */
function pinStyle(kind: "confirmed" | "reported" | "unconfirmed", color: string, opacity: number, stale: boolean) {
  const shrink = stale ? 2 : 0;
  if (kind === "confirmed") {
    return {
      radius: 12 - shrink,
      // Passed as its own prop: Leaflet reads className only when it creates the shape, not from pathOptions updates.
      className: "pin-confirmed",
      // Themes can recolor the confirmed ring via CSS (dark maps need a light ring).
      path: { color: "#111827", weight: 3, fillColor: color, fillOpacity: opacity, opacity: Math.max(opacity, 0.8) },
    };
  }
  if (kind === "unconfirmed") {
    return {
      radius: 8 - shrink,
      path: { color, weight: 2.5, dashArray: "4 3", fillColor: color, fillOpacity: opacity * 0.35, opacity: Math.max(opacity, 0.75) },
    };
  }
  return {
    radius: 9 - shrink,
    path: { color: "#0b0f14", weight: 1.5, fillColor: color, fillOpacity: opacity, opacity: Math.max(opacity, 0.6) },
  };
}

/**
 * Soft glow rings for pins that stand for several merged reports: more reports, a wider and brighter glow
 * (capped at 4). Three stacked translucent circles read as a gradient. Confirmed single reports keep their halo.
 */
function glowRings(count: number, confirmed: boolean, radius: number, stale: boolean) {
  const level = Math.min(Math.max(count, 1), 4) - 1;
  if (level === 0) return confirmed ? [{ radius: radius + 6, opacity: stale ? 0.15 : 0.25 }] : [];
  const fade = stale ? 0.55 : 1;
  const reach = 6 + level * 6;
  return [1, 2 / 3, 1 / 3].map((f) => ({ radius: radius + reach * f, opacity: (0.16 + 0.08 * level) * fade }));
}

function badgeText(r: PublicReport, t: Dict) {
  if (r.source === "moderator") return t.verifiedByModerator;
  if (r.source === "imported") {
    const rating = r.verification ? ` · ${t.verification[r.verification]}` : "";
    const name = (r.source_name ?? t.anotherTracker).replace(/^News: /, t.sourceGroup("News") + ": ");
    return `${t.via(name)}${rating}`;
  }
  return t.communityReport;
}

export default function MapView({ reports, center, zoom, basemap }: Props) {
  const groups = useMemo(() => relatedGroups(reports), [reports]);
  const { lang, t } = useT();
  return (
    <MapContainer
      center={center}
      zoom={Math.max(zoom, MIN_ZOOM)}
      minZoom={MIN_ZOOM}
      maxBounds={BAY_AREA_BOUNDS}
      maxBoundsViscosity={1}
      className="map"
      zoomControl
    >
      <Basemap style={basemap} />

      {[...groups].map(([key, list]) =>
        list.length > 1 ? (
          <Polyline
            key={key}
            positions={list.map((r) => [r.lat, r.lng] as [number, number])}
            className="related-line"
            pathOptions={{ color: "#334155", weight: 2, opacity: 0.7, dashArray: "6 6" }}
          />
        ) : null,
      )}

      {/* One pane per source tier so news pins draw above People Over Papers, which draw above StopICE. */}
      {PIN_PANES.map((p) => (
        <Pane key={p.name} name={p.name} style={{ zIndex: p.zIndex }} />
      ))}

      {reports.map((r) => {
        const cat = { ...CATEGORIES[r.category], label: t.categories[r.category], color: categoryColor(basemap, r.category) };
        const pane = pinPane(r);
        const { opacity, stale } = ageStyle(r.observed_at);
        const sourceUrl = r.source_url && /^https?:\/\//i.test(r.source_url) ? r.source_url : null;
        const related = r.related_key ? (groups.get(r.related_key) ?? []).filter((o) => o.id !== r.id) : [];
        // Confirmed reports (moderator-verified or rated confirmed by their source) get a bigger pin,
        // a thick dark ring and a soft halo so they stand out even when old.
        const confirmed = r.source === "moderator" || r.verification === "confirmed";
        const unconfirmed = !confirmed && r.verification === "unconfirmed";
        const style = pinStyle(confirmed ? "confirmed" : unconfirmed ? "unconfirmed" : "reported", cat.color, opacity, stale);
        return (
          <Fragment key={r.id}>
            {glowRings(r.report_count, confirmed, style.radius, stale).map((g, i) => (
              <CircleMarker
                key={i}
                center={[r.lat, r.lng]}
                radius={g.radius}
                pane={pane}
                interactive={false}
                pathOptions={{ stroke: false, fillColor: cat.color, fillOpacity: g.opacity }}
              />
            ))}
          <CircleMarker
            center={[r.lat, r.lng]}
            radius={style.radius}
            pane={pane}
            className={style.className}
            pathOptions={{
              ...style.path,
            }}
          >
            <Popup>
              <div className="popup">
                <strong style={{ color: cat.color }}>{cat.label}</strong>
                <div className="popup-meta">
                  {agoText(t, r.observed_at)} · {formatWhen(r.observed_at, lang)}
                </div>
                {r.location_approximate && (
                  <div className="popup-approx">{t.approx}</div>
                )}
                {r.description && <p>{r.description}</p>}
                {r.report_count > 1 && <div className="popup-count">{t.reportCount(r.report_count)}</div>}
                <span className={`badge ${r.source} ${r.verification ?? ""}`}>{badgeText(r, t)}</span>
                {sourceUrl && (
                  <a className="popup-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    {t.source}
                  </a>
                )}
                {related.length > 0 && (
                  <div className="popup-related">
                    <strong>{t.relatedHeading}</strong>
                    <ul>
                      {related.map((o) => (
                        <li key={o.id}>
                          {formatWhen(o.observed_at, lang)}: {o.description.slice(0, 90)}
                          {o.description.length > 90 ? "…" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
          </Fragment>
        );
      })}

    </MapContainer>
  );
}
