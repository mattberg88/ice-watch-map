"use client";

import { createContext, useContext } from "react";
import type { Category, Verification } from "./types";

/**
 * Interface text in English and Spanish. Report descriptions are shown as written.
 * Rights text is general information, written to match lib/rights content in both languages; have a legal
 * aid group review any change before adding another language.
 */
export type Lang = "en" | "es";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const en = {
  subtitle: "Community reports and other trackers",
  loadingMap: "Loading map…",
  showLast: "Show last",
  windowLabel: (hours: number, label: string | null) => label ?? rangeLabel("en", hours),
  windowStops: ["2 hours", "12 hours", "24 hours", "3 days", "7 days", "14 days", "30 days", "90 days", "6 months", "1 year", "All (since May 2025)"],
  ends: ["2 hours", "All"],
  all: "All",
  howFarBack: "How far back",
  unit: "Unit",
  units: { hours: "hours back", days: "days back", months: "months back" },
  howToReport: "How to report",
  knowYourRights: "Know your rights",
  loadError: "Couldn't load reports. Retrying…",
  count: (n: number, range: string) => `${plural(n, "incident", "incidents")} ${range}`,
  rangeSince: "since May 2025",
  rangeLast: (label: string) => `in the last ${label}`,
  dataUpdated: (ago: string) => `data updated ${ago}`,
  dataUpdatedTitle: (when: string) => `Data last updated ${when}`,
  sources: "Sources",
  filterBySource: "Filter by source",
  sourceGroup: (g: string) => g,
  categories: { vehicle: "Vehicles", agents: "Agents on foot", checkpoint: "Checkpoint", detention: "Arrest / detention", other: "Other" } as Record<Category, string>,
  confirmed: "Confirmed",
  sighting: "Sighting",
  unconfirmedLabel: "Unconfirmed",
  older: "Older than 7 days",
  related: "Related incidents",
  timeAgo: (mins: number) =>
    mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.floor(mins / 60)} hr ago` : `${Math.floor(mins / 1440)} d ago`,
  // Popups
  approx: "Location may not be accurate. Check the source for the reported location.",
  source: "Source",
  relatedHeading: "Related",
  verification: { confirmed: "Confirmed", sighting: "Sighting", unconfirmed: "Unconfirmed", prior: "Earlier incident" } as Record<Verification, string>,
  via: (name: string) => `Via ${name}`,
  anotherTracker: "another tracker",
  verifiedByModerator: "Verified by moderator",
  communityReport: "Community report (reviewed)",
  // How to report
  report: {
    title: "How to report ICE activity",
    intro: "Call the rapid response hotline for the county you're in. Trained responders verify reports, send legal observers, and help people who are detained.",
    hours: { daily6to6: "Daily, 6 AM–6 PM", allDay: "24 hours" } as Record<string, string>,
    tellTitle: "What to tell them",
    tell: [
      "Where: an address, cross streets or a landmark",
      "When it started, and whether it's still happening",
      "What you see: how many agents, vehicles, and any agency markings",
      "Whether anyone has been detained",
    ],
    alertTitle: "Then alert people nearby",
    alertBody: "sends anonymous alerts to people signed up in the area. Reports there are also added to this map.",
    text: "Text REPORT to 877-322-2299",
    online: "Send an alert online",
    back: "Back to map",
  },
  language: "Language",
};

const es: typeof en = {
  subtitle: "Reportes de la comunidad y otros rastreadores",
  loadingMap: "Cargando el mapa…",
  showLast: "Mostrar últimos",
  windowLabel: (hours: number, label: string | null) => label ?? rangeLabel("es", hours),
  windowStops: ["2 horas", "12 horas", "24 horas", "3 días", "7 días", "14 días", "30 días", "90 días", "6 meses", "1 año", "Todo (desde mayo de 2025)"],
  ends: ["2 horas", "Todo"],
  all: "Todo",
  howFarBack: "Cuánto tiempo atrás",
  unit: "Unidad",
  units: { hours: "horas atrás", days: "días atrás", months: "meses atrás" },
  howToReport: "Cómo reportar",
  knowYourRights: "Conozca sus derechos",
  loadError: "No se pudieron cargar los reportes. Reintentando…",
  count: (n: number, range: string) => `${plural(n, "incidente", "incidentes")} ${range}`,
  rangeSince: "desde mayo de 2025",
  rangeLast: (label: string) => `en los últimos ${label}`,
  dataUpdated: (ago: string) => `datos actualizados ${ago}`,
  dataUpdatedTitle: (when: string) => `Datos actualizados por última vez: ${when}`,
  sources: "Fuentes",
  filterBySource: "Filtrar por fuente",
  sourceGroup: (g: string) => (g === "News" ? "Noticias" : g),
  categories: { vehicle: "Vehículos", agents: "Agentes a pie", checkpoint: "Retén", detention: "Arresto / detención", other: "Otro" },
  confirmed: "Confirmado",
  sighting: "Avistamiento",
  unconfirmedLabel: "No confirmado",
  older: "Más de 7 días",
  related: "Incidentes relacionados",
  timeAgo: (mins: number) =>
    mins < 1 ? "ahora mismo" : mins < 60 ? `hace ${mins} min` : mins < 1440 ? `hace ${Math.floor(mins / 60)} h` : `hace ${Math.floor(mins / 1440)} d`,
  approx: "Es posible que la ubicación no sea exacta. Consulte la fuente para ver la ubicación reportada.",
  source: "Fuente",
  relatedHeading: "Relacionado",
  verification: { confirmed: "Confirmado", sighting: "Avistamiento", unconfirmed: "No confirmado", prior: "Incidente anterior" },
  via: (name: string) => `Vía ${name}`,
  anotherTracker: "otro rastreador",
  verifiedByModerator: "Verificado por un moderador",
  communityReport: "Reporte de la comunidad (revisado)",
  report: {
    title: "Cómo reportar actividad de ICE",
    intro: "Llame a la línea de respuesta rápida del condado donde se encuentra. Personas capacitadas verifican los reportes, envían observadores legales y ayudan a las personas detenidas.",
    hours: { daily6to6: "Todos los días, 6 a. m.–6 p. m.", allDay: "24 horas" },
    tellTitle: "Qué decirles",
    tell: [
      "Dónde: una dirección, las calles que se cruzan o un lugar conocido",
      "Cuándo empezó y si todavía está pasando",
      "Qué ve: cuántos agentes y vehículos, y cualquier identificación de la agencia",
      "Si han detenido a alguien",
    ],
    alertTitle: "Después, avise a la gente cercana",
    alertBody: "envía alertas anónimas a las personas inscritas en la zona. Esos reportes también se agregan a este mapa.",
    text: "Envíe REPORT por texto al 877-322-2299",
    online: "Enviar una alerta en línea",
    back: "Volver al mapa",
  },
  language: "Idioma",
};

export const DICTS = { en, es };
export type Dict = typeof en;

function rangeLabel(lang: Lang, hours: number) {
  const words = lang === "es"
    ? { hour: ["hora", "horas"], day: ["día", "días"], month: ["mes", "meses"] }
    : { hour: ["hour", "hours"], day: ["day", "days"], month: ["month", "months"] };
  if (hours < 24) return plural(hours, words.hour[0], words.hour[1]);
  if (hours % 730 === 0) return plural(hours / 730, words.month[0], words.month[1]);
  return plural(Math.round((hours / 24) * 10) / 10, words.day[0], words.day[1]);
}

export const LangContext = createContext<{ lang: Lang; t: Dict }>({ lang: "en", t: en });
export const useT = () => useContext(LangContext);

/** "5 min ago" / "hace 5 min" for a timestamp. */
export function agoText(t: Dict, iso: string, now = Date.now()) {
  return t.timeAgo(Math.max(0, Math.round((now - Date.parse(iso)) / 60_000)));
}
