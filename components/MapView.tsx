"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { setWorkerUrl } from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";
import { CircleMarker, MapContainer, Polyline, Popup, useMap } from "react-leaflet";
import { CATEGORIES, VERIFICATION_LABELS, type PublicReport } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { basemapUrl, categoryColor, loadBasemapStyle, type ThemeId } from "@/lib/themes";

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
  const styleRef = useRef(style);
  styleRef.current = style;

  useEffect(() => {
    const layer = L.maplibreGL({ style: basemapUrl(styleRef.current) });
    layer.options.attribution =
      '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    layer.addTo(map);
    layerRef.current = layer;
    // Leaflet doesn't notice container resizes (phone rotation, panel changes), which leaves the GL canvas half drawn.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(map.getContainer());
    return () => {
      resize.disconnect();
      layerRef.current = null;
      map.removeLayer(layer);
    };
  }, [map]);

  useEffect(() => {
    // Swapping the style is cheaper and safer than removing and re-adding the GL layer.
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

function formatWhen(iso: string) {
  const olderThanADay = Date.now() - Date.parse(iso) > 86_400_000;
  return new Date(iso).toLocaleString([], olderThanADay
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

function badgeText(r: PublicReport) {
  if (r.source === "moderator") return "Verified by moderator";
  if (r.source === "imported") {
    const rating = r.verification ? ` · ${VERIFICATION_LABELS[r.verification]}` : "";
    return `Via ${r.source_name ?? "another tracker"}${rating}`;
  }
  return "Community report (reviewed)";
}

export default function MapView({ reports, center, zoom, basemap }: Props) {
  const groups = useMemo(() => relatedGroups(reports), [reports]);
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
            pathOptions={{ color: "#334155", weight: 2, opacity: 0.7, dashArray: "6 6", className: "related-line" }}
          />
        ) : null,
      )}

      {reports.map((r) => {
        const cat = { ...CATEGORIES[r.category], color: categoryColor(basemap, r.category) };
        const { opacity, stale } = ageStyle(r.observed_at);
        const sourceUrl = r.source_url && /^https?:\/\//i.test(r.source_url) ? r.source_url : null;
        const related = r.related_key ? (groups.get(r.related_key) ?? []).filter((o) => o.id !== r.id) : [];
        // Confirmed reports (moderator-verified or rated confirmed by their source) get a bigger pin,
        // a thick dark ring and a soft halo so they stand out even when old.
        const confirmed = r.source === "moderator" || r.verification === "confirmed";
        const radius = (confirmed ? 12 : 9) - (stale ? 2 : 0);
        return (
          <Fragment key={r.id}>
            {confirmed && (
              <CircleMarker
                center={[r.lat, r.lng]}
                radius={radius + 6}
                interactive={false}
                pathOptions={{ stroke: false, fillColor: cat.color, fillOpacity: stale ? 0.15 : 0.25 }}
              />
            )}
          <CircleMarker
            center={[r.lat, r.lng]}
            radius={radius}
            pathOptions={{
              color: confirmed ? "#111827" : "#ffffff",
              // Themes can recolor the confirmed ring via CSS (dark maps need a light ring).
              className: confirmed ? "pin-confirmed" : undefined,
              weight: confirmed ? 3 : stale ? 1 : 2,
              fillColor: cat.color,
              fillOpacity: opacity,
              opacity: confirmed ? Math.max(opacity, 0.8) : stale ? 0.7 : opacity,
            }}
          >
            <Popup>
              <div className="popup">
                <strong style={{ color: cat.color }}>{cat.label}</strong>
                <div className="popup-meta">
                  {timeAgo(r.observed_at)} · {formatWhen(r.observed_at)}
                </div>
                {r.location_approximate && (
                  <div className="popup-approx">Location may not be accurate. Check the source for the reported location.</div>
                )}
                {r.description && <p>{r.description}</p>}
                <span className={`badge ${r.source} ${r.verification ?? ""}`}>{badgeText(r)}</span>
                {sourceUrl && (
                  <a className="popup-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source
                  </a>
                )}
                {related.length > 0 && (
                  <div className="popup-related">
                    <strong>Related</strong>
                    <ul>
                      {related.map((o) => (
                        <li key={o.id}>
                          {formatWhen(o.observed_at)}: {o.description.slice(0, 90)}
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
