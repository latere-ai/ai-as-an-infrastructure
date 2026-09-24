# Regenerate app/src/figures/data/compute-law-frontier.ts: the compute
# frontier of the Chinchilla training runs and two compute-only fits of it,
# for the compute-law-fit figure of the field-map chapter.
#
# The chapter writes the compute-only law with a constant floor,
#
#   L(C) = L_inf + A C^(-alpha),
#
# and notes that the compute law of Kaplan et al. (2020) is the pure power law,
# L_inf = 0. This script fits both forms to the same measured points and
# records how far their forecasts separate outside the measured range.
#
# Data: the training runs reconstructed by Besiroglu et al. (2024) from Figure 4
# of Hoffmann et al. (2022), epoch-research/analyzing-chinchilla,
# data/svg_extracted_data.csv at commit 92258837425e1b5f2851d624287f0120583a3d0e
# (245 runs: model size N, training FLOP C, final loss L; loss read from the
# figure's color scale, accurate to about 0.01). The five runs with the fewest
# training tokens per parameter are excluded, as in scaling-fit.py.
#
# Frontier points: one per IsoFLOP budget (6e18 to 3e21 FLOP). A budget's slice
# is the runs whose C is within a factor 1.2 of the budget; the reconstructed
# file also holds runs at other compute (a stray 1.3e22 FLOP run sits nearest
# the 3e21 budget), so the slice is taken on C itself, not on the nearest
# budget. The frontier loss of a slice is the minimum over the slice's range of
# model sizes of a parabola in log10 N fitted to its losses (Approach 2 of
# Hoffmann et al.): the lowest loss the budget reaches with the best model size.
#
# Fits: least squares on log L of each form to the frontier points at or below
# a cutoff budget; the points above the cutoff are held out and scored.
# Uncertainty: a bootstrap over runs. Each replicate resamples the runs within
# every slice with replacement, recomputes the nine frontier points, and refits
# both forms, so the band reflects the scatter of the runs behind each point.
# The file stores the 10th and 90th percentiles of each form's L(C) on a grid of
# budgets, and of each frontier point.
#
#   pip install numpy scipy        (run with numpy 2.5.3, scipy 1.18.1)
#   python tools/figure-data/compute-law-fit.py [path/to/svg_extracted_data.csv]

import csv
import io
import math
import sys
import urllib.request
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

COMMIT = "92258837425e1b5f2851d624287f0120583a3d0e"
URL = f"https://raw.githubusercontent.com/epoch-research/analyzing-chinchilla/{COMMIT}/data/svg_extracted_data.csv"
OUT = Path(__file__).resolve().parents[2] / "app" / "src" / "figures" / "data" / "compute-law-frontier.ts"

BUDGETS = [6e18, 1e19, 3e19, 6e19, 1e20, 3e20, 6e20, 1e21, 3e21]
TOL = 1.2  # a run belongs to a budget's slice when C is within this factor of it
CUTOFFS = [4, 5, 6, 7, 8]  # indices into BUDGETS: fit on budgets[0..k]
BOOTSTRAPS = 1000
SEED = 20200123
GRID = [18 + 0.125 * i for i in range(57)]  # log10 C from 18 to 25
C0 = 1e18  # compute is scaled by C0 inside the fits for conditioning


def load(path):
    text = Path(path).read_text() if path else urllib.request.urlopen(URL).read().decode()
    rows = list(csv.DictReader(io.StringIO(text)))
    N = np.array([float(r["Model Size"]) for r in rows])
    C = np.array([float(r["Training FLOP"]) for r in rows])
    L = np.array([float(r["loss"]) for r in rows])
    return N, C, L


# Lowest loss of a parabola in log10 N over the slice's range of model sizes.
def frontier_loss(lN, L):
    a, b, c = np.polyfit(lN, L, 2)
    lo, hi = lN.min(), lN.max()
    xs = [lo, hi]
    if a > 0:
        xs.append(min(max(-b / (2 * a), lo), hi))
    return min(a * x * x + b * x + c for x in xs), (-b / (2 * a) if a > 0 else float("nan"))


def fit_pure(c, L):
    # log L = log A - alpha log c: ordinary least squares.
    slope, icpt = np.polyfit(np.log(c), np.log(L), 1)
    return 0.0, math.exp(icpt), -slope


def fit_floor(c, L):
    lc, lL = np.log(c), np.log(L)
    top = L.min() - 1e-3

    def resid(q):
        linf, la, alpha = q
        return np.log(linf + np.exp(la - alpha * lc)) - lL

    best = None
    # Starting points from the profile over L_inf: a line through log(L - L_inf).
    for linf in np.linspace(0, top, 12):
        slope, icpt = np.polyfit(lc, np.log(L - linf), 1)
        x0 = [linf, icpt, max(1e-4, -slope)]
        r = least_squares(resid, x0, bounds=([0, -50, 1e-4], [top, 50, 3]))
        if best is None or r.cost < best.cost:
            best = r
    linf, la, alpha = best.x
    return float(linf), math.exp(la), float(alpha)


def predict(f, c):
    linf, A, alpha = f
    return linf + A * c ** (-alpha)


# A in the units of C itself (FLOP): A_c c^-alpha = A_c (C / C0)^-alpha.
def in_flop(f):
    linf, A, alpha = f
    return linf, A * C0 ** alpha, alpha


def g(v, digits=4):
    return float(f"{v:.{digits}g}")


def main():
    N, C, L = load(sys.argv[1] if len(sys.argv) > 1 else None)
    D = C / (6 * N)
    keep = np.ones(len(N), bool)
    keep[np.argsort(D / N)[:5]] = False
    slices = [np.where(keep & (np.abs(np.log10(C / b)) < math.log10(TOL)))[0] for b in BUDGETS]
    lN = np.log10(N)
    budgets = np.array(BUDGETS) / C0
    grid = 10 ** np.array(GRID) / C0

    points = [frontier_loss(lN[s], L[s]) for s in slices]
    front = np.array([p[0] for p in points])

    rng = np.random.default_rng(SEED)
    boot_front = []
    for _ in range(BOOTSTRAPS):
        row = []
        for s in slices:
            r = rng.choice(s, len(s), replace=True)
            row.append(frontier_loss(lN[r], L[r])[0])
        boot_front.append(row)
    boot_front = np.array(boot_front)

    fits = []
    for k in CUTOFFS:
        inside = slice(0, k + 1)
        entry = {"budget": BUDGETS[k], "points": k + 1}
        for form, fitter in (("pure", fit_pure), ("floor", fit_floor)):
            f = fitter(budgets[inside], front[inside])
            err_in = float(np.median(np.abs(predict(f, budgets[inside]) - front[inside])))
            held = front[k + 1:]
            err_out = float(np.median(np.abs(predict(f, budgets[k + 1:]) - held))) if len(held) else None
            curves = np.array([predict(fitter(budgets[inside], b[inside]), grid) for b in boot_front])
            linf, A, alpha = in_flop(f)
            entry[form] = {
                "Linf": g(linf, 4), "A": g(A, 5), "alpha": g(alpha, 4),
                "errFit": g(err_in, 2), "errHeld": g(err_out, 2) if err_out is not None else None,
                "lo": [g(v) for v in np.percentile(curves, 10, axis=0)],
                "hi": [g(v) for v in np.percentile(curves, 90, axis=0)],
            }
            print(f"fit <= {BUDGETS[k]:.0e} {form:5s}: L_inf={linf:.3f} A={A:.4g} alpha={alpha:.4f}, "
                  f"median |error| {err_in:.4f} fitted, {err_out if err_out is None else round(err_out, 4)} held out, "
                  f"L(5.76e23) = {predict(f, 5.76e23 / C0):.3f}", file=sys.stderr)
        fits.append(entry)

    rows = []
    for i, (s, (lf, xv)) in enumerate(zip(slices, points)):
        rows.append({
            "C": BUDGETS[i], "L": g(lf, 4),
            "lo": g(float(np.percentile(boot_front[:, i], 10)), 4),
            "hi": g(float(np.percentile(boot_front[:, i], 90)), 4),
            "runs": int(len(s)), "N": g(10 ** xv, 3),
        })
        print(f"budget {BUDGETS[i]:.0e}: {len(s)} runs, frontier L = {lf:.4f} at N = {10 ** xv:.3g}", file=sys.stderr)

    def js(v):
        if v is None:
            return "null"
        if isinstance(v, int):
            return str(v)
        m, _, e = f"{v:.6g}".partition("e")
        return m + ("e" + str(int(e)) if e else "")

    def obj(d):
        return "{ " + ", ".join(
            f"{k}: [{', '.join(js(x) for x in v)}]" if isinstance(v, list)
            else f"{k}: {obj(v)}" if isinstance(v, dict)
            else f"{k}: {js(v)}" for k, v in d.items()) + " }"

    lines = [
        "// Generated by tools/figure-data/compute-law-fit.py; do not edit by hand.",
        "//",
        "// POINTS: the compute frontier of the Chinchilla runs reconstructed by",
        "// Besiroglu et al. (2024) from Figure 4 of Hoffmann et al. (2022),",
        f"// epoch-research/analyzing-chinchilla data/svg_extracted_data.csv at commit {COMMIT[:7]}.",
        f"// One point per IsoFLOP budget C: the runs with training compute within a",
        f"// factor {TOL} of C, and the lowest loss L of a parabola in log10 N fitted",
        "// to them (Approach 2 of Hoffmann et al.), at the model size N. lo and hi are",
        f"// the 10th and 90th percentiles over {BOOTSTRAPS} bootstrap resamples of the runs.",
        "//",
        "// FITS: L(C) = Linf + A C^-alpha with C in FLOP, least squares on log L to",
        "// the points at or below `budget`: `pure` fixes Linf = 0 (the form of Kaplan",
        "// et al. 2020), `floor` fits Linf. errFit and errHeld are median absolute",
        "// errors on the fitted and held-out points; lo and hi are the 10th and 90th",
        "// percentiles of the fitted L(C) at log10 C = GRID over the same bootstrap.",
        "",
        f"export const GRID = [{', '.join(js(v) for v in GRID)}] as const;",
        "",
        "export interface FrontierPoint { C: number; L: number; lo: number; hi: number; runs: number; N: number }",
        "export const POINTS: readonly FrontierPoint[] = [",
        *[f"  {obj(r)}," for r in rows],
        "];",
        "",
        "export interface FormFit { Linf: number; A: number; alpha: number; errFit: number; errHeld: number | null; lo: number[]; hi: number[] }",
        "export interface CutoffFit { budget: number; points: number; pure: FormFit; floor: FormFit }",
        "export const FITS: readonly CutoffFit[] = [",
        *[f"  {obj(f)}," for f in fits],
        "];",
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
