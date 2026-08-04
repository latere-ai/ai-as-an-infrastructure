import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/orchestration/04-personalization-memory.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/personalization-memory.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("personalization begins with user benefit and a bounded purpose", () => {
  for (const phrase of [
    "avoid repeating",
    "current request",
    "declared purpose",
    "not every remembered detail",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("memory is therefore the assistant market's switching cost");
});

test("persistence location and inference-time application remain separate axes", () => {
  for (const phrase of [
    "persistence location",
    "application path",
    "server-side store",
    "client-side store",
    "parameter adapter",
    "prompt context",
    "tool call",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("every shipped system chose the third home");
});

test("records distinguish user statements, observations, and inferences", () => {
  for (const phrase of [
    "explicit instruction",
    "observed",
    "inferred",
    "provenance",
    "confidence",
    "validity",
    "sensitivity",
  ]) expect(flat).toContain(phrase);
});

test("current instructions and corrections override remembered preferences", () => {
  for (const phrase of [
    "current request overrides",
    "supersede",
    "contradiction",
    "planned event",
    "does not prove that it happened",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("must eventually become \"you went\"");
});

test("the lifecycle separates write, use, pause, deletion, and portability", () => {
  for (const phrase of [
    "write gate",
    "temporary mode",
    "pause",
    "turning memory off",
    "delete",
    "machine-readable",
    "lineage",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("erasing a memory row is an engineering triviality");
});

test("sensitive and third-party data receive stricter treatment", () => {
  for (const phrase of [
    "sensitive",
    "third-party",
    "do not persist",
    "credentials",
    "data minimization",
  ]) expect(flat).toContain(phrase);
});

test("memory is treated as untrusted evidence, not authority", () => {
  for (const phrase of [
    "untrusted evidence",
    "prompt injection",
    "poison",
    "sycophancy",
    "cross-account",
  ]) expect(flat).toContain(phrase);
});

test("evaluation measures benefit, wrong personalization, control, and cost", () => {
  for (const phrase of [
    "personalization lift",
    "wrong-personalization rate",
    "stale-memory use",
    "correction latency",
    "deletion completeness",
    "added latency",
    "no-memory baseline",
  ]) expect(flat).toContain(phrase);
});

test("the evidence trail uses primary research and official controls", () => {
  for (const marker of [
    "aclanthology.org/2024.acl-long.399",
    "eur-lex.europa.eu/eli/reg/2016/679",
    "edpb.europa.eu",
    "help.openai.com/en/articles/8590148",
    "support.claude.com/en/articles/11817273",
    "proceedings.neurips.cc",
    "proceedings.iclr.cc/paper_files/paper/2024/hash/9028b8a3ca98f58e373f0c1497a17448-abstract-conference.html",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the rewrite removes synthetic and unsupported market claims", () => {
  for (const phrase of [
    "orchestration and storage impossibility",
    "prices itself out",
    "no consumer product has shipped it at scale",
    "over 90% of both",
    "all four",
    "ten-million-token windows",
    "a fixed-size distillation of an unbounded stream",
    "rng = np.random.default_rng",
  ]) expect(flat).not.toContain(phrase);
});

test("chapter cross-references and headings render without source markup", () => {
  expect(chapter).toContain("# Personalization Memory {#sec-personalization}");
  expect(chapter).not.toContain("Chapter @sec-");
  expect(chapter).not.toContain("## Further reading {.appendix}");
  expect(chapter).toContain("@sec-the-harness turns these");
  expect(chapter).not.toContain("@sec-evaluation-harness");
  expect(chapter).toContain("::: {#further-reading}");
  expect(chapter).not.toContain("::: {#refs}");
});
