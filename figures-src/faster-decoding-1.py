import os
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the speculative-decoding payoff. With acceptance rate alpha and a
# draft of gamma tokens checked in one target pass, the expected number of tokens
# emitted per target pass is the geometric sum
#   E = (1 - alpha**(gamma+1)) / (1 - alpha),
# rising from 1 (nothing accepted, only the bonus token) toward gamma+1 (all
# accepted plus the bonus). Longer drafts help only when alpha is high; at low
# alpha the curves collapse together because early rejections waste the tail.
# Idealized synthetic numbers, not measured data. After Leviathan et al. (2023).

INK = "#6b7280"
DATA = "#3b82f6"

def expected_tokens(alpha, gamma):
    # Geometric sum, guarded at alpha == 1 where the limit is gamma + 1.
    safe = np.where(np.isclose(alpha, 1.0), 0.0, alpha)
    out = np.where(
        np.isclose(alpha, 1.0),
        gamma + 1.0,
        (1.0 - safe ** (gamma + 1)) / (1.0 - safe),
    )
    return out

alpha = np.linspace(0.0, 1.0, 400)

fig, ax = plt.subplots(figsize=(5, 3))

gammas = [2, 4, 8]
shades = [0.55, 0.75, 1.0]
for g, sh in zip(gammas, shades):
    ax.plot(alpha, expected_tokens(alpha, g), color=DATA, lw=1.8, alpha=sh,
            label=f"draft length gamma = {g}")

# Reference line: one token per pass, the no-speculation baseline.
ax.axhline(1.0, color=INK, lw=1.0, ls="--")
ax.text(0.02, 1.15, "baseline: one token per pass", color=INK, fontsize=8.5,
        va="bottom")

ax.set_xlim(0, 1)
ax.set_ylim(0, max(gammas) + 1.6)
ax.set_xlabel("acceptance rate alpha", color=INK)
ax.set_ylabel("expected tokens per target pass", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="upper left")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "faster-decoding-1")
