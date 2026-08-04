import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/orchestration/06-computer-use.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/computer-use.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("computer use begins with user value and a bounded fallback", () => {
  for (const phrase of [
    "software that lacks a suitable machine interface",
    "screen is an observation",
    "pointer and keyboard events are actions",
    "universal fallback",
    "prefer the typed tool",
  ]) expect(flat).toContain(phrase);
});

test("the control loop defines partial observability and every symbol", () => {
  for (const phrase of [
    "hidden application state",
    "o_t = o(s_t, v_t)",
    "s_{t+1} \\sim t(s_t, a_t, \\xi_t)",
    "\\pi(a_t \\mid h_t, u, b_t)",
    "postcondition",
    "partial observation",
    "every symbol",
  ]) expect(flat).toContain(phrase);
});

test("the action contract binds observations, authority, and effects", () => {
  for (const phrase of [
    "uiaction",
    "uiobservation",
    "uiresult",
    "frame_id",
    "window_id",
    "viewport",
    "precondition",
    "risk_class",
    "approval_id",
    "captured_at",
    "visible_dialogs",
    "postcondition",
  ]) expect(flat).toContain(phrase);
});

test("the action contract and display math fit a narrow reading column", () => {
  const contract = chapter.match(/```text\n([\s\S]*?)\n```/)?.[1];
  expect(contract).toBeDefined();
  expect(Math.max(...contract!.split("\n").map((line) => line.length))).toBeLessThanOrEqual(32);
  expect(chapter).toContain("q_t = \\Pr(E_t \\mid E_{<t},h_t)");
  expect(chapter).toContain("C_t ={}& C_{\\text{model},t}+C_{\\text{image},t}");
});

test("execution rejects stale coordinates and observes after change", () => {
  for (const phrase of [
    "stale frame",
    "coordinate remapping",
    "out-of-bounds",
    "focus mismatch",
    "recapture",
    "observable condition",
    "deadline",
  ]) expect(flat).toContain(phrase);
});

test("representation choices cover pixels, structure, marks, and tools", () => {
  for (const phrase of [
    "pixels",
    "accessibility tree",
    "set of marks",
    "api or typed tool",
    "coverage",
    "identity",
    "stale",
    "same run and effect ledger",
  ]) expect(flat).toContain(phrase);
});

test("the representation comparison does not require a wide table", () => {
  expect(chapter).not.toContain(
    "| Channel | What it contributes | Main failure modes |",
  );
  for (const label of [
    "**Screenshot pixels.**",
    "**DOM or accessibility tree.**",
    "**Detected elements or set of marks.**",
    "**API or typed tool.**",
  ]) expect(chapter).toContain(label);
});

test("reliability uses conditional probabilities, not a universal p-to-n law", () => {
  for (const phrase of [
    "\\prod_{t=1}^{n}",
    "conditional",
    "homogeneous independent special case",
    "correlated",
    "retry",
    "recovery",
  ]) expect(flat).toContain(phrase);
});

test("ambiguous effects are reconciled rather than blindly replayed", () => {
  for (const phrase of [
    "safe to retry",
    "inspect and reconcile",
    "blind replay",
    "exact payload",
    "current state",
    "idempotent",
  ]) expect(flat).toContain(phrase);
});

test("the environment covers browser and desktop state without host leakage", () => {
  for (const phrase of [
    "browser-only",
    "full desktop",
    "downloads",
    "clipboard",
    "multiple windows",
    "host browser profile",
    "application state",
    "session state",
    "model context",
  ]) expect(flat).toContain(phrase);
});

test("security separates untrusted content from user authority", () => {
  for (const phrase of [
    "untrusted data, not authority",
    "allowed domain does not make its content trusted",
    "only direct user instructions",
    "typing sensitive data counts as transmission",
    "point of risk",
    "classifier is not authorization",
    "target origin",
    "confused deputy",
  ]) expect(flat).toContain(phrase);
});

test("trajectory cost names its terms without inventing a universal multiplier", () => {
  for (const phrase of [
    "c = \\sum_{t=1}^{n}",
    "c_{\\text{model},t}",
    "c_{\\text{image},t}",
    "c_{\\text{env},t}",
    "c_{\\text{tool},t}",
    "l = \\sum_{t=1}^{n}",
    "wall time",
    "vm-seconds",
  ]) expect(flat).toContain(phrase);
});

test("evaluation separates grounding from end-to-end task success", () => {
  for (const phrase of [
    "grounding benchmark",
    "end-to-end task benchmark",
    "state-based verifier",
    "bootstrap confidence interval",
    "benchmark version",
    "environment image",
    "action interface",
    "model calls",
    "human intervention",
  ]) expect(flat).toContain(phrase);
});

test("evaluation covers safety, efficiency, recovery, and injected faults", () => {
  for (const phrase of [
    "invalid-action rate",
    "side-effect precision",
    "approval-bypass rate",
    "prompt-injection attack success",
    "sensitive-data exposure",
    "post-cancel action count",
    "focus theft",
    "stale accessibility tree",
    "ambiguous duplicate action",
  ]) expect(flat).toContain(phrase);
});

test("the evidence trail uses primary benchmark and safety sources", () => {
  for (const marker of [
    "proceedings.mlr.press/v70/shi17a.html",
    "proceedings.neurips.cc/paper_files/paper/2024",
    "proceedings.mlsys.org/paper_files/paper/2026",
    "proceedings.neurips.cc/paper_files/paper/2025",
    "developers.openai.com/api/docs/guides/tools-computer-use",
    "platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool",
    "proceedings.iclr.cc/paper_files/paper/2025",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
  expect(bibliography).toContain("Reports 83.4\\% on OSWorld-Verified");
  expect(bibliography).not.toContain("Reports 84\\% on OSWorld-Verified");
});

test("the rewrite removes unsupported certainty and score theater", () => {
  for (const phrase of [
    "most of the world's software offers no such interface",
    "will never ship anything else",
    "hybrids win",
    "perception, not reasoning, was the binding constraint",
    "two to three orders of magnitude",
    "the one interface whose integration cost is already paid",
    "grew explosively",
    "the labs themselves refuse to pick a side",
    "passed the human baseline",
    "accs  =",
    "hackernews2025promptfix",
  ]) expect(flat).not.toContain(phrase);
});

test("stable structure and the handoff to multi-agent systems remain", () => {
  expect(chapter).toContain(
    "# Computer Use: the GUI as an Action Space {#sec-computer-use}",
  );
  expect(chapter).toMatch(/## .*contested/i);
  expect(chapter).toMatch(/## .*(constraint arrow|lower-layer constraint)/i);
  expect(chapter).toContain("@sec-multi-agent-systems");
  expect(chapter).toContain("::: {#further-reading}");
});
