import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the exploration-versus-KL-collapse trade-off from the chapter.
# As the policy moves further from the frozen reference (rising KL divergence,
# the x-axis stands in for more aggressive optimization or a weaker KL anchor),
# the verifier reward keeps climbing while held-out quality rises, peaks, then
# falls as the policy collapses onto a few high-reward modes and overfits the
# checker. The gap that opens past the peak is reward hacking and mode collapse.
# This is idealized synthetic data, not measured numbers.

INK = "#6b7280"
DATA = "#3b82f6"

kl = np.linspace(0, 1, 200)  # KL from reference (arbitrary units), proxy for
                             # optimization pressure

# Training reward: monotonically rising, saturating, since the optimizer always
# finds more of what the verifier scores.
reward = 1.0 - np.exp(-3.2 * kl)

# Held-out quality: rises with useful learning, then turns down as the policy
# collapses and games the checker. A single-peaked curve.
peak = 0.34
held_out = np.exp(-((kl - peak) ** 2) / (2 * 0.18 ** 2))
held_out = 0.20 + 0.80 * held_out  # keep it positive and readable

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(kl, reward, color=DATA, lw=1.8, zorder=3, label="training reward")
ax.plot(kl, held_out, color=INK, lw=1.6, ls="--", zorder=2,
        label="held-out quality")

# Mark the peak of held-out quality: the knee past which over-optimization hurts.
pi = int(np.argmax(held_out))
ax.axvline(kl[pi], color=INK, lw=0.8, alpha=0.5, zorder=1)
ax.scatter([kl[pi]], [held_out[pi]], s=40, facecolors="none",
           edgecolors=INK, linewidths=1.4, zorder=4)
ax.annotate("over-optimization\nbegins", xy=(kl[pi], held_out[pi]),
            xytext=(kl[pi] + 0.10, held_out[pi] + 0.04),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlabel("KL from reference (optimization pressure)", color=INK)
ax.set_ylabel("normalized value", color=INK)
ax.set_ylim(0, 1.08)
ax.set_xlim(0, 1)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="lower right")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "training-to-reason-2")
