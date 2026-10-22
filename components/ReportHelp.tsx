import { HOTLINES, telHref } from "@/lib/hotlines";

/** Points people to their county's rapid response hotline instead of a form on this site. */
export default function ReportHelp({ onClose }: { onClose: () => void }) {
  return (
    <section className="report-help">
      <h2>How to report ICE activity</h2>
      <p>
        Call the rapid response hotline for the county you&apos;re in. Trained responders verify reports, send legal
        observers, and help people who are detained.
      </p>

      <ul className="hotlines">
        {HOTLINES.map((h) => (
          <li key={h.county}>
            <div className="hotline-county">{h.county}</div>
            <a className="hotline-phone" href={telHref(h.phone)}>
              {h.phone}
            </a>
            <div className="hotline-meta">
              {h.url ? (
                <a href={h.url} target="_blank" rel="noopener noreferrer">
                  {h.name}
                </a>
              ) : (
                h.name
              )}
              {h.hours ? ` · ${h.hours}` : ""}
            </div>
          </li>
        ))}
      </ul>

      <h3>What to tell them</h3>
      <ul className="report-tips">
        <li>Where: an address, cross streets or a landmark</li>
        <li>When it started, and whether it&apos;s still happening</li>
        <li>What you see: how many agents, vehicles, and any agency markings</li>
        <li>Whether anyone has been detained</li>
      </ul>

      <h3>Then alert people nearby</h3>
      <div className="stopice">
        <p>
          <a href="https://www.stopice.net/" target="_blank" rel="noopener noreferrer">
            StopICE
          </a>{" "}
          sends anonymous alerts to people signed up in the area. Reports there also appear on this map within about an
          hour.
        </p>
        <div className="stopice-actions">
          <a className="btn" href="sms:8773222299?&body=REPORT">
            Text REPORT to 877-322-2299
          </a>
          <a className="btn" href="https://www.stopice.net/" target="_blank" rel="noopener noreferrer">
            Send an alert online
          </a>
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={onClose}>
          Back to map
        </button>
      </div>
    </section>
  );
}
