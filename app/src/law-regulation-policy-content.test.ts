import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/safety/08-law-regulation-policy.qmd", import.meta.url),
  "utf8",
);
const bibliographyCorpus = readdirSync(new URL("../../refs/", import.meta.url))
  .filter((name) => name.endsWith(".bib"))
  .map((name) => readFileSync(new URL(`../../refs/${name}`, import.meta.url), "utf8"))
  .join("\n");
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening defines compliance as a dated system claim", () => {
  for (const phrase of [
    "legal compliance is not a property of a model",
    "specific system",
    "intended use",
    "actor",
    "jurisdiction",
    "effective date",
    "source version",
    "not legal advice",
  ]) expect(flat).toContain(phrase);
});

test("sources and legal status are kept distinct", () => {
  for (const phrase of [
    "enacted law",
    "binding agency rule",
    "official guidance",
    "treaty",
    "consensus standard",
    "voluntary framework",
    "company policy",
    "contract",
    "applicable",
    "effective",
    "enforceable",
    "proposed",
    "signed",
    "ratified",
  ]) expect(flat).toContain(phrase);
});

test("classification follows a complete operational workflow", () => {
  for (const phrase of [
    "inventory the service",
    "identify every actor",
    "classify the system and intended use",
    "map horizontal and sectoral law",
    "check effective dates",
    "map each obligation",
    "assign an owner",
    "monitor changes",
  ]) expect(flat).toContain(phrase);
});

test("the EU AI Act is not reduced to a four-tier pyramid", () => {
  for (const phrase of [
    "prohibited practices",
    "article 6",
    "annex i",
    "annex iii",
    "article 50",
    "general-purpose ai",
    "parallel",
    "article 2",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a system is sorted into one of four tiers");
  expect(flat).not.toContain("minimal risk most systems, no extra duty");
});

test("GPAI duties, exceptions, and systemic-risk designation are bounded", () => {
  for (const phrase of [
    "technical documentation",
    "downstream providers",
    "copyright policy",
    "training-content summary",
    "authorised representative",
    "open-source",
    "10^25 flop",
    "commission may designate",
    "model evaluation",
    "adversarial testing",
    "serious-incident reporting",
    "cybersecurity",
  ]) expect(flat).toContain(phrase);
});

test("the current EU transition dates are explicit", () => {
  for (const phrase of [
    "2 february 2025",
    "2 august 2025",
    "2 august 2026",
    "2 august 2027",
    "2 december 2027",
    "2 august 2028",
    "27 july 2026",
  ]) expect(flat).toContain(phrase);
});

test("the value-chain roles and role-changing actions are covered", () => {
  for (const phrase of [
    "provider",
    "gpai provider",
    "downstream provider",
    "deployer",
    "importer",
    "distributor",
    "product manufacturer",
    "authorised representative",
    "substantial modification",
    "intended purpose",
  ]) expect(flat).toContain(phrase);
});

test("US authorities are described without a federal-versus-EU binary", () => {
  for (const phrase of [
    "consumer protection",
    "anti-discrimination",
    "employment",
    "credit",
    "product safety",
    "federal agencies' own use",
    "m-25-21",
    "voluntary",
    "colorado",
    "california",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the united states has so far declined a single horizontal statute");
});

test("existing rights and sectoral rules remain in scope", () => {
  for (const phrase of [
    "data protection",
    "gdpr",
    "consumer protection",
    "employment",
    "credit",
    "product safety",
    "intellectual property",
    "contract",
  ]) expect(flat).toContain(phrase);
});

test("copyright decisions are scoped rather than generalized", () => {
  for (const phrase of [
    "jurisdiction-specific",
    "procedural posture",
    "lawfully acquired",
    "market harm",
    "do not settle",
  ]) expect(flat).toContain(phrase);
});

test("treaties, standards, and certifications have bounded meanings", () => {
  for (const phrase of [
    "council of europe framework convention",
    "entry into force",
    "oecd ai principles",
    "iso/iec 42001",
    "management system",
    "not a finding that a particular model is safe",
    "incorporated",
  ]) expect(flat).toContain(phrase);
});

test("voluntary frontier policies are separated from law", () => {
  for (const phrase of [
    "capability threshold",
    "evaluation",
    "safeguard",
    "safety case",
    "voluntary self-governance",
    "can be revised by its author",
  ]) expect(flat).toContain(phrase);
});

test("governance artifacts are evidence, not interchangeable labels", () => {
  for (const phrase of [
    "requirement",
    "control",
    "artifact",
    "model card",
    "datasheet",
    "technical documentation",
    "conformity assessment",
    "impact assessment",
    "post-market monitoring",
    "incident report",
    "retention",
  ]) expect(flat).toContain(phrase);
});

test("the legal register captures classification, evidence, and change", () => {
  for (const field of [
    "system_and_model_revisions",
    "intended_purpose_and_prohibited_uses",
    "markets_jurisdictions_and_effective_dates",
    "actors_roles_and_contractual_allocation",
    "legal_sources_status_and_versions",
    "classification_and_risk_category",
    "sectoral_and_horizontal_obligations",
    "data_sources_rights_and_retention",
    "required_controls_and_evidence",
    "assessment_registration_and_authority_contacts",
    "transparency_human_oversight_and_appeal",
    "monitoring_incident_and_reporting_clocks",
    "change_triggers_and_reclassification",
    "exceptions_conflicts_and_legal_owner",
    "last_review_next_review_and_approver",
  ]) expect(flat).toContain(field);
});

test("regression scenarios exercise legal change and operational drift", () => {
  for (const phrase of [
    "market expansion",
    "role change",
    "substantial modification",
    "model swap",
    "new intended use",
    "gpai designation",
    "open-source condition",
    "stale guidance",
    "deadline transition",
    "withdrawn standard",
    "incident clock",
    "authority request",
    "retention conflict",
    "transparency label",
    "human-oversight bypass",
    "vendor evidence",
    "jurisdiction conflict",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# Law, Regulation, and Policy {#sec-law-policy}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain('data-viz="stepper"');
  for (const ref of [
    "@sec-data-curation",
    "@sec-model-artifacts",
    "@sec-privacy-provenance",
    "@sec-security-authorization",
    "@sec-runtime-safety",
    "@sec-operational-evaluation",
    "@sec-confidential-inference",
    "@sec-orchestration-data-infra",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography anchors current claims in primary sources", () => {
  for (const marker of [
    "eur-lex.europa.eu/eli/reg/2024/1689/oj",
    "oj:l_202601744",
    "digital-strategy.ec.europa.eu/en/policies/guidelines-gpai-providers",
    "nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf",
    "nvlpubs.nist.gov/nistpubs/ai/nist.ai.600-1.pdf",
    "m-25-21-accelerating-federal-use-of-ai",
    "leginfo.legislature.ca.gov/faces/billtextclient.xhtml?bill_id=202520260sb53",
    "leg.colorado.gov/bills/sb26-189",
    "treatynum=225",
    "oecd.ai/en/ai-principles",
    "eur-lex.europa.eu/eli/reg/2016/679/oj",
    "iso.org/standard/42001",
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
    "none of those layers decides whether the model may be deployed at all",
    "all three are now written into binding law",
    "the base of the pyramid, where most software sits, carries no new obligation",
    "the act's reach is not legal extraterritoriality",
    "a model deployed across both markets inherits the union of their demands",
    "the framework the developer writes for itself",
    "all three are disclosure regimes",
    "the answer is beginning to emerge: insurance",
  ]) expect(flat).not.toContain(phrase);
});

test("the invented insurance runnable is removed", () => {
  expect(chapter).not.toContain(".runnable");
  expect(chapter).not.toContain("random.seed(0)");
  expect(chapter).not.toMatch(/N\s*,\s*p\s*,\s*trials/);
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
    currentHref: "safety/law-regulation-policy.html",
    chapterTitle: "Law, Regulation, and Policy",
    chapterNum: "61",
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
  expect(html).toContain("Compliance must survive system change");
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
