// Parameter controls built from a figure's declarations. Every control is a
// native form element with a visible label, so keyboard and screen-reader use
// come from the platform: range inputs take arrow keys, radio groups take
// arrows within the group, selects open with Space.
//
//   range            <input type="range"> with the value and unit beside it;
//                    log ranges move in hundredths of a decade
//   choice (<= 4)    a segmented radio group (or any length with "buttons")
//   choice (> 4)     a <select> (or any length with "select")
//   toggle           a checkbox

import type { AnyFigure, Lang, ParamSpec, RangeParam } from "../types.ts";
import { sig } from "../lib/format.ts";
import type { ParamRecord } from "../lib/params.ts";

export interface Controls {
  root: HTMLElement;
  sync(p: ParamRecord): void; // reflect values changed elsewhere (update hook, clicks)
}

let seq = 0;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function toSlider(spec: RangeParam, v: number): number {
  return spec.scale === "log" ? Math.log10(v) : v;
}
function fromSlider(spec: RangeParam, x: number): number {
  if (spec.scale !== "log") return x;
  // Snap to three significant figures so values read cleanly.
  return Number((10 ** x).toPrecision(3));
}

function rangeText(spec: RangeParam, v: number, lang: Lang): string {
  const unit = spec.unit ? ` ${spec.unit[lang]}` : "";
  return `${sig(v, 3)}${unit}`;
}

export function buildControls(fig: AnyFigure, lang: Lang, p: ParamRecord, set: (key: string, value: number | string | boolean) => void): Controls {
  const root = h("div", "fig-controls");
  const syncers: Array<(p: ParamRecord) => void> = [];
  const id = `figc${++seq}`;
  for (const [key, spec] of Object.entries(fig.params as Record<string, ParamSpec>)) {
    if (spec.control === false) continue;
    if (spec.kind === "range") {
      const wrap = h("label", "fig-ctl fig-range");
      const name = h("span", "fig-ctl-name", spec.label[lang]);
      const input = h("input");
      input.type = "range";
      input.min = String(toSlider(spec, spec.min));
      input.max = String(toSlider(spec, spec.max));
      input.step = spec.scale === "log" ? "0.01" : String(spec.step ?? (spec.max - spec.min) / 100);
      const out = h("output", "fig-ctl-value");
      if (spec.marks?.length) {
        const dl = h("datalist");
        dl.id = `${id}-${key}-marks`;
        for (const m of spec.marks) { const o = h("option"); o.value = String(toSlider(spec, m.value)); o.label = m.label[lang]; dl.append(o); }
        input.setAttribute("list", dl.id);
        wrap.append(dl);
      }
      input.addEventListener("input", () => {
        const v = fromSlider(spec, Number(input.value));
        out.textContent = rangeText(spec, v, lang);
        set(key, v);
      });
      syncers.push((q) => {
        const v = Number(q[key]);
        input.value = String(toSlider(spec, v));
        out.textContent = rangeText(spec, v, lang);
        input.setAttribute("aria-valuetext", out.textContent);
      });
      wrap.append(name, input, out);
      root.append(wrap);
    } else if (spec.kind === "choice" && spec.control !== "select" && (spec.options.length <= 4 || spec.control === "buttons")) {
      const fs = h("fieldset", spec.options.length > 4 ? "fig-ctl fig-seg fig-seg-chips" : "fig-ctl fig-seg");
      fs.append(h("legend", "fig-ctl-name", spec.label[lang]));
      const group = h("div", "fig-seg-options");
      const radios: HTMLInputElement[] = [];
      for (const o of spec.options) {
        const lab = h("label", "fig-seg-option");
        const r = h("input");
        r.type = "radio";
        r.name = `${id}-${key}`;
        r.value = String(o.value);
        r.addEventListener("change", () => { if (r.checked) set(key, o.value); });
        lab.append(r, h("span", undefined, o.label[lang]));
        group.append(lab);
        radios.push(r);
      }
      fs.append(group);
      syncers.push((q) => { for (const r of radios) r.checked = r.value === String(q[key]); });
      root.append(fs);
    } else if (spec.kind === "choice") {
      const wrap = h("label", "fig-ctl fig-select");
      wrap.append(h("span", "fig-ctl-name", spec.label[lang]));
      const sel = h("select");
      for (const o of spec.options) { const opt = h("option", undefined, o.label[lang]); opt.value = String(o.value); sel.append(opt); }
      sel.addEventListener("change", () => {
        const hit = spec.options.find((o) => String(o.value) === sel.value);
        if (hit) set(key, hit.value);
      });
      syncers.push((q) => { sel.value = String(q[key]); });
      wrap.append(sel);
      root.append(wrap);
    } else if (spec.kind === "toggle") {
      const wrap = h("label", "fig-ctl fig-toggle");
      const cb = h("input");
      cb.type = "checkbox";
      cb.addEventListener("change", () => set(key, cb.checked));
      syncers.push((q) => { cb.checked = Boolean(q[key]); });
      wrap.append(cb, h("span", "fig-ctl-name", spec.label[lang]));
      root.append(wrap);
    }
  }
  const sync = (q: ParamRecord) => { for (const s of syncers) s(q); };
  sync(p);
  return { root, sync };
}
