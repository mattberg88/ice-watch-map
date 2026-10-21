"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, type Report, type ReportStatus } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const TABS: ReportStatus[] = ["pending", "approved", "rejected"];

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportStatus>("pending");
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.admin)))
      .catch(() => setAuthed(false));
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/reports?status=${tab}`, { cache: "no-store" });
    if (res.status === 401) return setAuthed(false);
    const data = (await res.json()) as { reports: Report[] };
    setReports(data.reports);
  }, [tab]);

  useEffect(() => {
    if (!authed) return;
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [authed, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setPassword("");
      setAuthed(true);
    } else {
      setLoginError("Incorrect password.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  async function setStatus(id: string, status: ReportStatus) {
    setBusy(id);
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this report permanently?")) return;
    setBusy(id);
    await fetch(`/api/admin/reports/${id}`, { method: "DELETE" });
    setBusy(null);
    load();
  }

  if (authed === null) return <div className="admin"><p>Loading…</p></div>;

  if (!authed) {
    return (
      <div className="admin">
        <form className="login" onSubmit={login}>
          <h1>Moderator login</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoFocus required />
          {loginError && <p className="error">{loginError}</p>}
          <button className="btn primary" type="submit">Sign in</button>
          <a href="/">Back to map</a>
        </form>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <h1>Moderation queue</h1>
        <div className="admin-links">
          <a href="/">Map (add verified reports there)</a>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className="checklist">
        <strong>Before approving:</strong> location and time are plausible · no names, faces, plates, phone numbers or other
        identifying details · describes activity, not a person · not a duplicate of a pin already on the map.
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="empty">Nothing here.</p>
      ) : (
        <ul className="queue">
          {reports.map((r) => (
            <li key={r.id} className="card">
              <div className="card-head">
                <strong style={{ color: CATEGORIES[r.category].color }}>{CATEGORIES[r.category].label}</strong>
                <span className={`badge ${r.source}`}>{r.source}</span>
              </div>
              <div className="card-meta">
                Seen {timeAgo(r.observed_at)} · submitted {timeAgo(r.created_at)} ·{" "}
                <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`} target="_blank" rel="noreferrer">
                  {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                </a>
              </div>
              {r.description ? <p>{r.description}</p> : <p className="muted">No details provided.</p>}
              <div className="actions">
                {r.status !== "approved" && (
                  <button className="btn primary" disabled={busy === r.id} onClick={() => setStatus(r.id, "approved")}>Approve</button>
                )}
                {r.status !== "rejected" && (
                  <button className="btn ghost" disabled={busy === r.id} onClick={() => setStatus(r.id, "rejected")}>
                    {r.status === "approved" ? "Unpublish" : "Reject"}
                  </button>
                )}
                <button className="btn danger" disabled={busy === r.id} onClick={() => remove(r.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
