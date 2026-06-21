import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the throughput-versus-latency trade-off in decode. A larger
# decode batch amortizes the one expensive weight-streaming pass across more
# requests, so aggregate throughput rises with diminishing returns toward a
# memory-bandwidth ceiling. But each step also takes longer as the batch
# fills, so per-token latency (TPOT) climbs. The right batch is the largest
# one still under the TPOT SLO. Idealized synthetic numbers, not measured
# data. After Pope et al. (2022), Efficiently Scaling Transformer Inference.

INK = "#6b7280"
DATA = "#3b82f6"
TPOT_C = "#9ca3af"   # grayscale second series so it reads light and dark

batch = np.linspace(1, 64, 400)

# Throughput: rises, saturating toward a ceiling as decode becomes
# compute-efficient (weights read once, amortized across the batch).
ceiling = 1.0
throughput = ceiling * batch / (batch + 10.0)

# TPOT: a near-flat floor while bandwidth-bound, then climbing as the batch
# grows long and each step does more work. Normalized to its value at batch 1.
tpot = 1.0 + 0.9 * (batch / 64.0) ** 2

# A TPOT budget (SLO), and the largest batch that still meets it.
slo = 1.45
ok = batch[tpot <= slo]
b_star = ok.max()

fig, ax = plt.subplots(figsize=(5, 3))

# Throughput on the left axis.
ax.plot(batch, throughput, color=DATA, lw=1.8)
ax.set_xlabel("decode batch size (concurrent requests)", color=INK)
ax.set_ylabel("throughput (normalized)", color=DATA)
ax.set_ylim(0, 1.05)
ax.tick_params(axis="y", colors=DATA)
for lbl in ax.get_yticklabels():
    lbl.set_color(DATA)

# TPOT on the right axis.
ax2 = ax.twinx()
ax2.plot(batch, tpot, color=TPOT_C, lw=1.8, ls="--")
ax2.axhline(slo, color=INK, lw=1.0, ls=":")
ax2.set_ylabel("per-token latency / TPOT (normalized)", color=INK)
ax2.set_ylim(0.9, 2.0)
ax2.tick_params(axis="y", colors=INK)
for lbl in ax2.get_yticklabels():
    lbl.set_color(INK)

# Mark the SLO and the best feasible batch.
ax2.text(2, slo + 0.03, "TPOT SLO", color=INK, fontsize=8.5, va="bottom")
ax.axvline(b_star, color=INK, lw=1.0, alpha=0.5)
ax.annotate("largest batch within SLO",
            xy=(b_star, throughput[np.argmin(np.abs(batch - b_star))]),
            xytext=(b_star - 30, 0.40),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(1, 64)
for spine in ("top",):
    ax.spines[spine].set_visible(False)
    ax2.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax2.spines["right"].set_color(INK)
ax2.spines["left"].set_color(INK)
ax.spines["bottom"].set_color(INK)
ax.tick_params(axis="x", colors=INK)
for lbl in ax.get_xticklabels():
    lbl.set_color(INK)

# Light legend distinguishing the two curves.
from matplotlib.lines import Line2D
handles = [
    Line2D([0], [0], color=DATA, lw=1.8, label="throughput"),
    Line2D([0], [0], color=TPOT_C, lw=1.8, ls="--", label="TPOT"),
]
leg = ax.legend(handles=handles, frameon=False, fontsize=8, loc="lower right")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "serving-problem-2")
