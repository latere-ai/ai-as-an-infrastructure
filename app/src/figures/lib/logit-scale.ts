// A log-odds scale for probabilities: p maps to ln(p / (1 − p)), so 0.01 and
// 0.99 sit symmetrically about 0.5 and both tails keep their resolution. It
// implements the Scale interface, so axis() draws it; ticks are the usual
// probability landmarks within the domain.

import type { Scale } from "./scale.ts";

const lo = (p: number) => Math.log(p / (1 - p));

const LANDMARKS = [0.0001, 0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999, 0.9999];

export function logitScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  if (!(d0 > 0 && d0 < 1 && d1 > 0 && d1 < 1)) throw new Error("logit scale domain must lie inside (0, 1)");
  const [r0, r1] = range;
  const l0 = lo(d0), l1 = lo(d1);
  const k = (r1 - r0) / (l1 - l0 || 1);
  const clampP = (v: number) => Math.min(Math.max(v, Math.min(d0, d1)), Math.max(d0, d1));
  const s = ((v: number) => r0 + (lo(Math.min(Math.max(v, 1e-12), 1 - 1e-12)) - l0) * k) as Scale;
  s.kind = "linear";
  s.domain = domain;
  s.range = range;
  s.invert = (px) => 1 / (1 + Math.exp(-(l0 + (px - r0) / k)));
  s.clamp = clampP;
  s.ticks = () => LANDMARKS.filter((v) => v >= Math.min(d0, d1) && v <= Math.max(d0, d1));
  s.minorTicks = () => [];
  return s;
}
