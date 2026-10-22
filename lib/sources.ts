import type { PublicReport } from "./types";

/** Source groups in filter order. Pins stack in reverse: news on top, then People Over Papers, then StopICE. */
export const SOURCE_ORDER = ["News", "People Over Papers", "StopICE", "Mission Local"];

/** Groups a report's source(s) for filtering and stacking: "Mission Local + StopICE" belongs to both. */
export function sourceGroups(r: PublicReport): string[] {
  if (r.source !== "imported" || !r.source_name) return ["This site"];
  return r.source_name.split(" + ").map((name) => {
    if (name.startsWith("StopICE")) return "StopICE";
    if (name.startsWith("News")) return "News";
    if (name.startsWith("People Over Papers")) return "People Over Papers";
    return name;
  });
}

/** Map pane for a report's pin; panes are stacked so higher-priority sources draw on top. */
export function pinPane(r: PublicReport): string {
  const groups = sourceGroups(r);
  if (groups.includes("News")) return "pins-news";
  if (groups.includes("People Over Papers")) return "pins-pop";
  if (groups.includes("StopICE")) return "pins-stopice";
  return "pins-other";
}

export const PIN_PANES = [
  { name: "pins-other", zIndex: 610 },
  { name: "pins-stopice", zIndex: 620 },
  { name: "pins-pop", zIndex: 630 },
  { name: "pins-news", zIndex: 640 },
];
