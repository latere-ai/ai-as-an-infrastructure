// Parameter defaults, parsing, and validation. A chapter block sets
// parameters as `key: value` lines; values are checked against the figure's
// declaration so a typo or an out-of-range value fails the build instead of
// shipping a figure that silently ignores it.

import type { AnyFigure, ParamSpec } from "../types.ts";

export type ParamRecord = Record<string, number | string | boolean>;

export function defaults(fig: AnyFigure): ParamRecord {
  const out: ParamRecord = {};
  for (const [k, spec] of Object.entries(fig.params as Record<string, ParamSpec>)) out[k] = spec.default;
  return out;
}

export function coerce(fig: AnyFigure, key: string, raw: string | number | boolean): number | string | boolean {
  const spec = (fig.params as Record<string, ParamSpec>)[key];
  if (!spec) throw new Error(`figure "${fig.name}" has no parameter "${key}" (known: ${Object.keys(fig.params).join(", ")})`);
  const s = String(raw).trim();
  switch (spec.kind) {
    case "range": {
      const v = Number(s);
      if (!Number.isFinite(v)) throw new Error(`figure "${fig.name}": ${key} must be a number, got "${s}"`);
      if (v < spec.min || v > spec.max) throw new Error(`figure "${fig.name}": ${key} = ${v} is outside [${spec.min}, ${spec.max}]`);
      return v;
    }
    case "toggle":
      if (s !== "true" && s !== "false") throw new Error(`figure "${fig.name}": ${key} must be true or false, got "${s}"`);
      return s === "true";
    case "choice": {
      const hit = spec.options.find((o) => String(o.value) === s);
      if (!hit) throw new Error(`figure "${fig.name}": ${key} = "${s}" is not one of ${spec.options.map((o) => o.value).join(", ")}`);
      return hit.value;
    }
  }
}

// Merge chapter-block overrides onto the defaults. `t` is reserved for the
// timeline's opening position and is returned separately.
export function resolve(fig: AnyFigure, entries: Record<string, string>): { p: ParamRecord; t?: number } {
  const p = defaults(fig);
  let t: number | undefined;
  for (const [k, v] of Object.entries(entries)) {
    if (k === "t") {
      if (!fig.timeline) throw new Error(`figure "${fig.name}" has no timeline, so "t" cannot be set`);
      t = Number(v);
      if (!Number.isFinite(t) || t < 0) throw new Error(`figure "${fig.name}": t must be a non-negative number, got "${v}"`);
      continue;
    }
    p[k] = coerce(fig, k, v);
  }
  return { p, t };
}

// Only the parameters that differ from the defaults, for data attributes.
export function overrides(fig: AnyFigure, p: ParamRecord): ParamRecord {
  const d = defaults(fig);
  const out: ParamRecord = {};
  for (const k of Object.keys(p)) if (p[k] !== d[k]) out[k] = p[k];
  return out;
}
