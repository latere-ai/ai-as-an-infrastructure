import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic illustration of KV-cache memory growth versus context length.
# The KV cache size is 2 * layers * heads * d_head * seq * batch * dtype,
# so for a fixed model it grows linearly in sequence length with a slope set
# entirely by the number of distinct KV heads each attention variant keeps.
# MHA keeps one KV head per query head, GQA keeps one per group, MQA keeps a
# single KV head, and MLA caches a low-rank latent instead of per-head K and V.
# All numbers here are idealized relative units, not measured benchmarks. The
# point of the figure is the crossover with the flat model-weights line: past
# some context length the cache overtakes the weights themselves.

GRAY = "#6b7280"
BLUE = "#3b82f6"

seq = np.linspace(0, 128, 256)  # context length, thousands of tokens

# Relative per-token slopes, proportional to the number of cached KV heads.
# Idealized: MHA = 8 query heads, GQA = 2 KV groups, MQA = 1 KV head, and MLA
# a compressed latent slightly below MQA. Units are arbitrary (weights = 1).
slopes = {
    "MHA": 1.0 / 32.0,
    "GQA": (1.0 / 32.0) * (2.0 / 8.0),
    "MQA": (1.0 / 32.0) * (1.0 / 8.0),
    "MLA": (1.0 / 32.0) * (0.75 / 8.0),
}
weights = 1.0  # model weights, the flat reference, in the same relative units

fig, ax = plt.subplots(figsize=(5, 3))

# Small vertical nudges keep the closely spaced MQA and MLA end labels apart.
label_dy = {"MHA": 0.0, "GQA": 0.0, "MQA": 4.0, "MLA": -4.0}

for name in ["MHA", "GQA", "MQA", "MLA"]:
    cache = slopes[name] * seq
    ax.plot(seq, cache, color=BLUE, linewidth=1.8)
    # label at the right end of each line
    ax.annotate(
        name,
        xy=(seq[-1], cache[-1]),
        xytext=(4, label_dy[name]),
        textcoords="offset points",
        color=GRAY,
        fontsize=9,
        va="center",
    )

# Flat model-weights reference line.
ax.axhline(weights, color=GRAY, linewidth=1.2, linestyle="--")
ax.annotate(
    "model weights",
    xy=(4, weights),
    xytext=(0, 4),
    textcoords="offset points",
    color=GRAY,
    fontsize=9,
    va="bottom",
)

# Mark the crossover where the MHA cache overtakes the weights.
x_cross = weights / slopes["MHA"]
if x_cross <= seq[-1]:
    ax.plot([x_cross], [weights], marker="o", color=BLUE, markersize=4)
    ax.annotate(
        "cache overtakes weights",
        xy=(x_cross, weights),
        xytext=(34, -40),
        textcoords="offset points",
        color=GRAY,
        fontsize=8,
        va="top",
        ha="left",
        arrowprops=dict(arrowstyle="-", color=GRAY, linewidth=0.7),
    )

ax.set_xlabel("context length (thousands of tokens)")
ax.set_ylabel("memory (relative units)")
ax.set_xlim(0, seq[-1] * 1.12)
ax.set_ylim(0, max(weights, slopes["MHA"] * seq[-1]) * 1.1)

# Mid-gray axes, ticks, labels; drop the top and right spines.
for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
for spine in ["left", "bottom"]:
    ax.spines[spine].set_color(GRAY)
ax.tick_params(colors=GRAY)
ax.xaxis.label.set_color(GRAY)
ax.yaxis.label.set_color(GRAY)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "transformer-architecture-1")
