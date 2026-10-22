"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import ReportHelp from "./ReportHelp";
import { CATEGORIES, CATEGORY_KEYS, type PublicReport } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { DEFAULT_THEME, THEMES, categoryColor, type ThemeId } from "@/lib/themes";

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map map-loading">Loading map…</div>,
});

// Stops for the time-range slider, short ranges first.
const WINDOWS = [
  { hours: 2, label: "2 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
  { hours: 336, label: "14 days" },
  { hours: 720, label: "30 days" },
  { hours: 2160, label: "90 days" },
  { hours: 4380, label: "6 months" },
  { hours: 8760, label: "1 year" },
  // The API caps this at its own maximum; imported history starts in May 2025.
  { hours: 3 * 8760, label: "All (since May 2025)" },
];
const DEFAULT_STOP = WINDOWS.findIndex((w) => w.hours === 720);
const MAX_HOURS = WINDOWS[WINDOWS.length - 1].hours;

// Units for the typed range. A month is 730 hours (365 / 12 days), so 6 months and 1 year match slider stops.
const UNITS = { hours: 1, days: 24, months: 730 } as const;
type Unit = keyof typeof UNITS;

/** Express a slider value in the most natural unit for the typed box. */
function toAmount(hours: number): { amount: string; unit: Unit } {
  if (hours >= MAX_HOURS) return { amount: "", unit: "months" };
  if (hours < 24) return { amount: String(hours), unit: "hours" };
  if (hours < 60 * 24 || hours % UNITS.months !== 0) return { amount: String(Math.round(hours / 24)), unit: "days" };
  return { amount: String(hours / UNITS.months), unit: "months" };
}

/** Slider position closest to an arbitrary number of hours (for values typed into the days box). */
function nearestStop(hours: number) {
  let best = 0;
  for (let i = 1; i < WINDOWS.length; i++) {
    if (Math.abs(Math.log(WINDOWS[i].hours / hours)) < Math.abs(Math.log(WINDOWS[best].hours / hours))) best = i;
  }
  return best;
}

function formatRange(hours: number) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (hours < 24) return plural(hours, "hour");
  if (hours % UNITS.months === 0) return plural(hours / UNITS.months, "month");
  return plural(Math.round((hours / 24) * 10) / 10, "day");
}
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
  // The slider and the days box both set `pendingHours` immediately; `hours` (which triggers a fetch)
  // follows once input settles.
  const [pendingHours, setPendingHours] = useState(WINDOWS[DEFAULT_STOP].hours);
  const [hours, setHours] = useState(WINDOWS[DEFAULT_STOP].hours);
  const [amountText, setAmountText] = useState(toAmount(WINDOWS[DEFAULT_STOP].hours).amount);
  const [unit, setUnit] = useState<Unit>(toAmount(WINDOWS[DEFAULT_STOP].hours).unit);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  // Reports are made to county hotlines, not on this site.
  const [helpOpen, setHelpOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports?hours=${hours}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { reports: PublicReport[]; syncedAt: string | null };
      setReports(data.reports);
      setLoadError(false);
      setLastUpdated(data.syncedAt);
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
    const id = setTimeout(() => setHours(pendingHours), 300);
    return () => clearTimeout(id);
  }, [pendingHours]);

  const stop = nearestStop(pendingHours);
  const windowLabel = WINDOWS.find((w) => w.hours === pendingHours)?.label ?? formatRange(pendingHours);

  function onSlide(index: number) {
    const h = WINDOWS[index].hours;
    setPendingHours(h);
    const next = toAmount(h);
    setAmountText(next.amount);
    setUnit(next.unit);
  }

  function applyAmount(text: string, nextUnit: Unit) {
    setAmountText(text);
    setUnit(nextUnit);
    const n = Number(text);
    if (text.trim() !== "" && Number.isFinite(n) && n > 0) {
      setPendingHours(Math.min(Math.max(1, Math.round(n * UNITS[nextUnit])), MAX_HOURS));
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("style");
    if (requested && THEMES.some((t) => t.id === requested)) setTheme(requested as ThemeId);
    setShowStylePicker(params.has("styles") || params.has("style"));
  }, []);

  const counts = CATEGORY_KEYS.map((key) => ({ key, n: reports.filter((r) => r.category === key).length }));

  return (
    <div className="app" data-theme={theme}>
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
          basemap={theme}
        />

        <aside className="panel">
          {helpOpen ? (
            <ReportHelp onClose={() => setHelpOpen(false)} />
          ) : (
            <>
              <div className="panel-row">
                <label className="window">
                  <span className="window-head">
                    Show last <strong>{windowLabel}</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={WINDOWS.length - 1}
                    step={1}
                    value={stop}
                    onChange={(e) => onSlide(Number(e.target.value))}
                    aria-valuetext={windowLabel}
                    list="window-stops"
                  />
                  <datalist id="window-stops">
                    {WINDOWS.map((w, i) => (
                      <option key={w.hours} value={i} label={w.label} />
                    ))}
                  </datalist>
                  <span className="window-ends">
                    <span>2 hours</span>
                    <span>All</span>
                  </span>
                </label>
                <div className="days-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountText}
                    placeholder="All"
                    onChange={(e) => applyAmount(e.target.value.replace(/[^\d.]/g, ""), unit)}
                    aria-label="How far back"
                  />
                  <select value={unit} onChange={(e) => applyAmount(amountText, e.target.value as Unit)} aria-label="Unit">
                    <option value="hours">hours back</option>
                    <option value="days">days back</option>
                    <option value="months">months back</option>
                  </select>
                </div>
                <button className="btn primary" onClick={() => setHelpOpen(true)}>
                  How to report
                </button>
              </div>

              <p className="status" title={lastUpdated ? `Data last updated ${new Date(lastUpdated).toLocaleString()}` : undefined}>
                {loadError
                  ? "Couldn't load reports. Retrying…"
                  : `${reports.length} report${reports.length === 1 ? "" : "s"}${lastUpdated ? ` · data updated ${timeAgo(lastUpdated)}` : ""}`}
              </p>

              <ul className="legend">
                {counts.map(({ key, n }) => (
                  <li key={key}>
                    <span className="dot" style={{ background: categoryColor(theme, key) }} />
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
            </>
          )}
        </aside>
      </main>

      {showStylePicker && (
        <div className="style-picker" role="group" aria-label="Preview styles">
          {THEMES.map((t) => (
            <button key={t.id} className={t.id === theme ? "active" : ""} onClick={() => setTheme(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
