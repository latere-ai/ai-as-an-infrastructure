from pathlib import Path
from shutil import copyfile
import sys

import matplotlib

if "matplotlib.pyplot" not in sys.modules:
    matplotlib.use("svg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]

INK = "#6b7280"
DATA = "#3b82f6"
ACCENT = "#14b8a6"
WARN = "#f59e0b"
MUTED = "#9ca3af"


def style_axes(ax, *, grid=False):
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(INK)
    ax.tick_params(colors=INK, which="both")
    ax.xaxis.label.set_color(INK)
    ax.yaxis.label.set_color(INK)
    for label in ax.get_xticklabels() + ax.get_yticklabels():
        label.set_color(INK)
    if grid:
        ax.grid(True, color=INK, alpha=0.12, linewidth=0.8)


def style_legend(leg):
    if leg is None:
        return
    leg.set_frame_on(False)
    if leg.get_title():
        leg.get_title().set_color(INK)
    for text in leg.get_texts():
        text.set_color(INK)


def save_bilingual(fig, name):
    en = ROOT / "en" / "figures" / f"{name}.svg"
    zh = ROOT / "zh" / "figures" / f"{name}.svg"
    en.parent.mkdir(parents=True, exist_ok=True)
    zh.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(en, format="svg", bbox_inches="tight", transparent=True)
    copyfile(en, zh)


def finish(fig, ax, name, *, legend=None, grid=False):
    style_axes(ax, grid=grid)
    style_legend(legend)
    fig.tight_layout()
    save_bilingual(fig, name)
    plt.close(fig)


def new_fig(width=5.0, height=3.0):
    return plt.subplots(figsize=(width, height))
