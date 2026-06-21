import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of best-of-n against verifiers of differing quality. With a
# perfect verifier, expected quality rises monotonically toward the coverage
# ceiling: more samples never hurt. With an imperfect verifier, an
# optimization-against-the-selector effect appears (the inference-time twin of
# reward hacking): early gains give way to a peak, then a decline as larger n
# surfaces more confident-but-wrong candidates the selector is fooled by.
# Idealized synthetic data, not measured numbers.

INK = "#6b7280"
DATA = "#3b82f6"

n = np.logspace(0, 3, 200)  # candidates per prompt, 1 to 1000 (log scale)
logn = np.log10(n)

# Perfect verifier: monotone saturating rise toward a ceiling.
perfect = 0.9 * (1.0 - np.exp(-1.0 * n ** 0.45))

# Imperfect verifier: a gain term that saturates minus a penalty term that
# grows with n as more samples game the flawed selector, producing a hump.
gain = 0.62 * (1.0 - np.exp(-1.3 * n ** 0.5))
penalty = 0.020 * logn ** 2.3
imperfect = gain - penalty

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(n, perfect, color=DATA, lw=1.9, label="perfect verifier")
ax.plot(n, imperfect, color=DATA, lw=1.9, alpha=0.45,
        label="imperfect verifier")

# Mark the peak of the imperfect curve, where expected quality turns down.
ipk = int(np.argmax(imperfect))
ax.scatter([n[ipk]], [imperfect[ipk]], s=34, color=INK, zorder=3)
ax.annotate("optimal n, then\nquality turns down",
            xy=(n[ipk], imperfect[ipk]),
            xytext=(n[ipk] * 1.4, imperfect[ipk] - 0.26),
            color=INK, fontsize=8.5, ha="left", va="top",
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xscale("log")
ax.set_xlabel("candidates per prompt, n (log scale)", color=INK)
ax.set_ylabel("expected quality of selected answer", color=INK)
ax.set_ylim(0, 1)

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

save_bilingual(fig, "inference-time-scaling-2")
