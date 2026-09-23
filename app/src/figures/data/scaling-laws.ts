// Published scaling-law coefficients and the closed-form compute-optimal
// allocation, shared by the compute-optimal-allocation and
// scaling-fit-extrapolation figures of the scaling-laws chapter.
//
// The loss surface is the chapter's fit
//
//   L(N, D) = E + A / N^α + B / D^β,   C = κ N D with κ = 6,
//
// and at a fixed budget C its minimum is (Hoffmann et al. 2022, eq. 4)
//
//   N* = G (C / 6)^a,  D* = G⁻¹ (C / 6)^b,
//   G = (α A / (β B))^(1 / (α + β)),  a = β / (α + β),  b = α / (α + β).

import { wrap } from "../lib/labels.ts";

export interface LossFit { E: number; A: number; alpha: number; B: number; beta: number }

export const KAPPA = 6;

// Three published estimates of the same surface on the same Chinchilla runs.
export const PUBLISHED = {
  // Besiroglu et al. (2024), "Chinchilla Scaling: A replication attempt",
  // arXiv 2404.10102, eq. 3 and Table 1: refit of Approach 3 to 240 runs
  // reconstructed from Hoffmann et al. Figure 4. Standard errors: E 0.03,
  // A 124.58, B 1293.23, α 0.02, β 0.02. The chapter's runnable cell uses these.
  refit: { E: 1.8172, A: 482.01, alpha: 0.3478, B: 2085.43, beta: 0.3658 },
  // Hoffmann et al. (2022), arXiv 2203.15556v1, Appendix D.2: the Approach 3
  // fit before rounding, from the comment after eq. 10 in the arXiv TeX
  // source (loss_offset 0.5267228, param_offset 6.0073404, param_slope
  // 0.33917084, token_offset 6.0179186, token_slope 0.2849083; E, A, B are the
  // exponentials of the offsets). These reproduce the paper's own projections:
  // N* = 40B at the Gopher budget (Figure 4) and 67B at 1.71e24 FLOP (Table A3).
  unrounded: { E: Math.exp(0.5267228), A: Math.exp(6.0073404), alpha: 0.33917084, B: Math.exp(6.0179186), beta: 0.2849083 },
  // Hoffmann et al. (2022), Appendix D.2, eq. 10, as printed.
  printed: { E: 1.69, A: 406.4, alpha: 0.34, B: 410.7, beta: 0.28 },
} as const satisfies Record<string, LossFit>;
export type FitKey = keyof typeof PUBLISHED;

// Kaplan et al. (2020), arXiv 2001.08361, Table 6: compute-efficient
// allocation N_opt = 1.3e9 · C_min^0.73 (non-embedding parameters) and
// D_opt = 2e10 · C_min^0.27 tokens, with C_min in PF-days (8.64e19 FLOP).
// It comes from their learning-curve fit L(N, S) at the critical batch size,
// not from a surface of the Chinchilla form.
export const KAPLAN = { Ne: 1.3e9, pN: 0.73, De: 2e10, pD: 0.27, pfDay: 8.64e19 } as const;

// Hoffmann et al. (2022), Section 4 and Table 3: Gopher (280B parameters,
// 300B tokens) and Chinchilla (70B, 1.4T) used the same budget, 5.76e23 FLOP.
export const GOPHER_BUDGET = 5.76e23;
export const MODELS = {
  chinchilla: { N: 70e9, D: 1.4e12 },
  gopher: { N: 280e9, D: 300e9 },
} as const;

export function loss(f: LossFit, N: number, D: number): number {
  return f.E + f.A / N ** f.alpha + f.B / D ** f.beta;
}

// The two excess-loss terms: model capacity and training data.
export function terms(f: LossFit, N: number, D: number): { cap: number; data: number } {
  return { cap: f.A / N ** f.alpha, data: f.B / D ** f.beta };
}

export function optimum(f: LossFit, C: number): { N: number; D: number; L: number; a: number; b: number } {
  const s = f.alpha + f.beta;
  const G = ((f.alpha * f.A) / (f.beta * f.B)) ** (1 / s);
  const a = f.beta / s, b = f.alpha / s;
  const N = G * (C / KAPPA) ** a;
  const D = C / (KAPPA * N);
  return { N, D, L: loss(f, N, D), a, b };
}

export function kaplan(C: number): { N: number; D: number } {
  const c = C / KAPLAN.pfDay;
  return { N: KAPLAN.Ne * c ** KAPLAN.pN, D: KAPLAN.De * c ** KAPLAN.pD };
}

// Counts the way the book writes model and data sizes: 70B, 1.4T, 280M.
export function count(v: number, digits = 3): string {
  const units: Array<[number, string]> = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "k"]];
  for (const [u, s] of units) {
    if (Math.abs(v) >= u * 0.9995) return `${trim(v / u, digits)}${s}`;
  }
  return trim(v, digits);
}

function trim(v: number, digits: number): string {
  return String(Number(v.toPrecision(digits)));
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
const sup = (n: number) => String(n).split("").map((c) => SUP[c] ?? c).join("");

// Scientific notation with a superscript exponent: 5.76 × 10²³, 10²⁰, 3 × 10¹⁹.
export function sci(v: number, digits = 3): string {
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = Number((v / 10 ** e).toPrecision(digits));
  if (m >= 10) { m /= 10; e += 1; }
  return m === 1 ? `10${sup(e)}` : `${m} × 10${sup(e)}`;
}

// A power of ten for an axis tick: 10¹⁸.
export function pow10(v: number): string {
  return `10${sup(Math.round(Math.log10(v)))}`;
}

// wrap() from lib/labels.ts, plus the CJK line-start rule: a line never starts
// with closing punctuation, so the last glyph of the previous line moves down
// with it.
const NO_LINE_START = new Set([..."，。、；：）」』！？,.;:)"]);
export function wrapCJK(s: string, size: number, maxWidth: number): string[] {
  const lines = wrap(s, size, maxWidth);
  for (let i = 1; i < lines.length; i++) {
    const prev = [...lines[i - 1]];
    if (NO_LINE_START.has([...lines[i]][0]) && prev.length > 1) {
      lines[i] = prev.pop()! + lines[i];
      lines[i - 1] = prev.join("");
    }
  }
  return lines;
}
