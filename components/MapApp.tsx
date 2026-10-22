"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import ReportForm from "./ReportForm";
import { CATEGORIES, CATEGORY_KEYS, type PublicReport } from "@/lib/types";
import { timeAgo } from "@/lib/format";

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map map-loading">Loading map…</div>,
});

const WINDOWS = [
  { hours: 2, label: "2 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
  { hours: 2160, label: "90 days" },
  { hours: 4380, label: "6 months" },
  { hours: 8760, label: "1 year" },
  // The API caps this at its own maximum; imported history starts in May 2025.
  { hours: 3 * 8760, label: "All (since May 2025)" },
];
const REFRESH_MS = 60_000;

interface Props {
  appName: string;
  center: [number, number];
  zoom: number;
  hotlineLabel: string;
  hotlineNumber: string;
}

export default function MapApp({ appName, center, zoom, hotlineLabel, hotlineNumber }: Props) {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [hours, setHours] = useState(720);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports?hours=${hours}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { reports: PublicReport[] };
      setReports(data.reports);
      setLoadError(false);
      setLastUpdated(new Date().toISOString());
    } catch {
      setLoadError(true);
    }
  }, [hours]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.admin)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  function locate() {
    if (!navigator.geolocation) {
      setToast("Location isn't available in this browser. Tap the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDraft(point);
        setFlyTo({ ...point, key: Date.now() });
        setLocating(false);
      },
      () => {
        setToast("Couldn't get your location. Tap the map instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function closeForm() {
    setFormOpen(false);
    setDraft(null);
  }

  function handleSubmitted(published: boolean) {
    closeForm();
    setToast(published ? "Published to the map." : "Thanks. Your report will appear once a moderator reviews it.");
    if (published) load();
  }

  const counts = CATEGORY_KEYS.map((key) => ({ key, n: reports.filter((r) => r.category === key).length }));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>{appName}</h1>
          <span className="sub">Community reports and other trackers</span>
        </div>
        {hotlineNumber && (
          <a className="hotline" href={`tel:${hotlineNumber.replace(/[^\d+]/g, "")}`}>
            <span>{hotlineLabel}</span>
            <strong>{hotlineNumber}</strong>
          </a>
        )}
      </header>

      <main className="main">
        <MapView
          reports={reports}
          center={center}
          zoom={zoom}
          draft={draft}
          picking={formOpen}
          flyTo={flyTo}
          onPick={(lat, lng) => setDraft({ lat, lng })}
        />

        <aside className="panel">
          {formOpen ? (
            <ReportForm
              draft={draft}
              isAdmin={isAdmin}
              onLocate={locate}
              locating={locating}
              onCancel={closeForm}
              onSubmitted={handleSubmitted}
            />
          ) : (
            <>
              <div className="panel-row">
                <label className="window">
                  Show last
                  <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {WINDOWS.map((w) => (
                      <option key={w.hours} value={w.hours}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn primary" onClick={() => setFormOpen(true)}>
                  + Report
                </button>
              </div>

              <p className="status">
                {loadError
                  ? "Couldn't load reports. Retrying…"
                  : `${reports.length} report${reports.length === 1 ? "" : "s"}${lastUpdated ? ` · updated ${timeAgo(lastUpdated)}` : ""}`}
              </p>

              <ul className="legend">
                {counts.map(({ key, n }) => (
                  <li key={key}>
                    <span className="dot" style={{ background: CATEGORIES[key].color }} />
                    {CATEGORIES[key].label}
                    <span className="count">{n}</span>
                  </li>
                ))}
                <li className="legend-key">
                  <span className="dot ring" />
                  Confirmed
                  <span className="count">{reports.filter((r) => r.source === "moderator" || r.verification === "confirmed").length}</span>
                </li>
                <li className="legend-key">
                  <span className="dot faint" />
                  Older than 7 days
                </li>
                <li className="legend-key">
                  <span className="line" />
                  Related incidents
                </li>
              </ul>

              <footer className="foot">
                <a href="/admin">Moderator login</a>
              </footer>
            </>
          )}
        </aside>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
