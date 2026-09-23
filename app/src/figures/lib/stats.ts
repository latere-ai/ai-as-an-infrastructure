// Probability helpers for figures that compute distributions exactly instead
// of simulating them: the normal tail and quantile, log-odds, binomial
// probabilities from a log-factorial table, and a deterministic population of
// per-problem success rates.

// Complementary error function with fractional error below 1.2e-7 everywhere
// (Numerical Recipes erfcc, a Chebyshev fit), so tail probabilities keep
// their relative precision far from the mean.
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418
    + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

// Upper tail of the standard normal, P(Z > z).
export function normalTail(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

// Standard normal density.
export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

// Inverse of the standard normal CDF (Acklam's rational approximation,
// relative error below 1.2e-9).
export function normalQuantile(u: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  const tail = (q: number) => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (u <= 0) return -Infinity;
  if (u >= 1) return Infinity;
  if (u < lo) return tail(Math.sqrt(-2 * Math.log(u)));
  if (u > 1 - lo) return -tail(Math.sqrt(-2 * Math.log(1 - u)));
  const q = u - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// A standard normal draw from two uniforms (Box-Muller), for seeded noise.
export function normalFrom(u1: number, u2: number): number {
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
}

export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (l: number) => 1 / (1 + Math.exp(-l));

// ln(n!) for n = 0..size-1, grown on demand and shared by every caller.
let LF = new Float64Array([0, 0]);
export function logFactorial(n: number): number {
  if (n >= LF.length) {
    const next = new Float64Array(Math.max(n + 1, LF.length * 2));
    next.set(LF);
    for (let i = LF.length; i < next.length; i++) next[i] = next[i - 1] + Math.log(i);
    LF = next;
  }
  return LF[n];
}

// Binomial probability P(X = j) for X ~ Bin(n, r), exact at r = 0 and r = 1.
export function binomPmf(n: number, j: number, r: number): number {
  if (j < 0 || j > n) return 0;
  if (r <= 0) return j === 0 ? 1 : 0;
  if (r >= 1) return j === n ? 1 : 0;
  logFactorial(n);
  return Math.exp(LF[n] - LF[j] - LF[n - j] + j * Math.log(r) + (n - j) * Math.log1p(-r));
}

// n per-problem success probabilities whose log-odds are the n quantiles of a
// normal with the given median and standard deviation (spread, in log-odds).
// Quantiles instead of draws make the population deterministic and smooth:
// spread 0 is n copies of one problem.
export function logitNormalQuantiles(median: number, spread: number, n: number): number[] {
  const m = logit(median);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(sigmoid(m + (spread > 0 ? spread * normalQuantile((i + 0.5) / n) : 0)));
  return out;
}
