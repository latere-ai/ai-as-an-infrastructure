// Number and unit formatting shared by axes, readouts, and controls. Both book
// languages use Arabic numerals with comma grouping and SI prefixes, so the
// formatters take no language; unit words that differ by language come from
// the figure's label table.

const SI_UP = ["", "k", "M", "G", "T", "P", "E"];
const SI_DOWN = ["", "m", "µ", "n", "p"];

// Significant-figure rounding that drops trailing zeros: 3 → "3", 0.1666 → "0.17".
export function sig(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "–";
  if (v === 0) return "0";
  const s = Number(v.toPrecision(digits));
  const abs = Math.abs(s);
  const out = abs >= 1000 ? Math.round(s).toLocaleString("en-US") : String(s);
  return out.replace(/^-/, "−");
}

// Fixed decimals with a typographic minus.
export function fixed(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace(/^-/, "−");
}

export function int(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

export function pct(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

// SI prefix: si(3.35e12, "B/s") → "3.35 TB/s"; si(4e-5, "s") → "40 µs".
export function si(v: number, unit: string, digits = 3): string {
  if (v === 0 || !Number.isFinite(v)) return `${sig(v, digits)} ${unit}`.trim();
  const abs = Math.abs(v);
  let k = 0;
  if (abs >= 1) {
    while (k < SI_UP.length - 1 && abs / 1000 ** (k + 1) >= 0.9995) k++;
    return `${sig(v / 1000 ** k, digits)} ${SI_UP[k]}${unit}`.trim();
  }
  while (k < SI_DOWN.length - 1 && abs * 1000 ** k < 0.9995) k++;
  return `${sig(v * 1000 ** k, digits)} ${SI_DOWN[k]}${unit}`.trim();
}

// Compact tick label for a log axis decade or 1-2-5 value: 1000 → "1k", 0.1 → "0.1".
export function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return si(v, "", 3).replace(/\s+/g, "");
  return sig(v, 3);
}

// Fill {name} placeholders in a label template: tpl("R{i} frees {k}", { i: 3, k: 2 }).
// {name:one/many} picks the English singular or plural form by the value:
// tpl("{k:block is/blocks are} free", { k: 1 }) gives "1 block is free".
export function tpl(s: string, vars: Record<string, string | number>): string {
  return s
    .replace(/\{(\w+):([^/{}]*)\/([^{}]*)\}/g, (m, k: string, one: string, many: string) =>
      (k in vars ? `${vars[k]} ${Number(vars[k]) === 1 ? one : many}` : m))
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
