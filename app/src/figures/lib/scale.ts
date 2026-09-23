// Linear and logarithmic scales with readable ticks. A scale maps a data
// domain to a pixel range; ticks() returns values in data units (1-2-5 steps
// for linear, decades for log) so axes print real numbers, never internal units.

export interface Scale {
  (v: number): number;
  kind: "linear" | "log";
  domain: [number, number];
  range: [number, number];
  invert(px: number): number;
  ticks(count?: number): number[];
  minorTicks(): number[]; // log only: 2..9 within each decade; [] for linear
  clamp(v: number): number; // clamp a data value into the domain
}

// The 1-2-5 step closest to span / count.
export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = (r1 - r0) / (d1 - d0 || 1);
  const s = ((v: number) => r0 + (v - d0) * k) as Scale;
  s.kind = "linear";
  s.domain = domain;
  s.range = range;
  s.invert = (px) => d0 + (px - r0) / k;
  s.clamp = (v) => Math.min(Math.max(v, Math.min(d0, d1)), Math.max(d0, d1));
  s.ticks = (count = 5) => {
    const lo = Math.min(d0, d1), hi = Math.max(d0, d1);
    const step = niceStep(hi - lo, count);
    const out: number[] = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
    return out;
  };
  s.minorTicks = () => [];
  return s;
}

export function log(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  if (d0 <= 0 || d1 <= 0) throw new Error("log scale domain must be positive");
  const [r0, r1] = range;
  const l0 = Math.log10(d0), l1 = Math.log10(d1);
  const k = (r1 - r0) / (l1 - l0 || 1);
  const s = ((v: number) => r0 + (Math.log10(Math.max(v, 1e-300)) - l0) * k) as Scale;
  s.kind = "log";
  s.domain = domain;
  s.range = range;
  s.invert = (px) => 10 ** (l0 + (px - r0) / k);
  s.clamp = (v) => Math.min(Math.max(v, Math.min(d0, d1)), Math.max(d0, d1));
  // Decades; if the domain spans fewer than two, add the 2 and 5 steps.
  s.ticks = () => {
    const lo = Math.min(l0, l1), hi = Math.max(l0, l1);
    const out: number[] = [];
    for (let e = Math.ceil(lo - 1e-9); e <= Math.floor(hi + 1e-9); e++) out.push(Number((10 ** e).toPrecision(12)));
    if (hi - lo < 2) {
      for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
        for (const m of [2, 5]) {
          const v = m * 10 ** e;
          const lv = Math.log10(v);
          if (lv >= lo - 1e-9 && lv <= hi + 1e-9) out.push(Number(v.toPrecision(12)));
        }
      }
      out.sort((a, b) => a - b);
    }
    return out;
  };
  s.minorTicks = () => {
    const lo = Math.min(l0, l1), hi = Math.max(l0, l1);
    const out: number[] = [];
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
      for (let m = 2; m <= 9; m++) {
        const lv = Math.log10(m * 10 ** e);
        if (lv > lo && lv < hi) out.push(m * 10 ** e);
      }
    }
    return out;
  };
  return s;
}

// Integer band layout: n equal cells across [r0, r1] with a gap between them.
export function band(n: number, range: [number, number], gap = 2): { size: number; at(i: number): number } {
  const [r0, r1] = range;
  const size = Math.max(0, (r1 - r0 - gap * (n - 1)) / n);
  return { size, at: (i) => r0 + i * (size + gap) };
}
