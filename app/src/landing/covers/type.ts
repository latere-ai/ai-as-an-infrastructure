// Cover concept "The type": a purely typographic cover on a strict twelve
// column grid, in the manner of a technical publisher's series. A heavy rule
// and the series line at the head, the author and the parts of the book as a
// column in the upper band, the subtitle across the middle, the title set
// large at the foot, and a rule system that shows the grid. Ink only.

import type { Lang } from "../../types.ts";
import { r } from "../../figures/lib/svg.ts";
import { layer, T, wrap, type CoverData } from "./lib.ts";

const M = 48; // margin
const COL = (700 - 2 * M - 11 * 12) / 12; // column width, 12 px gutters
const colX = (i: number) => M + i * (COL + 12);

const TEXT: Record<Lang, { author: string; contents: string; count: (n: number) => string; edition: (v: string) => string; subtitle: string[]; motto: string }> = {
  en: {
    author: "Changkun Ou",
    contents: "CONTENTS",
    count: (n) => `${n} PARTS`,
    edition: (v) => `EDITION ${v}`,
    subtitle: ["From Systems to Agents:", "History, Design Decisions,", "and Foundations"],
    motto: "HUMAN INTELLIGENCE IN THE LOOP",
  },
  zh: {
    author: "欧长坤 著",
    contents: "目录",
    count: (n) => `${n} 个部分`,
    edition: (v) => `版本 ${v}`,
    subtitle: ["从系统到智能体：", "历史、设计与基石"],
    motto: "HUMAN INTELLIGENCE IN THE LOOP",
  },
};

function frame(lang: Lang, data: CoverData): string {
  const t = TEXT[lang];
  const out: string[] = [];
  out.push(`<rect class="cv-f1" x="${M}" y="48" width="${700 - 2 * M}" height="5"/>`);
  out.push(T(M, 76, "LATERE.AI", { class: "cv-fa", "font-size": 10.5, "font-weight": 600, "letter-spacing": 3 }));
  if (data.release) out.push(T(700 - M, 76, t.edition(data.release.version), { class: lang === "zh" ? "cv-cjk cv-f2" : "cv-f2", "font-size": 7.5, "font-weight": 500, "letter-spacing": 2, "text-anchor": "end" }));
  out.push(`<path class="cv-s1" stroke-width=".6" d="M${M} 92H${700 - M}"/>`);
  // The band rule, with a tick at every column edge: the grid made visible.
  const ticks = Array.from({ length: 12 }, (_, i) => `M${r(colX(i))} 476v6M${r(colX(i) + COL)} 476v6`).join("");
  out.push(`<path class="cv-s1" stroke-width="1.2" d="M${M} 476H${700 - M}"/><path class="cv-s1" stroke-width=".5" d="${ticks}"/>`);
  out.push(`<rect class="cv-f1" x="${M}" y="900" width="${700 - 2 * M}" height="5"/>`);
  out.push(T(M, 934, t.motto, { class: "cv-f2", "font-size": 7.5, "font-weight": 500, "letter-spacing": 2 }));
  out.push(T(700 - M, 934, "AAAI.LATERE.AI", { class: "cv-f1", "font-size": 7.5, "font-weight": 600, "letter-spacing": 2, "text-anchor": "end" }));
  return layer("frame", 0, out.join(""));
}

// The parts of the book as a column over the right half of the grid: number,
// title (wrapped, never cut), and a hairline under each row.
function contents(lang: Lang, data: CoverData): string {
  const t = TEXT[lang];
  const zh = lang === "zh";
  const x = colX(6), numW = 32;
  const out: string[] = [];
  out.push(T(x, 116, t.contents, { class: zh ? "cv-cjk cv-f2" : "cv-f2", "font-size": 7.5, "font-weight": 600, "letter-spacing": 2 }));
  out.push(T(700 - M, 116, t.count(data.parts.length), { class: zh ? "cv-cjk cv-f3" : "cv-f3", "font-size": 7.5, "letter-spacing": 1.5, "text-anchor": "end" }));
  out.push(`<path class="cv-s1" stroke-width=".8" d="M${r(x)} 123H${700 - M}"/>`);
  let y = 123;
  for (const p of data.parts) {
    const lines = zh ? [p.title] : wrap(p.title, 44);
    out.push(T(x, y + 16, p.num, { class: "cv-serif cv-f1", "font-size": 13 }));
    lines.forEach((l, i) => out.push(T(x + numW, y + 15.5 + i * 12, l, { class: zh ? "cv-cjk cv-f1" : "cv-f1", "font-size": zh ? 10 : 9.5 })));
    y += 12 + 12 * lines.length;
    out.push(`<path class="cv-s3" stroke-width=".5" d="M${r(x)} ${y}H${700 - M}"/>`);
  }
  out.push(`<path class="cv-s1" stroke-width=".5" d="M${r(x - 6)} 104V${y}"/>`);
  return layer("contents", -0.3, out.join(""));
}

function text(lang: Lang): string {
  const t = TEXT[lang];
  const zh = lang === "zh";
  const out: string[] = [];
  out.push(T(M, 128, t.author, { class: zh ? "cv-cjk cv-f1" : "cv-f1", "font-size": 17, "font-weight": 600, "letter-spacing": zh ? 2 : undefined }));
  t.subtitle.forEach((l, i) => out.push(zh
    ? T(M, 528 + i * 36, l, { class: "cv-cjk cv-f1", "font-size": 22, "letter-spacing": 3 })
    : T(M, 532 + i * 36, l, { class: "cv-serif cv-f1", "font-size": 30 })));
  return layer("text", 0.2, out.join(""));
}

function title(lang: Lang): string {
  const body = lang === "zh"
    ? `<text class="cv-serif cv-f1" x="42" y="858" font-size="180">AI<tspan class="cv-cjk-title"> 基建</tspan></text>`
    : T(44, 764, "AI as an", { class: "cv-serif cv-f1", "font-size": 127 }) + T(44, 880, "Infrastructure", { class: "cv-serif cv-f1", "font-size": 127 });
  return layer("title", 0.45, body);
}

export function typeCover(lang: Lang, data: CoverData): string {
  return frame(lang, data) + contents(lang, data) + text(lang) + title(lang);
}
