import { HOTLINES, telHref } from "@/lib/hotlines";
import { useT } from "@/lib/i18n";

/** Points people to their county's rapid response hotline instead of a form on this site. */
export default function ReportHelp({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const r = t.report;
  return (
    <section className="report-help">
      <h2>{r.title}</h2>
      <p>{r.intro}</p>

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
              {h.hours ? ` · ${r.hours[h.hours]}` : ""}
            </div>
          </li>
        ))}
      </ul>

      <h3>{r.tellTitle}</h3>
      <ul className="report-tips">
        {r.tell.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h3>{r.alertTitle}</h3>
      <div className="stopice">
        <p>
          <a href="https://www.stopice.net/" target="_blank" rel="noopener noreferrer">
            StopICE
          </a>{" "}
          {r.alertBody}
        </p>
        <div className="stopice-actions">
          <a className="btn" href="sms:8773222299?&body=REPORT">
            {r.text}
          </a>
          <a className="btn" href="https://www.stopice.net/" target="_blank" rel="noopener noreferrer">
            {r.online}
          </a>
        </div>
      </div>

      <div className="actions">
        <button className="btn" onClick={onClose}>
          {r.back}
        </button>
      </div>
    </section>
  );
}
