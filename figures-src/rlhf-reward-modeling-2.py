import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

from common import ZH_TEXT, save_bilingual

# Bradley-Terry preference curve in the chapter's notation. The probability
# that the preferred response y+ beats y- is a sigmoid of the score
# difference: P = sigma(r(y+) - r(y-)). Only the difference enters, so adding
# the same constant to both scores leaves the probability unchanged: the
# reward is identified only up to an additive constant per prompt. The two
# shifted score pairs in the annotation land on the same point. Idealized
# illustration of the Bradley-Terry model (Bradley and Terry, 1952).

INK = "#6b7280"
DATA = "#3b82f6"

XLABEL = "score difference Δ = r(y⁺) − r(y⁻)"
YLABEL = "P(y⁺ preferred to y⁻) = σ(Δ)"
NOTE = "r(y⁺) = 1.0, r(y⁻) = −1.0\nr(y⁺) = 4.5, r(y⁻) = 2.5\nsame Δ = 2, same P = 0.88"

# Labels of this figure only, kept with the figure rather than in common.py.
ZH_TEXT.update({
    XLABEL: "分数差 Δ = r(y⁺) − r(y⁻)",
    YLABEL: "y⁺ 被偏好的概率 σ(Δ)",
    NOTE: "r(y⁺) = 1.0，r(y⁻) = −1.0\nr(y⁺) = 4.5，r(y⁻) = 2.5\nΔ 都是 2，P 都是 0.88",
})

d = np.linspace(-6, 6, 400)  # score difference
p = 1.0 / (1.0 + np.exp(-d))

fig, ax = plt.subplots(figsize=(5, 3))

# Indifference line at P = 0.5 where the two responses score equally.
ax.axhline(0.5, color=INK, lw=0.8, ls=":", zorder=1)

ax.plot(d, p, color=DATA, lw=1.8, zorder=3)

# Shift invariance: two score pairs with the same difference (2) map to the
# same preference probability, so shifting both scores changes nothing.
diff = 2.0
pt = 1.0 / (1.0 + np.exp(-diff))
ax.scatter([diff], [pt], s=46, color=DATA, zorder=4)
ax.annotate(
    NOTE,
    xy=(diff, pt), xytext=(2.45, 0.66),
    color=INK, fontsize=8, va="center",
    arrowprops=dict(arrowstyle="->", color=INK, lw=1.0, shrinkB=5),
)

ax.set_xlabel(XLABEL, color=INK)
ax.set_ylabel(YLABEL, color=INK)
ax.set_ylim(0, 1)
ax.set_xlim(d.min(), d.max())

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
save_bilingual(fig, "rlhf-reward-modeling-2")
