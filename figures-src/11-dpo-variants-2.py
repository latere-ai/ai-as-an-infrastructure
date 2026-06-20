import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of why SimPO normalizes the reward by sequence length. DPO's reward
# is a sum of per-token log-ratios, so it scales with how many tokens the
# response has, and a policy can raise its score just by getting wordier. SimPO
# divides by length, using the average per-token log-probability, so the reward
# is flat in length and the wordiness lever is gone. These are idealized curves
# built from a constant mean per-token term, not measured rewards.

INK = "#6b7280"
DATA = "#3b82f6"

length = np.linspace(8, 320, 400)  # response length in tokens

# Idealized constant mean per-token contribution to the implicit reward.
per_token = 0.018

# DPO-style reward grows with length: sum over tokens of the per-token term.
dpo_reward = per_token * length

# SimPO-style reward is the average per-token term, flat in length.
simpo_reward = np.full_like(length, per_token * 120)  # plotted on the same axis

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(length, dpo_reward, color=DATA, lw=1.8, linestyle="-",
        label="DPO log-ratio reward (grows with length)")
ax.plot(length, simpo_reward, color=INK, lw=1.8, linestyle="--",
        label="SimPO length-normalized reward (flat)")

ax.annotate("wordiness raises\nthe DPO score", xy=(285, per_token * 285),
            xytext=(175, per_token * 285 * 0.45), color=INK, fontsize=8,
            ha="left", arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlabel("response length (tokens)", color=INK)
ax.set_ylabel("implicit reward (idealized units)", color=INK)
ax.set_ylim(0, dpo_reward.max() * 1.15)

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
fig.savefig(
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/11-dpo-variants-2.svg",
    format="svg", bbox_inches="tight", transparent=True,
)
