import { z } from "zod";
import { CATEGORY_KEYS } from "./types";

const MAX_AGE_HOURS = 24;

export const newReportSchema = z.object({
  category: z.enum(CATEGORY_KEYS),
  description: z.string().trim().max(500).default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  observedAt: z.iso.datetime({ offset: true }).refine(
    (value) => {
      const t = Date.parse(value);
      const now = Date.now();
      return t <= now + 5 * 60_000 && t >= now - MAX_AGE_HOURS * 3_600_000;
    },
    { message: `Time observed must be within the last ${MAX_AGE_HOURS} hours` },
  ),
});

export type NewReport = z.infer<typeof newReportSchema>;

/** Round to 3 decimals (~110 m) so exact addresses aren't published. */
export function roundCoord(n: number) {
  return Math.round(n * 1000) / 1000;
}

// Rough patterns for details that shouldn't be posted about anyone, agents included.
const PERSONAL_DETAIL_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, reason: "phone numbers" },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]+/, reason: "email addresses" },
  { pattern: /\b(plate|license|tag)\b/i, reason: "license plates" },
  { pattern: /https?:\/\//i, reason: "links" },
];

export function personalDetailIssue(text: string) {
  return PERSONAL_DETAIL_PATTERNS.find(({ pattern }) => pattern.test(text))?.reason ?? null;
}
