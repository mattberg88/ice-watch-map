"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { CATEGORIES, VERIFICATION_LABELS, type PublicReport } from "@/lib/types";
import { timeAgo } from "@/lib/format";

interface Props {
  reports: PublicReport[];
  center: [number, number];
  zoom: number;
  draft: { lat: number; lng: number } | null;
  picking: boolean;
  flyTo: { lat: number; lng: number; key: number } | null;
  onPick: (lat: number, lng: number) => void;
}

function ClickToPick({ enabled, onPick }: { enabled: boolean; onPick: Props["onPick"] }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ target }: { target: Props["flyTo"] }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, target]);
  return null;
}

const FRESH_HOURS = 72;

/** Reports fade over their first 3 days; anything older stays as a faint ghost pin. */
function ageStyle(iso: string) {
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (hours > FRESH_HOURS) return { opacity: 0.3, stale: true };
  return { opacity: Math.max(0.45, 1 - (hours / FRESH_HOURS) * 0.55), stale: false };
}

function badgeText(r: PublicReport) {
  if (r.source === "moderator") return "Verified by moderator";
  if (r.source === "imported") {
    const rating = r.verification ? ` · ${VERIFICATION_LABELS[r.verification]}` : "";
    return `Via ${r.source_name ?? "another tracker"}${rating}`;
  }
  return "Community report (reviewed)";
}

export default function MapView({ reports, center, zoom, draft, picking, flyTo, onPick }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className={`map${picking ? " picking" : ""}`} zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        // OSM blocks tile requests with no Referer. The site-wide policy is no-referrer,
        // so send just the origin (never the page path) for tiles only.
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <ClickToPick enabled={picking} onPick={onPick} />
      <FlyTo target={flyTo} />

      {reports.map((r) => {
        const cat = CATEGORIES[r.category];
        const { opacity, stale } = ageStyle(r.observed_at);
        const sourceUrl = r.source_url && /^https?:\/\//i.test(r.source_url) ? r.source_url : null;
        return (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={(r.source === "moderator" ? 11 : 9) - (stale ? 3 : 0)}
            pathOptions={{
              color: r.source === "moderator" ? "#111827" : "#ffffff",
              weight: stale ? 1 : 2,
              fillColor: cat.color,
              fillOpacity: opacity,
              opacity: stale ? 0.5 : opacity,
            }}
          >
            <Popup>
              <div className="popup">
                <strong style={{ color: cat.color }}>{cat.label}</strong>
                <div className="popup-meta">
                  {timeAgo(r.observed_at)} ·{" "}
                  {new Date(r.observed_at).toLocaleString([], stale
                    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                    : { hour: "numeric", minute: "2-digit" })}
                </div>
                {r.description && <p>{r.description}</p>}
                <span className={`badge ${r.source} ${r.verification ?? ""}`}>{badgeText(r)}</span>
                {sourceUrl && (
                  <a className="popup-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source
                  </a>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {draft && (
        <CircleMarker
          center={[draft.lat, draft.lng]}
          radius={12}
          pathOptions={{ color: "#2563eb", weight: 3, dashArray: "4 4", fillColor: "#3b82f6", fillOpacity: 0.3 }}
        />
      )}
    </MapContainer>
  );
}
