# Regenerate the ACCURACY and BASELINES blocks of
# app/src/figures/lost-in-the-middle.ts: multi-document question answering
# accuracy by the position of the answer-bearing document, from the LaTeX
# source of Liu et al., "Lost in the Middle: How Language Models Use Long
# Contexts" (TACL 12, 2024; arXiv 2307.03172v3).
#
# Positions come from the appendix tables tables/qa/{10,20,30}_total_documents.tex
# (the paper evaluates the answer document at index 0, 4, 9, ...; the figure
# shows them as positions 1, 5, 10, ...). Closed-book and oracle accuracy come
# from the table labeled tab:closedbook_and_oracle in the main text. Prints a
# TypeScript object literal to paste.
#
#   python tools/figure-data/lost-in-the-middle-tables.py   (standard library only)

import io
import re
import tarfile
import urllib.request

EPRINT = "https://arxiv.org/e-print/2307.03172v3"
MACROS = {
    r"\claude": "claude",
    r"\claudeextended": "claude100k",
    r"\gptturbo": "gpt35",
    r"\gptturboextended": "gpt35_16k",
    r"\mptinstruct": "mpt",
    r"\longchat": "longchat",
}

with urllib.request.urlopen(EPRINT) as r:
    tar = tarfile.open(fileobj=io.BytesIO(r.read()), mode="r:gz")
files = {m.name.lstrip("./"): tar.extractfile(m).read().decode() for m in tar.getmembers() if m.isfile() and m.name.endswith(".tex")}


def rows(tex):
    out = {}
    for line in tex.splitlines():
        m = re.match(r"\s*(\\[a-z]+)\s*&(.*)\\\\", line)
        if m and m.group(1) in MACROS:
            out[MACROS[m.group(1)]] = [float(v.strip().rstrip("\\%")) for v in m.group(2).split("&")]
    return out


print("const ACCURACY: Record<Docs, Partial<Record<ModelKey, number[]>>> = {")
for n in (10, 20, 30):
    tex = files[f"tables/qa/{n}_total_documents.tex"]
    header = re.search(r"Model & (.*?)\\\\", tex).group(1)
    positions = [int(i) + 1 for i in re.findall(r"Index (\d+)", header)]
    print(f"  {n}: {{ // positions {', '.join(map(str, positions))}")
    for key, vals in rows(tex).items():
        print(f"    {key}: [{', '.join(f'{v:g}' for v in vals)}],")
    print("  },")
print("};")

main = files["tacl2021v1-template.tex"]
table = re.search(r"Closed-Book & Oracle(.*?)\\end\{tabular\}", main, re.S).group(1)
print("const BASELINES: Record<ModelKey, { closed: number; oracle: number }> = {")
for key, (closed, oracle) in rows(table).items():
    print(f"  {key}: {{ closed: {closed:g}, oracle: {oracle:g} }},")
print("};")
