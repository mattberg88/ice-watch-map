"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { CATEGORIES, type PublicReport } from "@/lib/types";
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

/** Newer reports are more opaque so stale sightings fade out. */
function opacityFor(iso: string) {
  const hours = (Date.now() - Date.parse(iso)) / 3_600_000;
  return Math.max(0.25, 1 - hours / 12);
}

export default function MapView({ reports, center, zoom, draft, picking, flyTo, onPick }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className={`map${picking ? " picking" : ""}`} zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ClickToPick enabled={picking} onPick={onPick} />
      <FlyTo target={flyTo} />

      {reports.map((r) => {
        const cat = CATEGORIES[r.category];
        const opacity = opacityFor(r.observed_at);
        return (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={r.source === "moderator" ? 11 : 9}
            pathOptions={{
              color: r.source === "moderator" ? "#111827" : "#ffffff",
              weight: 2,
              fillColor: cat.color,
              fillOpacity: opacity,
              opacity,
            }}
          >
            <Popup>
              <div className="popup">
                <strong style={{ color: cat.color }}>{cat.label}</strong>
                <div className="popup-meta">
                  {timeAgo(r.observed_at)} · {new Date(r.observed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
                {r.description && <p>{r.description}</p>}
                <span className={`badge ${r.source}`}>{r.source === "moderator" ? "Verified by moderator" : "Community report (reviewed)"}</span>
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
