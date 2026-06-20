import os
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the acceptance-versus-draft-cost trade-off. A longer draft of
# gamma tokens raises the expected accepted run, but each proposal is not free:
# the target pass spends roughly gamma*c the cost of one decode step, where c is
# the draft-to-target cost ratio. The cost-adjusted speedup
#   S = E(alpha, gamma) / (1 + gamma*c),   E = (1 - alpha**(gamma+1)) / (1 - alpha)
# rises then falls, so there is an optimal draft length: past it, the extra
# verification work outweighs the tokens it wins back. Cheaper drafts (small c)
# push the optimum to longer drafts. Idealized synthetic numbers, not measured
# data. After Leviathan et al. (2023) and Chen et al. (2023).

INK = "#6b7280"
DATA = "#3b82f6"

def expected_tokens(alpha, gamma):
    return (1.0 - alpha ** (gamma + 1)) / (1.0 - alpha)

gamma = np.arange(1, 21)
alpha = 0.8  # fixed, well-aligned drafter

fig, ax = plt.subplots(figsize=(5, 3))

costs = [0.02, 0.05, 0.10]
shades = [1.0, 0.7, 0.45]
for c, sh in zip(costs, shades):
    s = expected_tokens(alpha, gamma) / (1.0 + gamma * c)
    ax.plot(gamma, s, color=DATA, lw=1.8, alpha=sh, marker="o", ms=3,
            label=f"draft cost ratio c = {c:g}")
    # Mark the optimum.
    k = int(np.argmax(s))
    ax.scatter([gamma[k]], [s[k]], color=DATA, alpha=sh, s=42, zorder=5,
               edgecolors="none")

ax.set_xlim(0, gamma.max() + 0.5)
ax.set_ylim(bottom=0)
ax.set_xlabel("draft length gamma (tokens proposed per pass)", color=INK)
ax.set_ylabel("cost-adjusted speedup", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="lower left",
                title="acceptance alpha = 0.8")
leg.get_title().set_color(INK)
leg.get_title().set_fontsize(8)
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
ROOT = "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure"
for lang in ("en", "zh"):
    out_dir = os.path.join(ROOT, lang, "figures")
    os.makedirs(out_dir, exist_ok=True)
    fig.savefig(
        os.path.join(out_dir, "18-faster-decoding-2.svg"),
        format="svg", bbox_inches="tight", transparent=True,
    )
