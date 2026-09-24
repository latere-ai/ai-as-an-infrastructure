import os

import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic SAE reconstruction-versus-sparsity trade-off. As the number of
# active latents per token (the L0 sparsity level) rises, the dictionary
# reconstructs the activation more faithfully, so reconstruction error falls.
# A larger dictionary m shifts the whole frontier down: more slots buy lower
# error at the same sparsity. The two ends carry the failure modes the chapter
# names: too few active latents and features split or get absorbed; too many
# and the latents drift back toward polysemanticity.
# This is idealized synthetic data, not measured numbers.
#
# Error is normalized so that 1 is the error of predicting the mean activation
# (no active latent); every curve therefore starts at 1 and stays inside the
# plot. L0 is on a log axis, as sparsity sweeps usually are, which also gives
# the two shaded regimes room for their labels.

INK = "#6b7280"
DATA = "#3b82f6"

L0 = np.geomspace(1, 512, 400)           # active latents per token (sparsity)

def frontier(floor, c, alpha):
    # 1 at L0 = 0, falling toward an irreducible floor.
    return floor + (1 - floor) * (1 + L0 / c) ** (-alpha)

# Three dictionary sizes; larger m sits lower (smaller floor).
curves = [
    ("m = 8d", 0.34, 3.0, 0.7),
    ("m = 32d", 0.20, 3.0, 0.7),
    ("m = 128d", 0.10, 3.0, 0.7),
]
shades = [0.40, 0.70, 1.0]               # lighter to fuller blue as m grows

fig, ax = plt.subplots(figsize=(5, 3))
ax.set_xscale("log", base=2)

for (label, floor, c, alpha), shade in zip(curves, shades):
    ax.plot(L0, frontier(floor, c, alpha), color=DATA, lw=1.8, alpha=shade, zorder=2, label=label)

# Shade and label the two failure regimes at the ends of the sparsity axis,
# each label inside its own band and clear of the curves.
ax.axvspan(L0.min(), 4, color=INK, alpha=0.06, zorder=0)
ax.axvspan(128, L0.max(), color=INK, alpha=0.06, zorder=0)
ax.text(2, 0.42, "too sparse:\nfeatures split,\nabsorb",
        color=INK, fontsize=8, ha="center", va="top")
ax.text(256, 0.98, "too dense:\nback toward\npolysemanticity",
        color=INK, fontsize=8, ha="center", va="top")

# Arrow marking that a bigger dictionary moves the frontier down.
ax.annotate("larger dictionary m", xy=(40, 0.10 + 0.90 * (1 + 40 / 3.0) ** -0.7),
            xytext=(22, 0.78), color=INK, fontsize=8.5, ha="center",
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(L0.min(), L0.max())
ax.set_ylim(0, 1.05)
ax.set_xticks([1, 4, 16, 64, 256])
ax.set_xticklabels(["1", "4", "16", "64", "256"])
ax.set_xlabel("active latents per token (L0 sparsity)", color=INK)
ax.set_ylabel("reconstruction error (normalized)", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="center right", bbox_to_anchor=(1.0, 0.56))
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "mechanistic-interpretability-1")
