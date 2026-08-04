import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const intro = readFileSync(
  new URL("../../en/safety/index.qmd", import.meta.url),
  "utf8",
);
const flat = intro.replace(/^>\s?/gm, "").replace(/\s+/g, " ").toLowerCase();

test("the verified opening quotation keeps its complete source context", () => {
  expect(flat).toContain(
    "in order to foster advances in responsible innovation, an in-depth understanding of the potential risks posed by these models is needed.",
  );
  expect(intro).toContain("Laura Weidinger et al.");
  expect(intro).toContain("Ethical and social risks of harm from Language Models");
  expect(intro).toContain("https://arxiv.org/abs/2112.04359");
});

test("the introduction defines safety as a located control problem", () => {
  for (const phrase of [
    "safety is not a layer added after capability is built",
    "part vii established how evidence earns decision authority",
    "what control that evidence can justify",
    "harm or unacceptable behavior",
    "protected party or asset",
    "system boundary",
    "enforcement point",
    "what happens when the control fails",
  ]) expect(flat).toContain(phrase);
});

test("interpretability and oversight are evidence with stated limits", () => {
  for (const phrase of [
    "internal evidence is not itself a control",
    "reviewer cannot independently solve the task",
    "strengthen the judgment",
    "constrain the system despite mistrust",
  ]) expect(flat).toContain(phrase);
});

test("behavioral and authorization controls remain distinct", () => {
  for (const phrase of [
    "identity and permissions",
    "independent input, output, and tool controls",
    "failure under deliberate attack",
    "a trained refusal, a runtime classifier, and an authorization boundary control different objects",
    "none can substitute for the others",
  ]) expect(flat).toContain(phrase);
});

test("privacy confidentiality and law retain different guarantees", () => {
  for (const phrase of [
    "what a trained model remembers",
    "explicit threat model",
    "attested computing",
    "who is accountable",
    "a contractual promise, an attested mechanism, and a legal duty are not interchangeable",
    "residual risk",
  ]) expect(flat).toContain(phrase);
});

test("all eight chapters appear once and in book order", () => {
  const refs = [
    "@sec-interpretability",
    "@sec-oversight-control",
    "@sec-security-authorization",
    "@sec-runtime-safety",
    "@sec-adversarial-robustness",
    "@sec-privacy-provenance",
    "@sec-confidential-inference",
    "@sec-law-policy",
  ];
  let previous = -1;
  for (const ref of refs) {
    expect(intro.match(new RegExp(ref, "g"))?.length).toBe(1);
    const position = intro.indexOf(ref);
    expect(position).toBeGreaterThan(previous);
    previous = position;
  }
});

test("the page remains narrative and removes the compressed old catalog", () => {
  expect(intro).not.toMatch(/^[-*] /m);
  expect(intro).not.toContain("Safety is not one layer at the top of the stack");
  expect(intro).not.toContain("This part collects those questions");
  expect(intro).not.toContain("The part is deliberately broad because the failure modes are broad");
  expect(intro).not.toContain("There is no single safety switch");
  expect(intro).not.toContain("—");
});
