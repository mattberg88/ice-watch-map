"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import ReportHelp from "./ReportHelp";
import KnowYourRights from "./KnowYourRights";
import { CATEGORY_KEYS, type PublicReport } from "@/lib/types";
import { DICTS, LANGS, LangContext, agoText, type Dict, type Lang } from "@/lib/i18n";
import { DEFAULT_THEME, THEMES, categoryColor, type ThemeId } from "@/lib/themes";
import { SOURCE_ORDER, sourceGroups } from "@/lib/sources";

// Leaflet touches `window`, so the map only renders in the browser.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map map-loading">…</div>,
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

/** Label for a time window in the current language: a slider stop's name, or e.g. "45 days". */
function windowText(t: Dict, hours: number) {
  const i = WINDOWS.findIndex((w) => w.hours === hours);
  return t.windowLabel(hours, i >= 0 ? t.windowStops[i] : null);
}

/** "in the last 30 days" / "since May 2025", for the count under the slider. */
function rangePhrase(t: Dict, hours: number) {
  return hours >= MAX_HOURS ? t.rangeSince : t.rangeLast(windowText(t, hours));
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
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  const [rightsOpen, setRightsOpen] = useState(false);
  // English by default; Spanish when the browser prefers it or the visitor chose it before.
  const [lang, setLang] = useState<Lang>("en");
  const t = DICTS[lang];

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("lang");
    } catch {}
    const preferred = saved === "en" || saved === "es" ? saved : navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
    setLang(preferred);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function chooseLang(next: Lang) {
    setLang(next);
    try {
      localStorage.setItem("lang", next);
    } catch {}
  }

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
  const windowLabel = windowText(t, pendingHours);

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

  // Source filter: everything is shown unless its source group is switched off.
  const sourceCounts = new Map<string, number>();
  for (const r of reports) for (const g of sourceGroups(r)) sourceCounts.set(g, (sourceCounts.get(g) ?? 0) + 1);
  const visible = reports.filter((r) => sourceGroups(r).some((g) => !hiddenSources.has(g)));

  function toggleSource(group: string) {
    setHiddenSources((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  const counts = CATEGORY_KEYS.map((key) => ({ key, n: visible.filter((r) => r.category === key).length }));

  return (
    <LangContext.Provider value={{ lang, t }}>
    <div className="app" data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <h1>{appName}</h1>
          <span className="sub">{t.subtitle}</span>
        </div>
        <div className="lang-switch" role="group" aria-label={t.language}>
          {LANGS.map((l) => (
            <button key={l.id} className={l.id === lang ? "active" : ""} aria-pressed={l.id === lang} onClick={() => chooseLang(l.id)} lang={l.id}>
              {l.label}
            </button>
          ))}
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
          reports={visible}
          center={center}
          zoom={zoom}
          basemap={theme}
        />

        <aside className="panel">
          {helpOpen ? (
            <ReportHelp onClose={() => setHelpOpen(false)} />
          ) : rightsOpen ? (
            <KnowYourRights onClose={() => setRightsOpen(false)} />
          ) : (
            <>
              <div className="panel-row">
                <label className="window">
                  <span className="window-head">
                    {t.showLast} <strong>{windowLabel}</strong>
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
                      <option key={w.hours} value={i} label={t.windowStops[i]} />
                    ))}
                  </datalist>
                  <span className="window-ends">
                    <span>{t.ends[0]}</span>
                    <span>{t.ends[1]}</span>
                  </span>
                </label>
                <div className="days-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountText}
                    placeholder={t.all}
                    onChange={(e) => applyAmount(e.target.value.replace(/[^\d.]/g, ""), unit)}
                    aria-label={t.howFarBack}
                  />
                  <select value={unit} onChange={(e) => applyAmount(amountText, e.target.value as Unit)} aria-label={t.unit}>
                    <option value="hours">{t.units.hours}</option>
                    <option value="days">{t.units.days}</option>
                    <option value="months">{t.units.months}</option>
                  </select>
                </div>
                <button className="btn primary" onClick={() => { setRightsOpen(false); setHelpOpen(true); }}>
                  {t.howToReport}
                </button>
                <button className="btn rights-btn" onClick={() => { setHelpOpen(false); setRightsOpen(true); }}>
                  {t.knowYourRights}
                </button>
              </div>

              <p className="status" title={lastUpdated ? t.dataUpdatedTitle(new Date(lastUpdated).toLocaleString(lang)) : undefined}>
                {loadError
                  ? t.loadError
                  : `${t.count(visible.length, rangePhrase(t, hours))}${lastUpdated ? ` · ${t.dataUpdated(agoText(t, lastUpdated))}` : ""}`}
              </p>
              <p className="disclaimer">{t.disclaimer}</p>

              {sourceCounts.size > 0 && (
                <div className="sources" role="group" aria-label={t.filterBySource}>
                  <span className="sources-label">{t.sources}</span>
                  <div className="chips">
                    {SOURCE_ORDER.filter((g) => sourceCounts.has(g))
                      .concat([...sourceCounts.keys()].filter((g) => !SOURCE_ORDER.includes(g)))
                      .map((g) => (
                        <button
                          key={g}
                          className={`chip${hiddenSources.has(g) ? " off" : ""}`}
                          aria-pressed={!hiddenSources.has(g)}
                          onClick={() => toggleSource(g)}
                        >
                          {t.sourceGroup(g)} <span className="chip-count">{sourceCounts.get(g)}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <ul className="legend">
                {counts.map(({ key, n }) => (
                  <li key={key}>
                    <span className="dot" style={{ background: categoryColor(theme, key) }} />
                    {t.categories[key]}
                    <span className="count">{n}</span>
                  </li>
                ))}
                <li className="legend-key">
                  <span className="dot ring" />
                  {t.confirmed}
                  <span className="count">{reports.filter((r) => r.source === "moderator" || r.verification === "confirmed").length}</span>
                </li>
                <li className="legend-key">
                  <span className="dot solid" />
                  {t.sighting}
                  <span className="count">{visible.filter((r) => r.verification === "sighting" || r.verification === "prior").length}</span>
                </li>
                <li className="legend-key">
                  <span className="dot hollow" />
                  {t.unconfirmedLabel}
                  <span className="count">{visible.filter((r) => r.verification === "unconfirmed").length}</span>
                </li>
                <li className="legend-key">
                  <span className="dot faint" />
                  {t.older}
                </li>
                <li className="legend-key">
                  <span className="dot glow" />
                  {t.glow}
                </li>
                <li className="legend-key">
                  <span className="line" />
                  {t.related}
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
    </LangContext.Provider>
  );
}
