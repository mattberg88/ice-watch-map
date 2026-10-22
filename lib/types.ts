export const CATEGORIES = {
  vehicle: { label: "Vehicles", color: "#d97706" },
  agents: { label: "Agents on foot", color: "#dc2626" },
  checkpoint: { label: "Checkpoint", color: "#7c3aed" },
  detention: { label: "Arrest / detention", color: "#be123c" },
  other: { label: "Other", color: "#475569" },
} as const;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as [Category, ...Category[]];

export type ReportStatus = "pending" | "approved" | "rejected";
export type ReportSource = "community" | "moderator" | "imported";
export type Verification = "confirmed" | "sighting" | "unconfirmed" | "prior";

export const VERIFICATION_LABELS: Record<Verification, string> = {
  confirmed: "Confirmed",
  sighting: "Sighting",
  unconfirmed: "Unconfirmed",
  prior: "Earlier incident",
};

export interface Report {
  id: string;
  category: Category;
  description: string;
  lat: number;
  lng: number;
  observed_at: string;
  created_at: string;
  status: ReportStatus;
  source: ReportSource;
  /** Set for imported reports: which tracker it came from and how that tracker rated it. */
  source_name: string | null;
  source_url: string | null;
  verification: Verification | null;
  /** Reports that describe the same event (e.g. an arrest and the hospital stay that followed) share this. */
  related_key: string | null;
}

/** Public reports omit moderation fields. */
export type PublicReport = Omit<Report, "status" | "created_at">;
