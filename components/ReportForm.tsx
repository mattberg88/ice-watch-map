"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/types";
import { toLocalInputValue } from "@/lib/format";

interface Props {
  draft: { lat: number; lng: number } | null;
  isAdmin: boolean;
  onLocate: () => void;
  locating: boolean;
  onCancel: () => void;
  onSubmitted: (published: boolean) => void;
}

export default function ReportForm({ draft, isAdmin, onLocate, locating, onCancel, onSubmitted }: Props) {
  const [category, setCategory] = useState<Category>("vehicle");
  const [description, setDescription] = useState("");
  const [observed, setObserved] = useState(() => toLocalInputValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) {
      setError("Tap the map or use your location to set where this happened.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          lat: draft.lat,
          lng: draft.lng,
          observedAt: new Date(observed).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't submit the report.");
      onSubmitted(data.status === "approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit the report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="report-form" onSubmit={submit}>
      <h2>{isAdmin ? "Add verified report" : "Report activity"}</h2>

      <div className="field">
        <span className="label">Location</span>
        <div className="location-row">
          <span className={draft ? "loc-set" : "loc-unset"}>
            {draft ? `${draft.lat.toFixed(3)}, ${draft.lng.toFixed(3)}` : "Tap the map to set a location"}
          </span>
          <button type="button" className="btn ghost" onClick={onLocate} disabled={locating}>
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
        <small>Locations are rounded to about one block before they're saved.</small>
      </div>

      <label className="field">
        <span className="label">What did you see?</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {CATEGORIES[key].label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="label">When?</span>
        <input type="datetime-local" value={observed} max={toLocalInputValue(new Date())} onChange={(e) => setObserved(e.target.value)} required />
      </label>

      <label className="field">
        <span className="label">Details (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. 3 unmarked SUVs parked near the corner, agents in tactical vests"
        />
        <small>
          Describe what's happening, not who. No names, faces, license plates, phone numbers or other identifying details about
          anyone, including agents.
        </small>
      </label>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Sending…" : isAdmin ? "Publish" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
