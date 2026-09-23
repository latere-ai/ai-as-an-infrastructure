// Seeded randomness. Figures that simulate must replay identically for the
// same parameters (so the static fallback, the live figure, and a screenshot
// agree), so they draw from a seeded generator, never Math.random.

// mulberry32: a small, fast 32-bit generator with good distribution for this use.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Exponential draw with rate lambda (inter-arrival gaps of a Poisson process).
export function exponential(u: number, lambda: number): number {
  return -Math.log(1 - u) / lambda;
}

// Integer in [lo, hi] inclusive.
export function intBetween(u: number, lo: number, hi: number): number {
  return lo + Math.floor(u * (hi - lo + 1));
}
