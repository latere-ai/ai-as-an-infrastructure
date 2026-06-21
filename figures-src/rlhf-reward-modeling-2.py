import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic Bradley-Terry preference curve. The probability that the human
# preferred response y_w beats the dispreferred y_l is a sigmoid of the
# difference of reward-model scores: P = sigma(r(y_w) - r(y_l)). Only the
# difference enters, so adding the same constant to both scores leaves the
# probability unchanged: the reward is identified only up to an additive
# constant. The two shifted score pairs below land on the same point.
# Idealized illustration, after the Bradley-Terry model (Bradley and Terry, 1952).

INK = "#6b7280"
DATA = "#3b82f6"

d = np.linspace(-6, 6, 400)  # score difference r(y_w) - r(y_l)
p = 1.0 / (1.0 + np.exp(-d))

fig, ax = plt.subplots(figsize=(5, 3))

# Indifference line at P = 0.5 where the two responses score equally.
ax.axhline(0.5, color=INK, lw=0.8, ls=":", zorder=1)

ax.plot(d, p, color=DATA, lw=1.8, zorder=3)

# Shift invariance: two score pairs with the same difference (= 2) map to the
# same preference probability, so an absolute shift of both scores does nothing.
diff = 2.0
pt = 1.0 / (1.0 + np.exp(-diff))
ax.scatter([diff], [pt], s=46, color=DATA, zorder=4)
ax.annotate(
    "r(y_w)=1.0, r(y_l)=-1.0\nr(y_w)=4.5, r(y_l)=2.5\nsame difference, same P",
    xy=(diff, pt), xytext=(-5.6, 0.62),
    color=INK, fontsize=8,
    arrowprops=dict(arrowstyle="->", color=INK, lw=1.0),
)

ax.set_xlabel("score difference  r(y_w) - r(y_l)", color=INK)
ax.set_ylabel("P(y_w preferred over y_l)", color=INK)
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
from common import save_bilingual

save_bilingual(fig, "rlhf-reward-modeling-2")
