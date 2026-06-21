import os
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the contested concern at the heart of the evaluation gate: as
# weight bitwidth falls, an aggregate metric like perplexity can stay close to
# the full-precision baseline while specific, harder capabilities (long-context
# recall, multi-step reasoning, rare factual knowledge) degrade faster than the
# aggregate suggests. The two curves are idealized to show the divergence the
# chapter flags as unsettled, not measured benchmark scores. Illustrative only.

INK = "#6b7280"
DATA = "#3b82f6"

# Weight bitwidth, from full precision down to aggressive low-bit.
bits = np.array([16, 8, 6, 4, 3, 2], dtype=float)

# Quality retained, as a fraction of the full-precision baseline (1.0 = no loss).
# Aggregate metric (perplexity proxy): stays flat, dips only at the very bottom.
aggregate = np.array([1.00, 1.00, 0.995, 0.985, 0.95, 0.82])

# Specific capability: holds at high bitwidth, then falls away earlier and harder.
capability = np.array([1.00, 0.99, 0.97, 0.91, 0.74, 0.45])

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(bits, aggregate, color=INK, lw=1.8, marker="o", ms=4,
        label="aggregate metric (e.g. perplexity)")
ax.plot(bits, capability, color=DATA, lw=1.8, marker="o", ms=4,
        label="specific capability")

# Shade the widening gap between the two curves.
ax.fill_between(bits, capability, aggregate, color=DATA, alpha=0.08)
ax.annotate("widening gap: the\nunmeasured cost",
            xy=(3, (0.74 + 0.95) / 2), xytext=(6.6, 0.6),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.invert_xaxis()  # full precision on the left, aggressive low-bit on the right
ax.set_xticks(bits)
ax.set_xticklabels([f"{int(b)}" for b in bits])
ax.set_xlabel("weight bitwidth (bits)", color=INK)
ax.set_ylabel("quality retained vs FP baseline", color=INK)
ax.set_ylim(0.35, 1.03)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="lower left")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "quantization-kernels-2")
