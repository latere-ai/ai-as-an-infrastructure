import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the coverage-is-not-accuracy gap in parallel test-time scaling.
# Coverage (any of k samples correct) rises smoothly with k as an
# exponentiated power law toward a ceiling. A verifier converts that coverage
# into accuracy almost one-for-one, while a heuristic selector (majority vote
# or a reward model) tracks coverage early and then plateaus, because past a
# few hundred samples it can no longer tell the rare right answer from the many
# confident wrong ones. Idealized synthetic data, not measured numbers.

INK = "#6b7280"
DATA = "#3b82f6"

k = np.logspace(0, 4, 200)  # number of samples, 1 to 10000 (log scale)

# Coverage as an exponentiated power law approaching a ceiling below 1.
ceiling = 0.92
coverage = ceiling * (1.0 - np.exp(-0.9 * k ** 0.32))

# A near-perfect verifier realizes almost all of the coverage.
verifier_acc = 0.97 * coverage

# A heuristic selector tracks coverage early, then saturates and plateaus
# well below the coverage ceiling.
plateau = 0.55
heuristic_acc = plateau * (1.0 - np.exp(-1.1 * k ** 0.34))
heuristic_acc = np.minimum(heuristic_acc, coverage)

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(k, coverage, color=INK, lw=1.6, ls="--",
        label="coverage (any sample correct)")
ax.plot(k, verifier_acc, color=DATA, lw=1.9,
        label="accuracy with a verifier")
ax.plot(k, heuristic_acc, color=DATA, lw=1.9, alpha=0.45,
        label="accuracy with majority / reward model")

# Mark the gap that opens up at large k between coverage and the heuristic.
kx = 6e3
cov_y = ceiling * (1.0 - np.exp(-0.9 * kx ** 0.32))
heu_y = plateau * (1.0 - np.exp(-1.1 * kx ** 0.34))
ax.annotate("", xy=(kx, cov_y), xytext=(kx, heu_y),
            arrowprops=dict(arrowstyle="<->", color=INK, lw=1.0))
ax.text(kx * 0.62, (cov_y + heu_y) / 2, "selector gap",
        color=INK, fontsize=8.5, ha="right", va="center")

ax.set_xscale("log")
ax.set_xlabel("samples per prompt, k (log scale)", color=INK)
ax.set_ylabel("fraction of prompts solved", color=INK)
ax.set_ylim(0, 1)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=7.5, loc="upper left")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
fig.savefig(
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/15-inference-time-scaling-1.svg",
    format="svg", bbox_inches="tight", transparent=True,
)
