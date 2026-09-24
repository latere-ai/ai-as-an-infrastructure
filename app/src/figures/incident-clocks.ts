// One incident, several reporting clocks, each started by a different event.
// The clocks are the numeric rows of the law chapter's incident-routing table:
//
//   GDPR Article 33         72 hours after awareness of a personal-data breach
//   California SB 53        15 days after discovery; 24 hours for specified
//                           imminent injury risk
//   New York RAISE Act      72 hours from determining that an incident occurred,
//   (as amended, S.8828)    or from learning facts sufficient for a reasonable
//                           belief that one did; 24 hours for imminent risk of
//                           death or serious physical injury
//
// The EU AI Act rows (Article 73, event-specific; Article 55, without undue
// delay) carry no fixed hour count in the table and are not drawn.
//
// Modeling choices, stated in the caption: time runs from discovery, and the
// controller's awareness of a personal-data breach is taken to be the same
// moment; a New York clock starts at the earlier of the reasonable belief and
// the determination; each 24-hour path starts where its row's main clock
// starts. The New York act takes effect on 1 January 2027, so an incident
// before that date has no New York clock. Coverage (a frontier developer under
// both state laws, a controller under the GDPR) is assumed, not tested.

import { defineFigure, type Lang, type State } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { linear } from "./lib/scale.ts";
import { axis, axisHeight } from "./lib/axis.ts";
import { legend } from "./lib/legend.ts";
import { textWidth, wrap } from "./lib/labels.ts";
import { wrapCjk } from "./lib/kinsoku.ts";
import { sig, tpl } from "./lib/format.ts";

type When = "2026" | "2027";
type P = { belief: number; determine: number; personal: boolean; imminent: boolean; when: When };

type RowKey = "gdpr" | "ca" | "ny";
interface Clock { key: RowKey; start: number; startEvent: "discovery" | "belief" | "determination"; deadline: number; urgent: number | null; applies: boolean }

const DAY = 24;
const AXIS_MAX = 16; // days after discovery

function clocks(p: P): Clock[] {
  const tBelief = p.belief;
  const tDet = p.belief + p.determine;
  const nyStart = Math.min(tBelief, tDet);
  const out: Clock[] = [
    { key: "gdpr", start: 0, startEvent: "discovery", deadline: 72 / DAY, urgent: null, applies: p.personal },
    { key: "ca", start: 0, startEvent: "discovery", deadline: 15, urgent: p.imminent ? 1 : null, applies: true },
    { key: "ny", start: nyStart, startEvent: tBelief <= tDet ? "belief" : "determination", deadline: nyStart + 72 / DAY, urgent: p.imminent ? nyStart + 1 : null, applies: p.when === "2027" },
  ];
  return out;
}

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "Reporting clocks started by different events",
    axis: "days after discovery",
    gdpr: "GDPR Article 33",
    gdprTo: "controller to supervisory authority, 72 h after awareness",
    ca: "California SB 53",
    caTo: "to the state mechanism, 15 days after discovery",
    ny: "New York RAISE Act",
    nyTo: "to the DFS office, 72 h from determination or reasonable belief",
    evDiscovery: "discovery",
    evBelief: "reasonable belief",
    evDetermination: "determination",
    notPersonal: "no personal data: no GDPR clock",
    notInForce: "before 1 January 2027: not yet in effect",
    lgClock: "time to report",
    lgUrgent: "24 h imminent-risk path",
    lgDeadline: "deadline",
    order: "Deadlines in order",
    item: "{name}: day {d}, {h} h after discovery",
    urgentName: "{name}, imminent risk",
    before: "The New York clock started at the reasonable belief and runs out on day {d}, {g} days before the determination on day {t}.",
    fromDet: "The New York clock started at the determination on day {t}.",
    none: "No numeric clock applies.",
    timestamps: "Timestamps to keep: discovery day 0, reasonable belief day {b}, determination day {t}",
    euNote: "EU AI Act Articles 73 and 55 also apply to covered providers; their deadlines are event-specific or without undue delay and are not drawn.",
    describe: "Reasonable belief on day {b}, determination on day {t}: {list}. {first}",
    firstIs: "The first deadline is {name} on day {d}.",
  },
  zh: {
    title: "由不同事件起算的报告时限",
    axis: "发现后的天数",
    gdpr: "GDPR 第 33 条",
    gdprTo: "控制者向监管机构报告，知悉后 72 小时",
    ca: "加利福尼亚州 SB 53",
    caTo: "向州级机制报告，发现后 15 天",
    ny: "纽约州 RAISE 法案",
    nyTo: "向金融服务部的办公室报告，自认定或形成合理相信起 72 小时",
    evDiscovery: "发现",
    evBelief: "合理相信",
    evDetermination: "认定",
    notPersonal: "不涉及个人数据：无 GDPR 时限",
    notInForce: "2027 年 1 月 1 日前：尚未生效",
    lgClock: "报告期限",
    lgUrgent: "24 小时紧迫风险路径",
    lgDeadline: "截止时间",
    order: "截止时间先后",
    item: "{name}：第 {d} 天，发现后 {h} 小时",
    urgentName: "{name}（紧迫风险）",
    before: "纽约州的时限从形成合理相信时起算，在第 {d} 天到期，比第 {t} 天的正式认定早 {g} 天。",
    fromDet: "纽约州的时限从第 {t} 天的认定起算。",
    none: "没有适用的数字时限。",
    timestamps: "需要保留的时间戳：发现为第 0 天，合理相信为第 {b} 天，认定为第 {t} 天",
    euNote: "欧盟《人工智能法案》第 73 条和第 55 条同样适用于受监管的提供者；其期限按事件类型确定，或要求不得无故拖延，图中没有画出。",
    describe: "第 {b} 天形成合理相信，第 {t} 天作出认定：{list}。{first}",
    firstIs: "最早的截止时间是{name}，第 {d} 天。",
  },
};
type L = typeof labels.en;

const dayFmt = (v: number) => sig(Math.round(v * 100) / 100, 3);
const hourFmt = (v: number) => sig(Math.round(v * DAY * 10) / 10, 4);

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const ds = deadlines(p, L);
  const sep = lang === "zh" ? "；" : "; ";
  const list = ds.map((d) => `${d.name} ${lang === "zh" ? "第 " + dayFmt(d.t) + " 天" : "day " + dayFmt(d.t)}`).join(sep);
  return tpl(L.describe, { b: dayFmt(p.belief), t: dayFmt(p.belief + p.determine), list: list || L.none, first: ds.length ? tpl(L.firstIs, { name: ds[0].name, d: dayFmt(ds[0].t) }) : "" });
}

// Every deadline that applies, the 24-hour paths as their own entries, in time order.
function deadlines(p: P, L: L): Array<{ name: string; t: number }> {
  const out: Array<{ name: string; t: number }> = [];
  for (const c of clocks(p)) {
    if (!c.applies) continue;
    out.push({ name: L[c.key], t: c.deadline });
    if (c.urgent !== null) out.push({ name: tpl(L.urgentName, { name: L[c.key] }), t: c.urgent });
  }
  return out.sort((a, b) => a.t - b.t);
}

function lines(s: string, size: number, w: number, lang: Lang, strong = false): string[] {
  const max = w * (strong ? 0.86 : 0.93);
  return lang === "zh" ? wrapCjk(s, size, max) : wrap(s, size, max);
}

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const p = st.p;
  const w = st.w;
  const narrow = w < 480;
  const size = narrow ? TYPE.body : TYPE.small;
  const cs = clocks(p);
  const tDet = p.belief + p.determine;
  const parts: string[] = [];

  // Rows: on desktop the name sits left of its bar; on a phone above it.
  const labelW = narrow ? 0 : 150;
  const left = labelW + 6, right = w - 10;
  const x = linear([0, AXIS_MAX], [left, right]);
  const eventRows = [8 + size, 8 + 2 * size + 5, 8 + 3 * size + 10]; // baselines of the event-name rows
  let y = eventRows[2] + 10;
  const top = y;
  const barH = 14;
  const rowsY: number[] = [];
  const barsY: number[] = []; // bars of rows whose clock applies
  for (const c of cs) {
    rowsY.push(y);
    const nameY = y + TYPE.body;
    // Recipient and rule under the name: in the label column on desktop, under
    // the bar on a phone.
    const sub = lines(L[`${c.key}To` as "gdprTo"], size, narrow ? w : labelW - 8, lang);
    const barY = narrow ? y + TYPE.body + 8 : y + 4;
    if (c.applies) barsY.push(barY);
    parts.push(text(0, nameY, L[c.key], { "font-size": TYPE.body, class: c.applies ? "fig-t-strong" : "fig-t-muted" }));
    const subY0 = narrow ? barY + barH + 10 + size : nameY + 4 + size;
    sub.forEach((ln, i) => parts.push(text(0, subY0 + i * (size + 3), ln, { "font-size": size, class: "fig-t-muted" })));
    const rowH = narrow ? (subY0 - y) + (sub.length - 1) * (size + 3) + 16 : Math.max(barH + 30, TYPE.body + 4 + sub.length * (size + 3) + 14);
    parts.push(el("rect", { x: left, y: barY, width: right - left, height: barH, rx: 3, fill: C.panel }));
    if (!c.applies) {
      const why = c.key === "gdpr" ? L.notPersonal : L.notInForce;
      parts.push(text(left + 14, barY + barH - 3, why, { "font-size": size, class: "fig-t-halo fig-t-soft" }));
    } else {
      const x0 = x(c.start), x1 = x(Math.min(c.deadline, AXIS_MAX));
      parts.push(el("rect", { x: x0, y: barY, width: Math.max(2, x1 - x0), height: barH, rx: 3, fill: C.c1, "fill-opacity": 0.55 }));
      if (c.urgent !== null) {
        const u1 = x(c.urgent);
        parts.push(el("rect", { x: x0, y: barY + barH + 2, width: Math.max(2, u1 - x0), height: 6, rx: 2, fill: C.c2 }));
      }
      parts.push(el("line", { x1, x2: x1, y1: barY - 3, y2: barY + barH + 3, stroke: C.ink, "stroke-width": 2 }));
      const dl = narrow ? `${dayFmt(c.deadline)}` : `${lang === "zh" ? "第 " + dayFmt(c.deadline) + " 天" : "day " + dayFmt(c.deadline)}`;
      const tw = textWidth(dl, size) + 4;
      const room = right - x1 >= tw + 4;
      parts.push(text(room ? x1 + 4 : x1 - 4, barY + barH - 3, dl, { "font-size": size, "text-anchor": room ? "start" : "end", class: room ? "fig-t-strong fig-t-num" : "fig-t-halo fig-t-num" }));
    }
    y += rowH;
  }
  const base = y - 4;
  // Event lines across every row, named above the plot.
  const events: Array<[number, string]> = [[0, L.evDiscovery], [p.belief, L.evBelief], [tDet, L.evDetermination]];
  const placed: Array<{ x0: number; x1: number; row: number }> = [];
  for (const [t, name] of events) {
    const ex = x(Math.min(t, AXIS_MAX));
    // On desktop one line crosses every row; on a phone, where row text runs
    // under the bars, the line is drawn only across each bar.
    if (!narrow) parts.push(el("line", { x1: ex, x2: ex, y1: top - 4, y2: base, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    else {
      parts.push(el("line", { x1: ex, x2: ex, y1: top - 4, y2: rowsY[0] + TYPE.body - 10, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
      for (const by of barsY) parts.push(el("line", { x1: ex, x2: ex, y1: by - 4, y2: by + barH + 10, stroke: C.ink2, "stroke-width": 1, "stroke-dasharray": "3 3" }));
      parts.push(el("line", { x1: ex, x2: ex, y1: base - 6, y2: base, stroke: C.ink2, "stroke-width": 1 }));
    }
    const tw = textWidth(name, size) * 1.05;
    let tx = Math.min(Math.max(ex - tw / 2, left - (narrow ? 0 : 6)), right - tw);
    // The lowest row where the name clears every name already placed there.
    let row = 2;
    while (row > 0 && placed.some((b) => b.row === row && tx < b.x1 + 6 && tx + tw > b.x0 - 6)) row--;
    const ty = eventRows[row];
    placed.push({ x0: tx, x1: tx + tw, row });
    parts.push(text(tx, ty, name, { "font-size": size, class: "fig-t-muted" }));
  }
  parts.push(axis({ scale: x, orient: "bottom", at: base, ticks: [0, 2, 4, 6, 8, 10, 12, 14, 16], title: L.axis, size, format: (v) => String(v) }));
  y = base + axisHeight(true, size) + 2;
  const lg = legend([
    { label: L.lgClock, swatch: { kind: "rect", fill: C.c1, opacity: 0.55 } },
    { label: L.lgUrgent, swatch: { kind: "rect", fill: C.c2 } },
    { label: L.lgDeadline, swatch: { kind: "line", stroke: C.ink } },
  ], 0, y, w, size);
  parts.push(lg.svg);
  y += lg.height + 8;

  // Readout.
  const put = (s: string, cls: string, sz: number, gap = 2) => {
    for (const ln of lines(s, sz, w, lang, cls.includes("strong"))) { parts.push(text(0, y + sz, ln, { "font-size": sz, class: cls })); y += sz + 5; }
    y += gap;
  };
  put(L.order, "fig-t-strong", TYPE.label);
  const ds = deadlines(p, L);
  if (!ds.length) put(L.none, "", size);
  for (const d of ds) put(tpl(L.item, { name: d.name, d: dayFmt(d.t), h: hourFmt(d.t) }), "fig-t-num", size, 0);
  y += 6;
  const ny = cs.find((c) => c.key === "ny")!;
  if (ny.applies) {
    if (ny.startEvent === "belief" && ny.deadline < tDet) put(tpl(L.before, { d: dayFmt(ny.deadline), g: dayFmt(tDet - ny.deadline), t: dayFmt(tDet) }), "fig-t-strong", size);
    else if (ny.startEvent === "determination" || p.determine === 0) put(tpl(L.fromDet, { t: dayFmt(tDet) }), "", size);
  }
  put(tpl(L.timestamps, { b: dayFmt(p.belief), t: dayFmt(tDet) }), "fig-t-muted fig-t-num", size);
  put(L.euNote, "fig-t-muted", size);
  void rowsY;
  return svg(w, y + 2, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "incident-clocks",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    belief: {
      kind: "range", label: { en: "Reasonable belief, days after discovery", zh: "形成合理相信：发现后的天数" }, min: 0, max: 4, step: 0.25, default: 0.5,
    },
    determine: {
      kind: "range", label: { en: "Formal determination, days after the belief", zh: "正式认定：合理相信后的天数" }, min: 0, max: 10, step: 0.25, default: 6,
    },
    personal: { kind: "toggle", label: { en: "Personal data affected", zh: "涉及个人数据" }, default: true },
    imminent: { kind: "toggle", label: { en: "Imminent risk of death or serious injury", zh: "存在死亡或严重伤害的紧迫风险" }, default: false },
    when: {
      kind: "choice", label: { en: "Incident date", zh: "事件日期" }, default: "2027",
      options: [
        { value: "2026", label: { en: "Before 1 Jan 2027", zh: "2027 年 1 月 1 日前" } },
        { value: "2027", label: { en: "From 1 Jan 2027", zh: "2027 年 1 月 1 日起" } },
      ],
    },
  },
  render,
  describe,
});
