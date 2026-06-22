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

INK = "#6b7280"
DATA = "#3b82f6"

# Idealized frontier: error falls roughly as a power law in active latents,
# down to an irreducible floor that shrinks as the dictionary grows.
L0 = np.linspace(4, 256, 400)            # active latents per token (sparsity)

def frontier(floor, scale, alpha):
    return floor + scale * L0 ** (-alpha)

# Three dictionary sizes; larger m sits lower (smaller floor, larger reach).
curves = [
    ("m = 8d", 0.34, 9.0, 0.62),
    ("m = 32d", 0.20, 9.0, 0.62),
    ("m = 128d", 0.11, 9.0, 0.62),
]
shades = [0.40, 0.70, 1.0]               # lighter to fuller blue as m grows

fig, ax = plt.subplots(figsize=(5, 3))

for (label, floor, scale, alpha), shade in zip(curves, shades):
    y = frontier(floor, scale, alpha)
    ax.plot(L0, y, color=DATA, lw=1.8, alpha=shade, zorder=2, label=label)

# Shade and label the two failure regimes at the ends of the sparsity axis.
ax.axvspan(L0.min(), 20, color=INK, alpha=0.06, zorder=0)
ax.axvspan(180, L0.max(), color=INK, alpha=0.06, zorder=0)
ax.text(16, 1.18, "too sparse:\nfeatures split,\nabsorb",
        color=INK, fontsize=8, ha="center", va="top")
ax.text(218, 1.18, "too dense:\nback toward\npolysemanticity",
        color=INK, fontsize=8, ha="center", va="top")

# Arrow marking that a bigger dictionary moves the frontier down.
ax.annotate("larger dictionary m", xy=(120, frontier(0.11, 9.0, 0.62)[200]),
            xytext=(95, 0.95), color=INK, fontsize=8.5, ha="center",
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(L0.min(), L0.max())
ax.set_ylim(0, 1.5)
ax.set_xlabel("active latents per token (L0 sparsity)", color=INK)
ax.set_ylabel("reconstruction error (normalized)", color=INK)

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

save_bilingual(fig, "mechanistic-interpretability-1")
