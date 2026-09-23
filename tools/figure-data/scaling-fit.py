# Regenerate app/src/figures/data/chinchilla-runs.ts: the Chinchilla training
# runs as reconstructed by Besiroglu et al. (2024) from Figure 4 of Hoffmann et
# al. (2022), and fits of the loss surface
#
#   L(N, D) = E + A / N^alpha + B / D^beta,    D = C / (6 N)
#
# on growing subsets of those runs, for the scaling-fit-extrapolation figure.
#
# Data: epoch-research/analyzing-chinchilla, data/svg_extracted_data.csv at
# commit 92258837425e1b5f2851d624287f0120583a3d0e (245 runs: model size N,
# training FLOP C, final loss L). Loss was read from the figure's color scale,
# so each value is accurate to about 0.01. The five runs with the fewest
# training tokens per parameter are excluded from every fit, as Besiroglu et
# al. do; they stay in the data file, flagged, so the figure can show them.
#
# Fit: the procedure of Hoffmann et al. (Appendix D.2), as replicated by
# Besiroglu et al.: minimize the summed Huber loss (delta = 1e-3) between
# LSE(a - alpha log N, b - beta log D, e) and log L with BFGS from a grid of
# starting points, then E, A, B = exp(e), exp(a), exp(b). Fitted on all 240
# runs this reproduces the refit of Besiroglu et al. (E = 1.8172, A = 482.01,
# B = 2085.43, alpha = 0.3478, beta = 0.3658) to within their standard errors.
#
# Each run belongs to the nearest of the nine IsoFLOP budgets (6e18 to 3e21).
# For each cutoff budget the surface is fitted on the runs at or below it; the
# runs above it are held out and scored. Uncertainty is a bootstrap over the
# fitted runs (resample with replacement, refit from the point estimate), and
# the file stores the 10th and 90th percentiles of the compute-optimal loss
# L*(C) and model size N*(C) on a grid of budgets.
#
#   pip install numpy scipy        (run with numpy 2.5.3, scipy 1.18.1)
#   python tools/figure-data/scaling-fit.py [path/to/svg_extracted_data.csv]

import csv
import io
import itertools
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from scipy.special import huber, logsumexp

COMMIT = "92258837425e1b5f2851d624287f0120583a3d0e"
URL = f"https://raw.githubusercontent.com/epoch-research/analyzing-chinchilla/{COMMIT}/data/svg_extracted_data.csv"
OUT = Path(__file__).resolve().parents[2] / "app" / "src" / "figures" / "data" / "chinchilla-runs.ts"

BUDGETS = [6e18, 1e19, 3e19, 6e19, 1e20, 3e20, 6e20, 1e21, 3e21]
CUTOFFS = [2, 3, 4, 5, 6, 7, 8]  # indices into BUDGETS: fit on runs at budgets[0..k]
DELTA = 1e-3
BOOTSTRAPS = 400
SEED = 20220329
GRID = [18 + 0.25 * i for i in range(29)]  # log10 C from 18 to 25
# Starting points: a coarser version of the grid in Hoffmann et al. D.2.
STARTS = list(itertools.product([0, 10, 20], [0, 10, 20], [-0.5, 0.5], [0.2, 0.6, 1.2], [0.2, 0.6, 1.2]))


def load(path):
    text = Path(path).read_text() if path else urllib.request.urlopen(URL).read().decode()
    rows = list(csv.DictReader(io.StringIO(text)))
    N = np.array([float(r["Model Size"]) for r in rows])
    C = np.array([float(r["Training FLOP"]) for r in rows])
    L = np.array([float(r["loss"]) for r in rows])
    return N, C, L


def objective(p, lN, lD, lL):
    a, b, e, alpha, beta = p
    pred = logsumexp(np.stack([a - alpha * lN, b - beta * lD, np.full_like(lN, e)]), axis=0)
    return np.sum(huber(DELTA, pred - lL))


def fit(N, D, L, starts):
    lN, lD, lL = np.log(N), np.log(D), np.log(L)
    best = None
    for x0 in starts:
        r = minimize(objective, np.array(x0, float), args=(lN, lD, lL), method="BFGS")
        if best is None or r.fun < best.fun:
            best = r
    return best.x


def coeffs(p):
    a, b, e, alpha, beta = p
    return math.exp(e), math.exp(a), float(alpha), math.exp(b), float(beta)


def predict(p, N, D):
    E, A, alpha, B, beta = coeffs(p)
    return E + A / N**alpha + B / D**beta


# Closed-form compute-optimal allocation under C = 6 N D (Hoffmann et al. eq. 4).
def optimum(p, C):
    E, A, alpha, B, beta = coeffs(p)
    G = (alpha * A / (beta * B)) ** (1 / (alpha + beta))
    Ns = G * (C / 6) ** (beta / (alpha + beta))
    Ds = C / (6 * Ns)
    return Ns, E + A / Ns**alpha + B / Ds**beta


def g(v, digits=4):
    return float(f"{v:.{digits}g}")


def main():
    N, C, L = load(sys.argv[1] if len(sys.argv) > 1 else None)
    D = C / (6 * N)
    outlier = np.zeros(len(N), bool)
    outlier[np.argsort(D / N)[:5]] = True
    budget = np.array([int(np.argmin(np.abs(np.log10(BUDGETS) - math.log10(c)))) for c in C])
    rng = np.random.default_rng(SEED)
    grid = 10 ** np.array(GRID)

    fits = []
    for k in CUTOFFS:
        inside = np.where(~outlier & (budget <= k))[0]
        held = np.where(~outlier & (budget > k))[0]
        p = fit(N[inside], D[inside], L[inside], STARTS)
        err_in = float(np.median(np.abs(predict(p, N[inside], D[inside]) - L[inside])))
        err_out = float(np.median(np.abs(predict(p, N[held], D[held]) - L[held]))) if len(held) else None
        boots_N, boots_L = [], []
        for _ in range(BOOTSTRAPS):
            s = rng.choice(inside, len(inside), replace=True)
            q = fit(N[s], D[s], L[s], [p])
            ns, ls = optimum(q, grid)
            boots_N.append(ns)
            boots_L.append(ls)
        boots_N, boots_L = np.array(boots_N), np.array(boots_L)
        E, A, alpha, B, beta = coeffs(p)
        fits.append({
            "budget": BUDGETS[k],
            "E": g(E, 5), "A": g(A, 5), "alpha": g(alpha, 4), "B": g(B, 5), "beta": g(beta, 4),
            "fitRuns": int(len(inside)), "heldRuns": int(len(held)),
            "errFit": g(err_in, 2), "errHeld": g(err_out, 2) if err_out is not None else None,
            "lossLo": [g(v) for v in np.percentile(boots_L, 10, axis=0)],
            "lossHi": [g(v) for v in np.percentile(boots_L, 90, axis=0)],
            "nLo": [g(v, 3) for v in np.percentile(boots_N, 10, axis=0)],
            "nHi": [g(v, 3) for v in np.percentile(boots_N, 90, axis=0)],
        })
        print(f"fit <= {BUDGETS[k]:.0e}: {len(inside)} runs, E={E:.4f} A={A:.2f} alpha={alpha:.4f} B={B:.2f} beta={beta:.4f}, "
              f"median |error| {err_in:.3f} fitted, {err_out if err_out is None else round(err_out, 3)} held out", file=sys.stderr)

    runs = [[g(n, 4), g(c, 4), round(float(l), 3), int(b), int(o)] for n, c, l, b, o in zip(N, C, L, budget, outlier)]
    def js(v):
        # Shortest literal for a rounded value: 6.796e9, 0.3473, 3.
        if v is None:
            return "null"
        if isinstance(v, int):
            return str(v)
        m, _, e = f"{v:.6g}".partition("e")
        return m + ("e" + str(int(e)) if e else "")
    lines = [
        "// Generated by tools/figure-data/scaling-fit.py; do not edit by hand.",
        "//",
        "// RUNS: the Chinchilla training runs reconstructed by Besiroglu et al. (2024)",
        "// from Figure 4 of Hoffmann et al. (2022), epoch-research/analyzing-chinchilla",
        f"// data/svg_extracted_data.csv at commit {COMMIT[:7]}. Each row is",
        "// [N parameters, C training FLOP, final loss L, IsoFLOP budget index, excluded].",
        "// Loss is read from a color scale and is accurate to about 0.01. The five",
        "// runs with the fewest tokens per parameter are excluded from every fit.",
        "//",
        "// FITS: L(N, D) = E + A / N^alpha + B / D^beta with D = C / (6N), fitted by",
        "// Huber loss (delta = 1e-3) on log L to the runs at or below `budget`;",
        f"// lossLo/lossHi and nLo/nHi are 10th and 90th percentiles over {BOOTSTRAPS}",
        "// bootstrap refits of the compute-optimal loss L*(C) and size N*(C) at",
        "// log10 C = GRID. errFit and errHeld are median absolute errors of the",
        "// fitted surface on the fitted and held-out runs.",
        "",
        f"export const BUDGETS = [{', '.join(js(b) for b in BUDGETS)}] as const;",
        f"export const GRID = [{', '.join(js(v) for v in GRID)}] as const;",
        "",
        "export type Run = readonly [number, number, number, number, number];",
        "export const RUNS: readonly Run[] = [",
        *[f"  [{', '.join(js(v) for v in r)}]," for r in runs],
        "];",
        "",
        "export interface CutoffFit {",
        "  budget: number; E: number; A: number; alpha: number; B: number; beta: number;",
        "  fitRuns: number; heldRuns: number; errFit: number; errHeld: number | null;",
        "  lossLo: number[]; lossHi: number[]; nLo: number[]; nHi: number[];",
        "}",
        "export const FITS: readonly CutoffFit[] = [",
    ]
    for f in fits:
        body = ", ".join(f"{k}: [{', '.join(js(x) for x in v)}]" if isinstance(v, list) else f"{k}: {js(v)}" for k, v in f.items())
        lines.append(f"  {{ {body} }},")
    lines.append("];")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
