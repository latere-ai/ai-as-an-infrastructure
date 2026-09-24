# Regenerate app/src/figures/data/reward-overoptimization.ts: the gold-score
# coefficients and the measured run traces of Gao, Schulman and Hilton,
# "Scaling Laws for Reward Model Overoptimization" (arXiv:2210.10760v1, 2022),
# read from the raster figures embedded in that PDF.
#
# The paper states its fitted forms in the text, with d = sqrt(KL(pi || pi_init)):
#
#   best-of-n   R_bon(d) = d (alpha_bon - beta_bon d)
#   RL (PPO)    R_RL(d)  = d (alpha_RL - beta_RL ln d)
#
# but prints no coefficient table. The coefficients per reward-model size are
# the dots of Figure 3 (a: alpha_bon, b: beta_bon, c: beta_RL); this script
# finds each dot's center and maps it through the plot's gridlines. alpha_RL
# is held constant across sizes in the paper and its value is not printed; it
# is recovered here by least squares against the measured gold curves of the
# three RL runs below, with beta_RL fixed at the Figure 3c values. The paper
# fits no form to the proxy score, so proxy scores and KL-per-step are the
# measured curves, traced by color:
#
#   Figure 20  best-of-n proxy scores, every RM size (dashed)
#   Figure 7b  RL, 12M RM, 1.2B policy (proxy dashed, gold solid)
#   Figure 9   RL, 1.2B RM, 1.2B policy, KL penalty 0, 0.01, 0.05, 0.1, 0.5
#   Figure 22  RL, 3B RM, 1.2B policy
#   Figure 14  KL against PPO step, 1.2B RM, per KL penalty
#   Figure 15  KL against PPO step, 12M RM, 1.2B policy
#   Figure 16  KL against PPO step, 3B RM
#
#   python -m venv venv && venv/bin/pip install pypdf pillow numpy
#   venv/bin/python tools/figure-data/reward-overoptimization-gao2022.py [cache.pdf]
#
# Run with pypdf 6.1, Pillow 11.3, numpy 2.3. Pass --debug to write overlay
# PNGs of every trace next to the cached PDF for checking by eye.

import io
import json
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pypdf
from PIL import Image, ImageDraw

URL = "https://arxiv.org/pdf/2210.10760v1"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "app" / "src" / "figures" / "data" / "reward-overoptimization.ts"
BG = np.array([234, 234, 242])  # seaborn darkgrid axes face
SIZES = ["3M", "12M", "25M", "42M", "85M", "300M", "680M", "1.2B", "3B"]
# seaborn viridis colors of the nine RM sizes (Figures 1, 16, 20) and of the
# five KL penalties (Figures 9, 14), as drawn in the PDF.
SIZE_COLOR = {"3M": (72, 36, 117), "12M": (65, 68, 135), "25M": (53, 95, 141), "42M": (42, 120, 142), "85M": (33, 145, 140),
              "300M": (34, 168, 132), "680M": (68, 191, 112), "1.2B": (122, 209, 81), "3B": (189, 223, 38)}
PENALTY_COLOR = {"0": (68, 57, 131), "0.01": (49, 104, 142), "0.05": (33, 145, 140), "0.1": (53, 183, 121), "0.5": (144, 215, 67)}
BLUE = (76, 114, 176)  # seaborn default first color (Figures 3, 7b, 15, 22)

args = [a for a in sys.argv[1:] if not a.startswith("--")]
DEBUG = "--debug" in sys.argv
CACHE = Path(args[0]) if args else Path(os.environ.get("TMPDIR", "/tmp")) / "gao2022-2210.10760v1.pdf"
if not CACHE.exists():
    urllib.request.urlretrieve(URL, CACHE)
PDF = pypdf.PdfReader(str(CACHE))


def image(page, name):
    """One embedded raster figure: 1-based page number and XObject name."""
    for im in PDF.pages[page - 1].images:
        if im.name.startswith(name + "."):
            return np.array(Image.open(io.BytesIO(im.data)).convert("RGB")).astype(int)
    raise KeyError(f"page {page} has no image {name}")


def runs(idx):
    """Split sorted integer indices into runs of consecutive values."""
    if len(idx) == 0:
        return []
    out, cur = [], [idx[0]]
    for i in idx[1:]:
        if i == cur[-1] + 1:
            cur.append(i)
        else:
            out.append(cur)
            cur = [i]
    out.append(cur)
    return out


def plot_box(a):
    ys, xs = np.where(np.all(a == BG, axis=2))
    return xs.min(), xs.max(), ys.min(), ys.max()


def gridlines(a):
    """Pixel centers of the white vertical and horizontal gridlines."""
    x0, x1, y0, y1 = plot_box(a)
    white = np.all(a[y0:y1 + 1, x0:x1 + 1] >= 250, axis=2)
    cols = runs(np.where(white.mean(axis=0) > 0.5)[0])
    rows = runs(np.where(white.mean(axis=1) > 0.5)[0])
    return [x0 + float(np.mean(c)) for c in cols], [y0 + float(np.mean(r)) for r in rows]


class Axes:
    """Pixel to data for one plot, from its gridlines and their tick values.
    xform maps a data x to the plotted coordinate: sqrt for the KL axes,
    log10 for RM size, identity for PPO step."""

    def __init__(self, a, xticks, yticks, xform=lambda v: v, xinv=lambda v: v):
        gx, gy = gridlines(a)
        if len(gx) != len(xticks) or len(gy) != len(yticks):
            raise ValueError(f"gridlines {len(gx)}x{len(gy)} do not match ticks {len(xticks)}x{len(yticks)}")
        self.cx = np.polyfit(gx, [xform(v) for v in xticks], 1)
        self.cy = np.polyfit(gy, yticks, 1)
        self.xform, self.xinv = xform, xinv
        # Largest residual of the gridline fit, in data units: a check on the tick assignment.
        self.resid = max(abs(np.polyval(self.cy, gy) - yticks).max(), abs(np.polyval(self.cx, gx) - [xform(v) for v in xticks]).max())

    def x(self, px):
        return self.xinv(np.polyval(self.cx, px))

    def y(self, py):
        return np.polyval(self.cy, py)

    def px(self, x, y):
        """Data back to pixels, for the debug overlays."""
        return ((self.xform(x) - self.cx[1]) / self.cx[0], (y - self.cy[1]) / self.cy[0])


def dot_centers(a, r=4.5):
    """Centers of the filled scatter dots of a seaborn regplot (Figure 3)."""
    R, B = a[..., 0], a[..., 2]
    blue = ((B - R > 40) & (R < 160)).astype(float)
    H, W = blue.shape
    score = np.zeros((H, W))
    area = 0
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            if dx * dx + dy * dy <= r * r:
                area += 1
                score[5:H - 5, 5:W - 5] += blue[5 + dy:H - 5 + dy, 5 + dx:W - 5 + dx]
    score /= area
    pts = []
    while score.max() >= 0.8:  # a thin regression line never fills the disk
        y, x = np.unravel_index(np.argmax(score), score.shape)
        win = score[y - 4:y + 5, x - 4:x + 5]
        wy, wx = np.where(win >= win.max() - 0.03)
        pts.append((x - 4 + wx.mean(), y - 4 + wy.mean()))
        score[y - 8:y + 9, x - 8:x + 9] = 0
    return sorted(pts)


def trace(a, color, tol=14, thick=2, mask=None):
    """Every vertical run of `color` at least `thick` pixels tall, per column,
    inside the plot box and outside the legend box(es) `mask`: [(x, y), ...].
    Thin fit lines drawn in the same color (Figure 20) drop out."""
    masks = [] if mask is None else [mask] if isinstance(mask[0], (int, float)) else list(mask)
    x0, x1, y0, y1 = plot_box(a)
    hit = np.abs(a - np.array(color)).max(axis=2) <= tol
    pts = []
    for x in range(x0 + 1, x1):
        for rr in runs(np.where(hit[y0:y1, x])[0]):
            if len(rr) >= thick:
                y = y0 + float(np.mean(rr))
                if any(m[0] <= x <= m[2] and m[1] <= y <= m[3] for m in masks):
                    continue
                pts.append((float(x), y))
    return pts


def split(pts):
    """Separate a same-colored proxy (upper) and gold (lower) pair. Columns
    with two runs set both; a column with one run joins the nearer series."""
    by = {}
    for x, y in pts:
        by.setdefault(x, []).append(y)
    top, bot = {}, {}
    for x, ys in by.items():
        if len(ys) >= 2:
            top[x], bot[x] = min(ys), max(ys)
    tx, bx = np.array(sorted(top)), np.array(sorted(bot))
    for x, ys in by.items():
        if len(ys) == 1 and len(tx):
            yt = np.interp(x, tx, [top[k] for k in tx])
            yb = np.interp(x, bx, [bot[k] for k in bx])
            (top if abs(ys[0] - yt) <= abs(ys[0] - yb) else bot)[x] = ys[0]
    return sorted(top.items()), sorted(bot.items())


def resample(pts, ax, grid, origin=True):
    """Median-filter traced pixels, convert to data, and sample at `grid`
    (data x values) inside the traced extent. Pixels left of the x origin
    (the axes margin) are dropped. Interpolation runs in the plotted
    coordinate (sqrt(KL) on the KL axes), so a stretch hidden under other
    curves, typically near the origin where all runs coincide, is bridged by
    a straight segment on the paper's own axis."""
    pts = sorted(p for p in pts if np.polyval(ax.cx, p[0]) > 0)
    px = np.array([p[0] for p in pts])
    ys = np.array([ax.y(p[1]) for p in pts])
    # Running median over the columns within 3 pixels removes stray pixels
    # from crossing lines without reaching across a gap.
    med = np.array([np.median(ys[np.abs(px - x) <= 3]) for x in px])
    us = np.polyval(ax.cx, px)
    if origin:
        us, med = np.concatenate([[0.0], us]), np.concatenate([[0.0], med])
    end = float(ax.xinv(us.max()))
    g = [v for v in grid if v <= end] + ([end] if grid[-1] > end else [])
    return [[float(v), float(np.interp(ax.xform(v), us, med))] for v in g], end


def overlay(a, ax, series, name):
    """With --debug, draw the resampled data back onto the source figure."""
    if not DEBUG:
        return
    im = Image.fromarray(a.astype(np.uint8)).convert("RGB")
    d = ImageDraw.Draw(im)
    for pts in series:
        for x, y in pts:
            px, py = ax.px(x, y)
            d.ellipse([px - 2.5, py - 2.5, px + 2.5, py + 2.5], outline=(230, 0, 0), width=1)
    im.save(CACHE.parent / f"gao-debug-{name}.png")


sq, unsq = np.sqrt, np.square

# ---- Figure 3: coefficients per RM size
coef = {s: {} for s in SIZES}
for key, name, yticks in [("alphaBon", "Im4", [0.70, 0.65, 0.60, 0.55, 0.50]),
                          ("betaBon", "Im5", [0.12, 0.11, 0.10, 0.09]),
                          ("betaRl", "Im6", [0.18, 0.16, 0.14, 0.12, 0.10])]:
    a = image(5, name)
    ax = Axes(a, [1e7, 1e8, 1e9], yticks, np.log10, lambda v: 10 ** v)
    pts = dot_centers(a)
    assert len(pts) == 9, f"Figure 3 {key}: found {len(pts)} dots"
    for s, (x, y) in zip(SIZES, pts):
        coef[s][key] = round(float(ax.y(y)), 4)
        coef[s]["params"] = float(f"{ax.x(x):.3g}")

# ---- alpha_RL: one constant across sizes (Section 3.2), least squares over
# the measured gold curves of Figure 1b, the curves the Figure 3c values were
# fitted to, with beta_RL fixed at Figure 3c. Points below KL = 1 are left out:
# the form has infinite slope at the origin and the paper notes it likely does
# not hold there.
KL_RL = [20, 40, 60, 80, 100]
FIG1_LEGENDS = [(350, 230, 1000, 930), (1000, 230, 1400, 540)]
a = image(3, "Im2")
ax = Axes(a, KL_RL, [1.4, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2], sq, unsq)
num = den = 0.0
fig1 = {}
for size in SIZES:
    by = {}
    # Gold lines are drawn opaque and 4+ px tall at this resolution; the
    # proxy lines are translucent and the fit lines thin, so neither matches.
    for x, y in trace(a, SIZE_COLOR[size], tol=8, thick=4, mask=FIG1_LEGENDS):
        by.setdefault(x, []).append(y)
    P = np.array([(ax.x(x), ax.y(np.median(ys))) for x, ys in by.items() if np.polyval(ax.cx, x) > 0])
    P = P[P[:, 0] >= 1]
    d, b = np.sqrt(P[:, 0]), coef[size]["betaRl"]
    num += np.sum(d * (P[:, 1] + b * d * np.log(d)))
    den += np.sum(d * d)
    fig1[size] = (d, P[:, 1], b)
alpha_rl = round(float(num / den), 3)
fit_rms = {}
for size, (d, g, b) in fig1.items():
    fit_rms[size] = round(float(np.sqrt(np.mean((g - d * (alpha_rl - b * np.log(d))) ** 2))), 3)

# ---- RL runs: proxy and gold against KL, KL against PPO step
RL_GRID = [round(v * v, 4) for v in np.arange(0, 10.001, 0.25)]  # d = sqrt(KL) in steps of 0.25
STEP_GRID = [round(v, 2) for v in np.arange(0, 3.001, 0.05)]  # million PPO steps
# Upper-left legend boxes of the 900 x 600 appendix plots, by entry count.
LEGEND = (116, 74, 222, 222)
LEGEND9 = (116, 74, 222, 310)
rl = {}


def rl_run(size, page, name, yticks, color, key="0"):
    a = image(page, name)
    ax = Axes(a, KL_RL, yticks, sq, unsq)
    proxy, gold = split(trace(a, color, mask=LEGEND))
    pr, end = resample(proxy, ax, RL_GRID)
    gr, _ = resample(gold, ax, RL_GRID)
    overlay(a, ax, [pr, gr], f"rl-{size}-{key}")
    rl.setdefault(size, {})[key] = {"proxy": pr, "gold": gr, "end": round(end, 1)}


rl_run("12M", 7, "Im12", [1.75, 1.50, 1.25, 1.00, 0.75, 0.50, 0.25, 0.0], BLUE)
for pen, col in PENALTY_COLOR.items():
    rl_run("1.2B", 8, "Im14", [1.75, 1.50, 1.25, 1.00, 0.75, 0.50, 0.25, 0.0], col, pen)
rl_run("3B", 26, "Im27", [2.0, 1.5, 1.0, 0.5, 0.0], BLUE)


def kl_steps(page, name, xticks, color, tag, mask=LEGEND, shared=()):
    """KL against PPO step for one run. Where the run's own line is hidden
    under the others in the first 0.4M steps, where every run of the figure
    still coincides, the median of the `shared` colors in that column stands in."""
    a = image(page, name)
    ax = Axes(a, xticks, [100, 80, 60, 40, 20, 0])
    by = {}
    for x, y in trace(a, color, thick=1, mask=mask):
        by.setdefault(x, []).append(y)
    early = {}
    for c in shared:
        for x, y in trace(a, c, thick=1, mask=mask):
            if ax.x(x) <= 0.4:
                early.setdefault(x, []).append(y)
    for x, ys in early.items():
        by.setdefault(x, ys)
    line = [(x, float(np.median(ys))) for x, ys in sorted(by.items())]
    out, end = resample(line, ax, STEP_GRID)
    overlay(a, ax, [out], f"steps-{tag}")
    return [[s, max(0.0, k)] for s, k in out]


STEPS14 = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
for pen, col in PENALTY_COLOR.items():
    rl["1.2B"][pen]["steps"] = kl_steps(22, "Im19", STEPS14, col, f"1.2B-{pen}", shared=PENALTY_COLOR.values())
rl["12M"]["0"]["steps"] = kl_steps(22, "Im20", [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0], BLUE, "12M")
rl["3B"]["0"]["steps"] = kl_steps(23, "Im21", STEPS14, SIZE_COLOR["3B"], "3B", LEGEND9)

# ---- best-of-n: proxy from Figure 20, gold from Figure 1a
BON_GRID = [round(v * v, 4) for v in np.arange(0, 3.1623, 0.125)] + [10.0]
bon = {}
a20 = image(25, "Im25")
ax20 = Axes(a20, [2, 4, 6, 8, 10], [1.6, 1.4, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2, 0.0], sq, unsq)
a1 = image(3, "Im1")
ax1 = Axes(a1, [2, 4, 6, 8, 10], [1.4, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2], sq, unsq)
bon_rms = {}


def median_line(pts):
    by = {}
    for x, y in pts:
        by.setdefault(x, []).append(y)
    return [(x, float(np.median(ys))) for x, ys in sorted(by.items())]


for size in ["12M", "1.2B", "3B"]:
    pr, end = resample(median_line(trace(a20, SIZE_COLOR[size], tol=10, thick=2, mask=LEGEND9)), ax20, BON_GRID)
    gr, _ = resample(median_line(trace(a1, SIZE_COLOR[size], tol=8, thick=4, mask=FIG1_LEGENDS)), ax1, BON_GRID)
    overlay(a20, ax20, [pr], f"bon-proxy-{size}")
    overlay(a1, ax1, [gr], f"bon-gold-{size}")
    c = coef[size]
    bon_rms[size] = round(float(np.sqrt(np.mean([(g - np.sqrt(k) * (c["alphaBon"] - c["betaBon"] * np.sqrt(k))) ** 2 for k, g in gr]))), 3)
    bon[size] = {"proxy": pr, "gold": gr}


def pairs(rows, dx, dy):
    out = []
    for x, y in rows:
        xs = f"{x:.{dx}f}".rstrip("0").rstrip(".") or "0"
        ys = f"{y:.{dy}f}".rstrip("0").rstrip(".") or "0"
        out.append(f"[{xs}, {ys.replace('-0', '0') if ys == '-0' else ys}]")
    return "[" + ", ".join(out) + "]"


rms_rl = ", ".join(f"{k} {v}" for k, v in fit_rms.items())
lines = [
    "// Generated by tools/figure-data/reward-overoptimization-gao2022.py from the",
    "// figures of Gao, Schulman and Hilton, Scaling Laws for Reward Model",
    "// Overoptimization, arXiv:2210.10760v1 (2022). Do not edit by hand.",
    "//",
    "// Gold RM score as the paper fits it (Section 1), with d = sqrt(KL) in nats:",
    "//   best-of-n  R(d) = d (alphaBon - betaBon d)",
    "//   RL (PPO)   R(d) = d (alphaRl - betaRl ln d)",
    "// alphaBon, betaBon, betaRl: the dots of Figure 3, one per RM size.",
    "// alphaRl: one constant across sizes (Section 3.2) whose value is not printed;",
    "// least squares against the gold curves of Figure 1b with betaRl fixed.",
    f"// RMS gap between these fits and the measured gold curves: RL {rms_rl};",
    f"// best-of-n {', '.join(f'{k} {v}' for k, v in bon_rms.items())}.",
    "//",
    "// Proxy and gold scores and KL per PPO step are measured traces: best-of-n",
    "// proxy from Figure 20 and gold from Figure 1a; RL from Figures 7b (12M RM),",
    "// 9 (1.2B RM, KL penalty 0, 0.01, 0.05, 0.1, 0.5) and 22 (3B RM); KL per",
    "// step from Figures 15, 14 and 16. The policy is 1.2B parameters in every",
    "// run. Scores are in gold-RM units: the initial policy scores 0 and the gold",
    "// RM has unit variance (Section 2.2). Stretches of a line hidden under",
    "// other lines are bridged by straight segments on the paper's axis.",
    "",
    'export const SOURCE = "Gao, Schulman and Hilton (2022), arXiv:2210.10760v1, Figures 1, 3, 7b, 9, 14 to 16, 20 and 22";',
    "",
    "export interface Coef { alphaBon: number; betaBon: number; betaRl: number }",
    "export const COEF: Record<string, Coef> = {",
]
for s_ in SIZES:
    c = coef[s_]
    lines.append(f'  "{s_}": {{ alphaBon: {c["alphaBon"]}, betaBon: {c["betaBon"]}, betaRl: {c["betaRl"]} }},')
lines += ["};", "", f"export const ALPHA_RL = {alpha_rl};", "",
          "// [KL nats, score] pairs.",
          "export type Trace = Array<[number, number]>;",
          "",
          "// Best-of-n with n from 1 to about 60,000 (KL = ln n - (n - 1) / n).",
          "export const BON: Record<string, { proxy: Trace; gold: Trace }> = {"]
for s_, v in bon.items():
    lines.append(f'  "{s_}": {{')
    lines.append(f"    proxy: {pairs(v['proxy'], 3, 3)},")
    lines.append(f"    gold: {pairs(v['gold'], 3, 3)},")
    lines.append("  },")
lines += ["};", "",
          "// One PPO run: proxy and gold against KL, and [million steps, KL nats].",
          "export interface RlRun { proxy: Trace; gold: Trace; steps: Trace }",
          "// Keyed by RM size, then KL penalty coefficient.",
          "export const RL: Record<string, Record<string, RlRun>> = {"]
for s_, runs_ in rl.items():
    lines.append(f'  "{s_}": {{')
    for pen, r in runs_.items():
        lines.append(f'    "{pen}": {{')
        lines.append(f"      proxy: {pairs(r['proxy'], 2, 3)},")
        lines.append(f"      gold: {pairs(r['gold'], 2, 3)},")
        lines.append(f"      steps: {pairs(r['steps'], 2, 1)},")
        lines.append("    },")
    lines.append("  },")
lines += ["};", ""]
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines))

print(json.dumps({"coef": coef, "alpha_rl": alpha_rl, "rl_fit_rms": fit_rms, "bon_fit_rms": bon_rms,
                  "rl_ends": {s_: {p_: [r["end"], r["steps"][-1]] for p_, r in v.items()} for s_, v in rl.items()}}, indent=1))
print("wrote", OUT)
