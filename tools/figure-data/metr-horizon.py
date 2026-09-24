# Regenerate app/src/figures/data/metr-horizon.ts: METR's published per-model
# time horizons (50 and 80 percent, with their intervals) and doubling-time
# fits for METR-Horizon-v1.1, from METR's machine-readable results file
# (the corrected file after the 3 March 2026 fix to the fit).
#
# The file gives each model a release date, an is_sota flag (the model was the
# frontier at release), and p50/p80 horizon estimates in minutes of human task
# time. The doubling times in the file are least-squares fits of log2(p50)
# against release date over the is_sota models, excluding any model whose
# central p50 estimate exceeds 16 hours; "from_2023_on" restricts the fit to
# models released in 2023 or later. The script reproduces both published
# values with that rule and stops if it cannot, so the figure's trend lines,
# which apply the same rule, stay tied to the published ones.
#
# GPT-2, GPT-3 (davinci-002), and GPT-3.5 (gpt-3.5-turbo-instruct) were not
# re-run on version 1.1; their rows carry the original suite's estimates
# (METR, "Time Horizon 1.1", January 2026). They are flagged below.
#
#   pip install pyyaml             (run with PyYAML 6.0.3, Python 3.11)
#   python tools/figure-data/metr-horizon.py [path/to/benchmark_results_1_1.yaml [YYYY-MM-DD]]
#
# With a local file, the optional second argument is the date it was retrieved.

import datetime as dt
import hashlib
import json
import math
import sys
import urllib.request
from pathlib import Path

import yaml

URL = "https://metr.org/assets/benchmark_results_1_1.yaml"
OUT = Path(__file__).resolve().parents[2] / "app" / "src" / "figures" / "data" / "metr-horizon.ts"
CEILING_MIN = 16 * 60  # the fits exclude central p50 estimates above 16 hours

# Display names, as the models' developers name them. A key missing here stops
# the script, so a newer results file is reviewed before it reaches the figure.
NAMES = {
    "gpt2": "GPT-2",
    "davinci_002": "GPT-3 (davinci-002)",
    "gpt_3_5_turbo_instruct": "GPT-3.5 Turbo Instruct",
    "gpt_4": "GPT-4",
    "gpt_4_1106_inspect": "GPT-4 1106",
    "claude_3_opus_inspect": "Claude 3 Opus",
    "gpt_4_turbo_inspect": "GPT-4 Turbo",
    "gpt_4o_inspect": "GPT-4o",
    "claude_3_5_sonnet_20240620_inspect": "Claude 3.5 Sonnet (June 2024)",
    "o1_preview": "o1-preview",
    "claude_3_5_sonnet_20241022_inspect": "Claude 3.5 Sonnet (October 2024)",
    "o1_inspect": "o1",
    "claude_3_7_sonnet_inspect": "Claude 3.7 Sonnet",
    "o3_inspect": "o3",
    "claude_4_opus_inspect": "Claude Opus 4",
    "claude_4_1_opus_inspect": "Claude Opus 4.1",
    "gpt_5_2025_08_07_inspect": "GPT-5",
    "gemini_3_pro": "Gemini 3 Pro",
    "gpt_5_1_codex_max_inspect": "GPT-5.1-Codex-Max",
    "claude_opus_4_5_inspect": "Claude Opus 4.5",
    "gpt_5_2": "GPT-5.2",
    "claude_opus_4_6_inspect": "Claude Opus 4.6",
    "gpt_5_3_codex": "GPT-5.3-Codex",
    "gemini_3_1_pro": "Gemini 3.1 Pro",
    "gpt_5_4": "GPT-5.4",
    "claude_mythos_preview_early_inspect": "Claude Mythos Preview (early)",
}
ORIGINAL_SUITE = {"gpt2", "davinci_002", "gpt_3_5_turbo_instruct"}


def doubling_days(rows, since=None):
    """Least-squares doubling time of p50 over release date, METR's rule."""
    pts = [(r["date"].toordinal(), math.log2(r["p50"][0])) for r in rows
           if r["frontier"] and r["p50"][0] <= CEILING_MIN and (since is None or r["date"] >= since)]
    n = len(pts)
    mx = sum(x for x, _ in pts) / n
    my = sum(y for _, y in pts) / n
    slope = sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)
    return 1 / slope


def triple(m):
    return [m["estimate"], m["ci_low"], m["ci_high"]]


def main():
    if len(sys.argv) > 1:
        raw = Path(sys.argv[1]).read_bytes()
        retrieved = sys.argv[2] if len(sys.argv) > 2 else dt.date.today().isoformat()
    else:
        raw = urllib.request.urlopen(URL).read()
        retrieved = dt.date.today().isoformat()
    data = yaml.safe_load(raw)

    rows = []
    for key, entry in data["results"].items():
        if key not in NAMES:
            sys.exit(f"no display name for {key}; add it to NAMES")
        m = entry["metrics"]
        rows.append({
            "id": key,
            "date": entry["release_date"],
            "frontier": bool(m["is_sota"]),
            "p50": triple(m["p50_horizon_length"]),
            "p80": triple(m["p80_horizon_length"]),
        })
    rows.sort(key=lambda r: (r["date"], NAMES[r["id"]]))

    published = data["doubling_time_in_days"]
    checks = [
        (published["all_time_stitched"]["point_estimate"], doubling_days(rows)),
        (published["from_2023_on"]["point_estimate"], doubling_days(rows, dt.date(2023, 1, 1))),
    ]
    for want, got in checks:
        if abs(want - got) > 0.01:
            sys.exit(f"fit rule does not reproduce the published doubling time: {got:.3f} vs {want}")

    f23 = published["from_2023_on"]
    lines = [
        "// METR-Horizon-v1.1 per-model time horizons and doubling-time fits, in",
        "// minutes of human task time. Generated by tools/figure-data/metr-horizon.py;",
        "// do not edit by hand.",
        "//",
        f"// Source: {URL}",
        f"// Retrieved {retrieved}; sha256 {hashlib.sha256(raw).hexdigest()};",
        f"// long_tasks_version {data['long_tasks_version']}.",
        "",
        "export const SOURCE = {",
        f"  benchmark: {json.dumps(data['benchmark_name'])},",
        f"  url: {json.dumps(URL)},",
        f"  retrieved: {json.dumps(retrieved)},",
        "} as const;",
        "",
        "// The file's own fits, in days: all history (the stitched series) and models",
        "// released from 2023 on. Both exclude central 50% estimates above 16 hours.",
        "export const DOUBLING_DAYS = {",
        f"  all: {published['all_time_stitched']['point_estimate']},",
        f"  from2023: {f23['point_estimate']},",
        f"  from2023Interval: [{f23['ci_low']}, {f23['ci_high']}],",
        "} as const;",
        "",
        f"export const CEILING_MIN = {CEILING_MIN};",
        "",
        "export interface HorizonModel {",
        "  id: string;",
        "  name: string;",
        "  released: string; // release date, YYYY-MM-DD",
        "  frontier: boolean; // METR's is_sota flag: the frontier model at release",
        "  originalSuite: boolean; // estimate from the original suite, not re-run on v1.1",
        "  p50: readonly [number, number, number]; // estimate, interval low, interval high",
        "  p80: readonly [number, number, number];",
        "}",
        "",
        "export const MODELS: readonly HorizonModel[] = [",
    ]
    for r in rows:
        lines.append(
            f"  {{ id: {json.dumps(r['id'])}, name: {json.dumps(NAMES[r['id']])}, released: \"{r['date'].isoformat()}\", "
            f"frontier: {str(r['frontier']).lower()}, originalSuite: {str(r['id'] in ORIGINAL_SUITE).lower()}, "
            f"p50: [{', '.join(repr(v) for v in r['p50'])}], p80: [{', '.join(repr(v) for v in r['p80'])}] }},")
    lines.append("];")
    text = "\n".join(lines) + "\n"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    print(f"wrote {OUT} ({len(rows)} models)", file=sys.stderr)


if __name__ == "__main__":
    main()
