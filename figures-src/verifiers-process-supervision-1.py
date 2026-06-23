import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt

from common import ACCENT, DATA, INK, MUTED, WARN, save_bilingual


fig, ax = plt.subplots(figsize=(5.6, 3.2))

points = [
    ("heuristic judge", 0.88, 0.20, MUTED),
    ("outcome RM", 0.72, 0.36, DATA),
    ("unit tests", 0.56, 0.54, DATA),
    ("answer checker", 0.45, 0.63, ACCENT),
    ("process RM", 0.33, 0.72, WARN),
    ("formal checker", 0.16, 0.90, ACCENT),
]

ax.plot([p[1] for p in points], [p[2] for p in points], color=MUTED, linewidth=1.2, alpha=0.7)
offsets = {
    "heuristic judge": (-0.04, -0.07, "right"),
    "outcome RM": (-0.035, -0.06, "right"),
    "unit tests": (0.02, -0.045, "left"),
    "answer checker": (0.02, 0.03, "left"),
    "process RM": (0.02, 0.035, "left"),
    "formal checker": (0.02, -0.04, "left"),
}
for label, x, y, color in points:
    ax.scatter([x], [y], s=62, color=color, zorder=3)
    dx, dy, ha = offsets[label]
    ax.text(x + dx, y + dy, label, color=INK, fontsize=8, ha=ha, va="center")

ax.text(0.82, 0.06, "broad coverage", color=INK, fontsize=8, ha="center")
ax.text(0.18, 0.06, "narrow scope", color=INK, fontsize=8, ha="center")
ax.text(0.82, 0.30, "spoofable", color=INK, fontsize=8, ha="right")
ax.text(0.20, 0.96, "proof kernel", color=INK, fontsize=8, ha="left")

ax.set_xlabel("coverage", color=INK)
ax.set_ylabel("integrity / hard to spoof", color=INK)
ax.set_xlim(1.0, 0.0)
ax.set_ylim(0.0, 1.0)
ax.set_xticks([])
ax.set_yticks([])
for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK)

fig.tight_layout()
save_bilingual(fig, "verifiers-process-supervision-1")
