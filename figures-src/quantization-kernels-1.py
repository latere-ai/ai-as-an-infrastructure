import os
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the activation outlier that breaks per-tensor INT8. Most channels
# of a trained transformer's activations sit in a narrow, well-behaved band, but
# a few emergent channels carry values orders of magnitude larger. A single
# per-tensor scale must reach up to cover the largest outlier, which spreads the
# INT8 grid so coarsely that the bulk of the distribution collapses onto only a
# few levels. Idealized synthetic data, not measured activations.
# After Xiao et al. (2022), SmoothQuant.

INK = "#6b7280"
DATA = "#3b82f6"

rng = np.random.default_rng(7)

# Per-channel maximum absolute activation across an illustrative layer.
n_channels = 256
channels = np.arange(n_channels)

# Bulk channels: small, tightly clustered magnitudes.
bulk = np.abs(rng.normal(0.0, 1.0, n_channels)) + 0.4

# A handful of emergent outlier channels spike far above the bulk.
outlier_idx = np.array([37, 96, 158, 211])
bulk[outlier_idx] = np.array([62.0, 78.0, 55.0, 70.0])

fig, ax = plt.subplots(figsize=(5, 3))

# Bulk channels as light stems.
mask = np.ones(n_channels, dtype=bool)
mask[outlier_idx] = False
ax.vlines(channels[mask], 0, bulk[mask], color=INK, lw=0.8, alpha=0.5)

# Outlier channels as bold stems in the data color.
ax.vlines(channels[outlier_idx], 0, bulk[outlier_idx], color=DATA, lw=2.2)
ax.scatter(channels[outlier_idx], bulk[outlier_idx], color=DATA, s=16, zorder=3)

# The per-tensor INT8 scale must reach the largest outlier.
top = bulk.max()
ax.axhline(top, color=INK, lw=1.2, ls="--")
ax.text(4, top + 1.5, "per-tensor scale must reach the top outlier",
        color=INK, fontsize=8.5, va="bottom")

# The bulk band that gets crushed onto a few quantization levels.
bulk_top = np.percentile(bulk[mask], 99)
ax.axhspan(0, bulk_top, color=DATA, alpha=0.07)
ax.annotate("bulk crushed onto a few levels",
            xy=(150, bulk_top), xytext=(70, top * 0.45),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(0, n_channels)
ax.set_ylim(0, top * 1.12)
ax.set_xlabel("activation channel", color=INK)
ax.set_ylabel("max absolute value", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "quantization-kernels-1")
