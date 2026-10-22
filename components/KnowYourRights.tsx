"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { CARD_HOTLINES, CARD_STATEMENT, RIGHTS } from "@/lib/rights";
import type { Lang } from "@/lib/i18n";

const SITE = "ice-watch-bay-area.vercel.app";

/** Statements on the card: English always (agents read it), plus Spanish when that's the chosen language. */
function cardSections(lang: Lang) {
  return lang === "es" ? [CARD_STATEMENT.en, CARD_STATEMENT.es] : [CARD_STATEMENT.en];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the rights card as a tall PNG sized for a phone screen. */
function drawCard(lang: Lang): HTMLCanvasElement {
  const W = 1080;
  const pad = 80;
  const font = "Helvetica, Arial, sans-serif";
  const sections = cardSections(lang);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Measure first so the canvas fits the text exactly.
  ctx.font = `500 44px ${font}`;
  const wrapped = sections.map((s) => s.lines.map((l) => wrap(ctx, l, W - pad * 2 - 40)));
  const headerH = 220;
  const lineH = 60;
  let bodyH = 0;
  for (const sec of wrapped) {
    bodyH += 110; // section heading
    for (const para of sec) bodyH += para.length * lineH + 28;
    bodyH += 40;
  }
  const footerH = 220;
  canvas.width = W;
  canvas.height = headerH + bodyH + footerH;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = "#b42318";
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = "#ffffff";
  // Shrink the title until it fits ("CONOZCA SUS DERECHOS" is wider than "KNOW YOUR RIGHTS").
  let size = 76;
  do {
    ctx.font = `800 ${size}px ${font}`;
    size -= 2;
  } while (ctx.measureText(CARD_STATEMENT[lang].heading).width > W - pad * 2 && size > 40);
  ctx.fillText(CARD_STATEMENT[lang].heading, pad, 135);
  ctx.font = `500 34px ${font}`;
  ctx.fillText(lang === "es" ? "Muestre esta tarjeta en lugar de hablar" : "Show this card instead of talking", pad, 185);

  let y = headerH + 40;
  sections.forEach((sec, i) => {
    ctx.fillStyle = "#b42318";
    ctx.font = `800 40px ${font}`;
    ctx.fillText(i === 0 ? "ENGLISH" : "ESPAÑOL", pad, y + 50);
    y += 110;
    ctx.fillStyle = "#111827";
    ctx.font = `500 44px ${font}`;
    for (const para of wrapped[i]) {
      ctx.fillStyle = "#b42318";
      ctx.fillRect(pad, y - 30, 10, 10 + (para.length - 1) * lineH + 26);
      ctx.fillStyle = "#111827";
      for (const l of para) {
        ctx.fillText(l, pad + 40, y);
        y += lineH;
      }
      y += 28;
    }
    if (i < sections.length - 1) {
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(pad, y, W - pad * 2, 4);
    }
    y += 40;
  });

  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, canvas.height - footerH, W, footerH);
  ctx.fillStyle = "#111827";
  ctx.font = `700 38px ${font}`;
  ctx.fillText(CARD_HOTLINES, pad, canvas.height - footerH + 90);
  ctx.fillStyle = "#4b5563";
  ctx.font = `500 32px ${font}`;
  ctx.fillText(SITE, pad, canvas.height - footerH + 150);
  return canvas;
}

async function saveCard(lang: Lang) {
  const canvas = drawCard(lang);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return;
  const file = new File([blob], lang === "es" ? "tarjeta-de-derechos.png" : "rights-card.png", { type: "image/png" });
  // On phones the share sheet offers "Save Image" straight to the photo library.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: CARD_STATEMENT[lang].heading });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function KnowYourRights({ onClose }: { onClose: () => void }) {
  const { lang } = useT();
  const r = RIGHTS[lang];
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function onSave() {
    setState("saving");
    try {
      await saveCard(lang);
      setState("saved");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  }

  return (
    <section className="rights">
      <h2>{r.title}</h2>
      <p className="rights-intro">{r.intro}</p>

      <h3>{r.rightsTitle}</h3>
      <ul className="rights-list">
        {r.rights.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            {item.say && <q className="rights-say">{item.say}</q>}
            <span>{item.body}</span>
          </li>
        ))}
      </ul>

      <h3>{r.dontTitle}</h3>
      <ul className="report-tips">
        {r.donts.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>

      <h3>{r.cardTitle}</h3>
      <p className="rights-intro">{r.cardIntro}</p>
      <div className="rights-card" aria-label={r.cardTitle}>
        <div className="rights-card-head">{CARD_STATEMENT[lang].heading}</div>
        {cardSections(lang).map((sec, i) => (
          <div key={i} className="rights-card-section" lang={i === 0 ? "en" : "es"}>
            <div className="rights-card-lang">{i === 0 ? "English" : "Español"}</div>
            <ul>
              {sec.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="rights-card-foot">{CARD_HOTLINES}</div>
      </div>
      <button className="btn primary" onClick={onSave} disabled={state === "saving"}>
        {state === "saving" ? r.saving : state === "saved" ? r.saved : r.save}
      </button>

      <h3>{r.witnessTitle}</h3>
      <ul className="report-tips">
        {r.witness.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>

      <h3>{r.sanctuaryTitle}</h3>
      <p className="rights-intro">{r.sanctuary}</p>

      <h3>{r.placesTitle}</h3>
      <ul className="report-tips">
        {r.places.map((p) => (
          <li key={p.title}>
            <strong>{p.title}:</strong> {p.body}
          </li>
        ))}
      </ul>

      <p className="rights-disclaimer">{r.disclaimer}</p>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          {r.back}
        </button>
      </div>
    </section>
  );
}
