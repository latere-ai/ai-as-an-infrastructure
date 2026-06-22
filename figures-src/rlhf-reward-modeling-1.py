import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic reward-versus-KL over-optimization frontier. As the policy drifts
# from the SFT reference (x-axis, KL), the proxy reward the policy is trained
# on rises monotonically, but true human-judged quality rises only to a knee
# and then falls as the policy exploits the reward model's blind spots. The
# gap that opens past the knee is the thing a box-flowchart cannot show.
# Idealized synthetic data, not measured numbers, after Gao et al. (2022).

INK = "#6b7280"
DATA = "#3b82f6"

kl = np.linspace(0.0, 10.0, 400)  # KL drift from the SFT reference (nats)

# Proxy reward: keeps climbing, concave (diminishing but never turning down).
proxy = 1.0 - np.exp(-kl / 2.6)

# True quality: rises, peaks at a knee, then declines as the proxy is gamed.
# A rise term minus a penalty that grows once the policy leaves the trusted
# region the reward model understands.
penalty_onset = 3.4
true = (1.0 - np.exp(-kl / 2.6)) - 0.022 * np.clip(kl - penalty_onset, 0, None) ** 2

# The knee is where true quality actually peaks, derived from the curve so the
# marker, the vline, and the shaded region all coincide with the visible apex.
peak_idx = int(np.argmax(true))
knee = float(kl[peak_idx])
true_peak = float(true[peak_idx])

fig, ax = plt.subplots(figsize=(5, 3))

# Over-optimized region: everything to the right of the knee.
ax.axvspan(knee, kl.max(), color=INK, alpha=0.06, zorder=0)

# Both quantities share the one data color; linestyle distinguishes them.
ax.plot(kl, proxy, color=DATA, lw=1.8, zorder=3, label="proxy reward")
ax.plot(kl, true, color=DATA, lw=1.8, ls=(0, (5, 2)), zorder=3,
        label="true quality")

# Mark the knee where true quality peaks.
ax.axvline(knee, color=INK, lw=0.9, ls=":", zorder=2)
ax.scatter([knee], [true_peak], s=30, color=DATA, zorder=4)
ax.annotate("knee", xy=(knee, true_peak),
            xytext=(knee - 1.9, true_peak + 0.16),
            color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))
ax.text(knee + 0.7, 1.0, "over-optimized", color=INK, fontsize=9, ha="center")

ax.set_xlabel("KL drift from SFT reference", color=INK)
ax.set_ylabel("score (arbitrary units)", color=INK)
ax.set_ylim(0, 1.08)
ax.set_xlim(0, kl.max())

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

save_bilingual(fig, "rlhf-reward-modeling-1")
