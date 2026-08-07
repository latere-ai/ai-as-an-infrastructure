import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/02-model-artifacts.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/02-model-artifacts.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/model-artifacts.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis treats a deployable model as a versioned bundle", () => {
  expect(chapter).toMatch(
    /^# The Model as an Artifact: Formats, Distribution, and the Supply Chain \{#sec-model-artifacts\}/,
  );
  for (const phrase of [
    "a deployable model is a versioned bundle, not a filename",
    "release revision",
    "manifest",
    "weight shards",
    "configuration",
    "tokenizer",
    "chat template",
    "generation defaults",
    "adapter",
    "custom code",
  ]) expect(flat).toContain(phrase);
});

test("the bundle manifest gives every blob a verifiable identity", () => {
  for (const marker of ["B =", "d_i", "p_i", "r_i", "m_i", "s_i", "h_i", "SHA256", "b_i"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "bundle under review",
    "exact release revision",
    "relative path",
    "artifact role",
    "media type",
    "expected size in bytes",
    "expected cryptographic digest",
    "downloaded bytes",
    "canonical manifest",
  ]) expect(flat).toContain(phrase);
});

test("serialization guidance states both the safe default and its boundary", () => {
  for (const phrase of [
    "pickle",
    "torch.save",
    "starting with pytorch 2.6",
    "weights_only=true",
    "narrows",
    "denial of service",
    "safetensors",
    "tensor metadata",
    "raw tensor bytes",
    "not executable reconstruction instructions",
    "does not make the rest of a repository safe",
    "trust_remote_code=true",
    "full commit hash",
    "gguf",
    "parser",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("every model load was an execution of untrusted code");
});

test("distribution pins repository selection and verifies every file", () => {
  for (const phrase of [
    "branch or tag is mutable",
    "repository commit",
    "file digest",
    "shard index",
    "partial download",
    "cache",
    "mirror",
    "content-addressed",
    "oci distribution specification",
    "verify the response bytes",
  ]) expect(flat).toContain(phrase);
});

test("conversion and quantization create derived artifacts with lineage", () => {
  for (const phrase of [
    "conversion",
    "quantization",
    "adapter merge",
    "derived artifact",
    "source digest",
    "tool version",
    "transformation parameters",
    "new manifest",
    "new digest",
    "evaluation results",
  ]) expect(flat).toContain(phrase);
});

test("integrity provenance inventory and behavior remain separate claims", () => {
  for (const phrase of [
    "integrity",
    "authenticity",
    "provenance",
    "inventory",
    "behavior",
    "cryptographic digest",
    "signature",
    "attestation",
    "ml-bom",
    "model card",
    "does not prove",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("signatures scan origin, evaluations scan behavior");
});

test("behavioral attack evidence retains its experimental scope", () => {
  for (const phrase of [
    "proof-of-concept",
    "year trigger",
    "supervised fine-tuning",
    "reinforcement learning",
    "adversarial training",
    "600m to 13b",
    "250 poisoned documents",
    "experiment-specific",
    "sixty dollars",
    "ieee symposium on security and privacy",
    "cannot certify the absence of an unknown trigger",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("no scanner will ever catch");
  expect(flat).not.toContain("poisoning gets relatively easier as models scale");
});

test("the promotion procedure fails closed before serving", () => {
  for (const phrase of [
    "quarantine",
    "allowlist",
    "unexpected file",
    "read-only",
    "sandbox",
    "resource limits",
    "tensor names",
    "shapes",
    "dtypes",
    "smoke test",
    "behavioral evaluation",
    "internal registry",
    "promotion",
    "revocation",
  ]) expect(flat).toContain(phrase);
});

test("the runnable rejects changed and unmanifested files", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|torch|requests|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toBe(
    "release-a: verified (3 files)\n" +
      "release-a-tampered: rejected (digest mismatch: tokenizer.json)\n" +
      "release-a-extra: rejected (unexpected file: modeling_custom.py)\n",
  );
});

test("the rewrite removes categorical and machine-like legacy claims", () => {
  for (const phrase of [
    "one of two axes, weights or an api",
    "this one treats it as a file",
    "the only kind of closing that holds",
    "vanishing fraction",
    "the synthesis most of the field has reached",
    "behavioral evals\\n(the only scanner for weights)",
  ]) expect(chapter.toLowerCase()).not.toContain(phrase);
});

test("stable chapter interfaces and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-model-landscape",
    "@sec-serving-problem",
    "@sec-deployment-lifecycle",
    "@sec-confidential-inference",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-artifact-bundle",
    "fig-artifact-lineage",
    "fig-artifact-promotion",
  ]) expect(chapter).toContain(figure);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography favors official specifications and archival research", () => {
  for (const marker of [
    "docs.pytorch.org/docs/stable/notes/serialization.html",
    "github.com/huggingface/safetensors",
    "github.com/ggml-org/ggml/blob/6af560d55df03ad92116e3c0a697779584477e85/docs/gguf.md",
    "huggingface.co/docs/huggingface_hub",
    "github.com/opencontainers/distribution-spec",
    "github.com/ossf/model-signing-spec",
    "slsa.dev/spec/v1.2/build-provenance",
    "cyclonedx.org/capabilities/mlbom",
    "10.1109/sp54263.2024.00179",
    "arxiv.org/abs/2401.05566",
    "arxiv.org/abs/2510.07192",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(10);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the shared bibliography keeps citations used by the untranslated chapter", () => {
  const citeKeys = new Set(
    [...chineseChapter.matchAll(/@([a-z][a-z0-9]*)/gi)]
      .map((match) => match[1])
      .filter((key) => !/^(sec|fig|tbl|eq|gls)/.test(key)),
  );
  for (const key of citeKeys) {
    expect(bibliography, `${key} should remain available to the Chinese chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the complete chapter renders without swallowing figures or late prose", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/model-artifacts.html",
    chapterTitle: "The Model as an Artifact",
    chapterNum: "74",
    prefix: "../",
    graphviz,
    lang: "en",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chapter, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("A promoted artifact is a deployment input, not a safety certificate");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(3);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
