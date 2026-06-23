import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const figuresSrc = join(repoRoot, "figures-src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const sourceScripts = readdirSync(figuresSrc)
  .filter((file) => file.endsWith(".py"))
  .filter((file) => !["common.py", "figure_catalog.py"].includes(file));

test("figure source scripts use stable number-free names and output paths", () => {
  for (const script of sourceScripts) {
    expect(script).not.toMatch(/^\d+-/);
    const text = readFileSync(join(figuresSrc, script), "utf8");
    expect(text).not.toMatch(/\/figures\/\d+-/);
    expect(text).not.toContain("/Users/");
  }
});

test("scatter labels sit top-right by default and only flip left on overflow", () => {
  // Every label should read the same way relative to its dot (top-right), so a
  // short label near the right edge like 'policy' must NOT be pushed to the
  // left; it stays left-anchored (text-anchor: start) like the others.
  const catalog = readFileSync(join(figuresSrc, "figure_catalog.py"), "utf8");
  expect(catalog).toContain("FigureCanvasAgg");
  expect(catalog).toMatch(/right_data > xmax/);
  const fieldMap = readFileSync(join(repoRoot, "zh", "figures", "field-map-1.svg"), "utf8");
  expect(fieldMap).toMatch(/text-anchor: start;[^>]*>政策/);
  // A label that would overflow the right edge (closed frontier, x=0.86) flips
  // to the left and is right-anchored so it stays inside the plot box.
  const landscape = readFileSync(join(repoRoot, "zh", "figures", "model-landscape-1.svg"), "utf8");
  expect(landscape).toMatch(/text-anchor: end;[^>]*>闭源前沿/);
});

test("figure 2.2 (field-map-stack) is an inline SVG with all 11 substantive parts", () => {
  for (const lang of ["en", "zh"]) {
    const qmd = readFileSync(join(repoRoot, lang, "orientation", "02-field-map.qmd"), "utf8");
    // A fixed inline SVG keeps labels selectable while avoiding Graphviz's
    // overlapping edge labels in this dense cross-layer map.
    expect(qmd).toMatch(/```\{=html\}\n<figure id="fig-field-map-stack">/);
    expect(qmd).toContain('<svg class="field-map-stack-svg"');
    const figure = qmd.match(/<figure id="fig-field-map-stack">[\s\S]*?<\/figure>/)?.[0] ?? "";
    // Blank lines terminate Markdown HTML blocks, which made markdown-it wrap
    // later SVG children in <p> tags and broke the inline figure.
    expect(figure).not.toMatch(/\n\s*\n/);
    expect(qmd).not.toContain("/figures/field-map-stack.svg");
    expect(qmd).not.toMatch(/```\{dot\}\n\/\/\| label: fig-field-map-stack/);
    // Part XI must be present (it was missing from the old mermaid diagram),
    // and every substantive part should have an addressable SVG group.
    for (const id of ["PIX", "PI", "PII", "PIII", "PIV", "PV", "PVI", "PVII", "PVIII", "PX", "PXI"]) {
      expect(qmd).toContain(`id="fm-${id}"`);
    }
    expect(qmd).toContain("fm-dashed");
    expect(qmd).not.toMatch(/style=dashed,\s*label=/);
  }
  // The matplotlib renderer/spec for this figure was fully removed.
  const catalog = readFileSync(join(figuresSrc, "figure_catalog.py"), "utf8");
  expect(catalog).not.toContain("field-map-stack");
  expect(catalog).not.toContain("_layered");
  // Heading reflects the real part count (was "ten parts").
  expect(readFileSync(join(repoRoot, "en", "orientation", "02-field-map.qmd"), "utf8")).toContain("eleven parts");
  expect(readFileSync(join(repoRoot, "zh", "orientation", "02-field-map.qmd"), "utf8")).toContain("十一个部分");
});

test("figure 1.3 nested-loop return arcs do not carry overlap-prone labels", () => {
  for (const lang of ["en", "zh"]) {
    const qmd = readFileSync(join(repoRoot, lang, "orientation", "01-whole-stack.qmd"), "utf8");
    const block = qmd.match(/```\{dot\}\n\/\/\| label: fig-whole-stack-loops[\s\S]*?\n```/)?.[0] ?? "";
    expect(block).toContain("tok -> prompt;");
    expect(block).toContain("tool -> prompt;");
    expect(block).not.toMatch(/tok -> prompt\s*\[label=/);
    expect(block).not.toMatch(/tool -> prompt\s*\[label=/);
  }
});

test("English static SVG labels stay as selectable text nodes", () => {
  const common = readFileSync(join(figuresSrc, "common.py"), "utf8");
  expect(common).toMatch(/SVG_TEXT_PARAMS\s*=\s*\{\s*"svg\.fonttype":\s*"none"/);
  const scalingLaw = readFileSync(join(repoRoot, "en", "figures", "scaling-laws-1.svg"), "utf8");
  expect(scalingLaw).toContain("<text");
  expect(scalingLaw).toContain(">extrapolate</text>");
  expect(scalingLaw).toContain(">affordable</text>");
});

test("structured reasoning search figure keeps modes in separated lanes", () => {
  const source = readFileSync(join(figuresSrc, "structured-reasoning-search-1.py"), "utf8");
  expect(source).toContain("LANES = [");
  expect(source).toContain("def lane_label");
  expect(source).not.toContain('"selected frontier"');
  expect(source).not.toContain('"dead branches"');
  expect(source).not.toContain('"compute well spent"');
  expect(source).not.toContain('"compute wasted"');
});

test("every committed static SVG figure has source and bilingual outputs", () => {
  const sources = new Set(sourceScripts.map((file) => basename(file, ".py")));
  const refs = new Set<string>();

  for (const lang of ["en", "zh"]) {
    for (const file of walk(join(repoRoot, lang)).filter((path) => path.endsWith(".qmd"))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\/figures\/([^)\s]+\.svg)/g)) {
        refs.add(match[1].replace(/\.svg$/, ""));
      }
    }
  }

  expect(refs.size).toBeGreaterThan(0);
  for (const ref of refs) {
    expect(sources.has(ref), `${ref} needs figures-src/${ref}.py`).toBe(true);
  }

  for (const source of sources) {
    expect(existsSync(join(repoRoot, "en", "figures", `${source}.svg`)), `${source} missing en SVG`).toBe(true);
    expect(existsSync(join(repoRoot, "zh", "figures", `${source}.svg`)), `${source} missing zh SVG`).toBe(true);
  }
});
