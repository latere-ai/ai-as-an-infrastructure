import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/safety/07-confidential-inference.qmd", import.meta.url),
  "utf8",
);
const bibliographyCorpus = readdirSync(new URL("../../refs/", import.meta.url))
  .filter((name) => name.endsWith(".bib"))
  .map((name) => readFileSync(new URL(`../../refs/${name}`, import.meta.url), "utf8"))
  .join("\n");
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening defines three separate end-to-end properties", () => {
  for (const phrase of [
    "confidential inference is an end-to-end property of a serving session",
    "transport encryption protects data while it moves",
    "isolated execution protects plaintext while approved code processes it",
    "remote attestation supplies evidence about a target environment",
    "none of these properties proves that the approved application is safe",
    "a tee is one component, not the whole design",
  ]) expect(flat).toContain(phrase);
});

test("the threat model identifies assets, actors, and explicit exclusions", () => {
  for (const phrase of [
    "protected assets",
    "network observer",
    "cloud administrator",
    "hypervisor",
    "host operating system",
    "co-tenant",
    "serving application operator",
    "hardware vendor",
    "verifier",
    "client endpoint",
    "availability",
    "physical access",
    "side channels",
    "explicit exclusions",
  ]) expect(flat).toContain(phrase);
});

test("the plaintext-path inventory covers the complete serving path", () => {
  for (const phrase of [
    "tls termination",
    "load balancer",
    "relay",
    "tokenizer",
    "scheduler",
    "cpu buffers",
    "activations",
    "@gls-kv-cache",
    "device memory",
    "gpu-to-gpu links",
    "post-processing",
    "safety filters",
    "tool calls",
    "telemetry",
    "logs",
    "crash dumps",
    "caches",
    "storage",
    "backups",
  ]) expect(flat).toContain(phrase);
});

test("attestation uses the RATS roles and bounded evidence semantics", () => {
  for (const phrase of [
    "attester",
    "target environment",
    "evidence",
    "endorsements",
    "reference values",
    "verifier",
    "appraisal policy",
    "attestation result",
    "relying party",
    "fresh nonce",
    "does not prove source identity",
    "does not prove semantic behavior",
  ]) expect(flat).toContain(phrase);
});

test("fresh evidence binds the session key to the approved environment", () => {
  for (const phrase of [
    "ephemeral public key",
    "certificate chain",
    "tcb status",
    "revocation",
    "session key",
    "replay",
    "mix-and-match",
    "cuckoo",
    "relay",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/E\s*=\s*\\operatorname\{Sign\}/);
  expect(chapter).toMatch(/n\s*\\parallel\s*m\s*\\parallel\s*c\s*\\parallel\s*pk_E/);
});

test("CPU TEE families retain their different boundaries", () => {
  for (const phrase of [
    "sgx enclave",
    "sev-snp confidential vm",
    "tdx trust domain",
    "arm realm",
    "protected from",
    "not covered",
    "integration implication",
  ]) expect(flat).toContain(phrase);
});

test("accelerator protection composes independent evidence and links", () => {
  for (const phrase of [
    "parallel evidence roots",
    "composite attestation",
    "gpu firmware",
    "driver",
    "iommu",
    "device assignment",
    "cpu-to-gpu link",
    "gpu-to-gpu links",
    "hbm",
    "switch",
    "topology",
  ]) expect(flat).toContain(phrase);
});

test("key release and lifecycle changes are policy controlled", () => {
  for (const phrase of [
    "key broker",
    "tenant",
    "purpose",
    "security version",
    "expiry",
    "rotation",
    "revocation",
    "reset",
    "scrub",
    "re-attest",
  ]) expect(flat).toContain(phrase);
});

test("vendor systems are bounded case studies rather than certifications", () => {
  for (const phrase of [
    "vendor-stated design",
    "not an independent certification",
    "private cloud compute",
    "stateless",
    "no privileged access",
    "non-targetability",
    "transparency",
    "private processing",
    "private ai compute",
  ]) expect(flat).toContain(phrase);
});

test("performance is decomposed and benchmark claims remain scoped", () => {
  for (const phrase of [
    "time to first token",
    "inter-token latency",
    "p99",
    "startup and attestation",
    "same hardware",
    "same model",
    "precision",
    "batch",
    "context length",
    "output length",
    "topology",
    "padding",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/T_\{\\mathrm\{base\}\}/);
  expect(chapter).toMatch(/T_\{\\mathrm\{CC\}\}/);
  expect(chapter).toMatch(/\\mathrm\{overhead\}/);
});

test("cryptographic and deployment alternatives answer different questions", () => {
  for (const phrase of [
    "relocates trust",
    "multi-party computation",
    "fully homomorphic encryption",
    "model and protocol",
    "network conditions",
    "zero-knowledge",
    "integrity, not prompt confidentiality",
    "differential privacy",
    "training privacy",
    "on-premises",
  ]) expect(flat).toContain(phrase);
});

test("the residual-risk section covers every major failure class", () => {
  for (const phrase of [
    "traffic analysis",
    "side channels",
    "malicious approved code",
    "output exfiltration",
    "tool exfiltration",
    "rollback",
    "sealed state",
    "supply chain",
    "endpoint compromise",
    "availability",
  ]) expect(flat).toContain(phrase);
});

test("the operating record captures evidence, topology, keys, and exceptions", () => {
  for (const field of [
    "protected_assets_and_data_classes",
    "threat_model_and_explicit_exclusions",
    "plaintext_path_and_boundary_inventory",
    "workload_measurement_and_source_revision",
    "attestation_format_and_verifier_policy",
    "endorsements_reference_values_and_tcb_status",
    "freshness_and_session_key_binding",
    "cpu_gpu_switch_topology_and_link_protection",
    "image_model_data_and_key_revisions",
    "key_release_rotation_and_revocation",
    "ingress_egress_logging_and_storage_paths",
    "rollout_rollback_reset_and_scrub_policy",
    "side_channel_and_traffic_analysis_controls",
    "benchmark_workload_and_overhead_results",
    "verification_and_exception_owner",
  ]) expect(flat).toContain(field);
});

test("regression scenarios exercise the full serving boundary", () => {
  for (const phrase of [
    "quote replay",
    "stale tcb",
    "revoked firmware",
    "mismatched measurement",
    "unbound session key",
    "tls termination outside the boundary",
    "unattested gpu",
    "mixed cpu and gpu evidence",
    "plaintext gpu link",
    "debug image",
    "crash dump",
    "model swap",
    "targeted relay",
    "traffic-length leak",
    "rollback of sealed state",
    "tool exfiltration",
    "verifier outage",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain(
    "# Confidential Inference: Trusted Execution and Private Serving {#sec-confidential-inference}",
  );
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain('data-viz="stepper"');
  for (const ref of [
    "@sec-privacy-provenance",
    "@sec-security-authorization",
    "@sec-runtime-safety",
    "@sec-law-policy",
    "@sec-model-artifacts",
    "@sec-accelerators-networking",
    "@sec-orchestration-data-infra",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography includes primary standards, hardware, systems, and attacks", () => {
  for (const marker of [
    "rfc-editor.org/rfc/rfc9334.html",
    "eprint.iacr.org/2016/086",
    "doi.org/10.1145/3652597",
    "usenix.org/conference/usenixsecurity18/presentation/bulck",
    "usenix.org/conference/osdi22/presentation/li",
    "doi.org/10.1145/3623393.3623391",
    "docs.nvidia.com/nvidia-secure-ai-with-blackwell-and-hopper-gpus-whitepaper.pdf",
    "arxiv.org/abs/2409.03992",
    "security.apple.com/blog/private-cloud-compute",
    "ai.meta.com/static-resource/private-processing-technical-whitepaper",
    "assets.anthropic.com",
    "usenix.org/conference/usenixsecurity24/presentation/weiss",
    "arxiv.org/abs/2307.12533",
  ]) expect(bibliographyCorpus.toLowerCase()).toContain(marker);
});

test("every literature citation resolves to a local bibliography entry", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    expect(bibliographyCorpus).toMatch(new RegExp(`@[^{]+\\{${key},`, "i"));
  }
});

test("categorical and machine-like legacy claims are absent", () => {
  for (const phrase of [
    "enforced by nothing in the machine",
    "every mechanism between the user's tls connection and the gpu leaves the prompt readable",
    "a subpoena can compel",
    "the problem is also symmetric",
    "the silicon signed for exactly this software stack",
    "everything on the wires between them is ciphertext",
    "below 5% of throughput for typical llm workloads",
    "approaching zero as models grow",
    "designs in production",
    "converging on one shape",
    "the alternatives lose on cost",
    "mpc near 10^4x",
    "fhe beyond 10^5x",
    "tees are the only point on the curve",
    "every shipping root of trust belongs to a us company",
  ]) expect(flat).not.toContain(phrase);
});

test("the invented performance runnable is removed", () => {
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("compute_per_tok");
  expect(chapter).not.toContain("xfer_per_req");
  expect(chapter).not.toContain("tax = 0.35");
});

test("hard wraps and math use formats supported by the renderer", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"]) {
    expect(chapter).not.toContain(delimiter);
  }
});

test("the complete chapter renders without swallowing late prose", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "safety/confidential-inference.html",
    chapterTitle: "Confidential Inference: Trusted Execution and Private Serving",
    chapterNum: "60",
    prefix: "../",
    graphviz,
    lang: "en",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chapter, ctx);
  expect(html).not.toContain("katex-error");
  expect(html).toContain("Verification is a release decision");
  expect(headings.some(({ text }) => text === "Regression scenarios")).toBeTrue();
});

test("every Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
