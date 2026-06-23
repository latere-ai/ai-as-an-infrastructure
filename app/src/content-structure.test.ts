import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function src(p: string) {
  return readFileSync(new URL("../../" + p, import.meta.url), "utf8");
}

test("human-interface oversight is wired into both book manifests before the data engine", () => {
  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    const oversight = yml.indexOf("practice/11-human-interface-oversight.qmd");
    const data = yml.indexOf("practice/12-production-data-engine.qmd");
    expect(oversight).toBeGreaterThan(0);
    expect(data).toBeGreaterThan(oversight);
    expect(yml).not.toContain("practice/11-production-data-engine.qmd");
  }
});

test("the human-interface chapter closes the recorded content gap", () => {
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Product / UX / human-interface layer**");
  for (const lang of ["en", "zh"]) {
    expect(src(`${lang}/practice/index.qmd`)).toContain("@sec-human-interface-oversight");
    expect(src(`${lang}/orientation/02-field-map.qmd`)).toContain("@sec-human-interface-oversight");
    expect(src(`${lang}/practice/11-human-interface-oversight.qmd`)).toContain("{#sec-human-interface-oversight}");
  }
  expect(src("README.md")).toContain("human oversight surfaces");
});

test("ecosystem and economics is a full six-chapter part in both languages", () => {
  const expected = [
    "ecosystem/01-model-landscape.qmd",
    "ecosystem/02-tooling-ecosystem.qmd",
    "ecosystem/03-economics.qmd",
    "ecosystem/04-market-structure.qmd",
    "ecosystem/05-adoption-productivity.qmd",
    "ecosystem/06-data-rights-economics.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/ecosystem/index.qmd`);
    for (const section of [
      "@sec-model-landscape",
      "@sec-tooling-ecosystem",
      "@sec-economics",
      "@sec-market-structure",
      "@sec-adoption-productivity",
      "@sec-data-rights-economics",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("evaluation is a full seven-chapter measurement part in both languages", () => {
  const expected = [
    "evaluation/01-benchmarks.qmd",
    "evaluation/02-statistical-reliability.qmd",
    "evaluation/03-human-evaluation-rubrics.qmd",
    "evaluation/04-judging-holistic.qmd",
    "evaluation/05-factuality-grounding.qmd",
    "evaluation/06-evaluating-agents.qmd",
    "evaluation/07-operational-evaluation.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/evaluation/index.qmd`);
    for (const section of [
      "@sec-benchmarks",
      "@sec-statistical-reliability",
      "@sec-human-evaluation-rubrics",
      "@sec-judging-holistic",
      "@sec-factuality-grounding",
      "@sec-evaluating-agents",
      "@sec-operational-evaluation",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("the expanded ecosystem part is reflected in top-level book surfaces", () => {
  expect(src("README.md")).toContain("market structure");
  expect(src("README.md")).toContain("adoption and productivity");
  expect(src("README.md")).toContain("data rights");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Ecosystem and economics depth**");
});

test("the expanded evaluation part is tracked in top-level book surfaces", () => {
  expect(src("README.md")).toContain("statistical reliability");
  expect(src("README.md").replace(/\s+/g, " ")).toContain("operational governance");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Evaluation depth and governance**");
});

test("post-training adaptation is a full seven-chapter part in both languages", () => {
  const expected = [
    "adaptation/01-sft-peft.qmd",
    "adaptation/02-behavior-specs-preference-data.qmd",
    "adaptation/03-rlhf-reward-modeling.qmd",
    "adaptation/04-dpo-variants.qmd",
    "adaptation/05-verifiable-rewards-reasoning.qmd",
    "adaptation/06-safety-tuning-instruction-hierarchy.qmd",
    "adaptation/07-synthetic-data-self-improvement.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/adaptation/index.qmd`);
    for (const section of [
      "@sec-sft-peft",
      "@sec-behavior-specs",
      "@sec-rlhf",
      "@sec-dpo-variants",
      "@sec-verifiable-rewards",
      "@sec-safety-tuning",
      "@sec-synthetic-data",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("the expanded adaptation part is tracked in top-level book surfaces", () => {
  expect(src("README.md")).toContain("behavior specifications");
  expect(src("README.md")).toContain("verifiable rewards");
  expect(src("README.md")).toContain("instruction hierarchy");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Post-training adaptation and alignment depth**");
});

test("foundations and pretraining ends with a mid-training bridge chapter", () => {
  const expected = [
    "foundations/01-scaling-laws.qmd",
    "foundations/02-data-curation.qmd",
    "foundations/03-tokenization.qmd",
    "foundations/04-transformer-architecture.qmd",
    "foundations/05-moe-ssm-hybrids.qmd",
    "foundations/06-training-at-scale.qmd",
    "foundations/07-mid-training.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/foundations/index.qmd`);
    for (const section of [
      "@sec-scaling-laws",
      "@sec-data-curation",
      "@sec-tokenization",
      "@sec-transformer-architecture",
      "@sec-moe-ssm-hybrids",
      "@sec-training-at-scale",
      "@sec-mid-training",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("the mid-training bridge is tracked in top-level book surfaces", () => {
  expect(src("README.md")).toContain("mid-training bridges");
  expect(src("en/index.qmd")).toContain("mid-training bridges");
  expect(src("zh/index.qmd")).toContain("中段训练桥接");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Mid-training bridge**");
  expect(src("en/orientation/01-whole-stack.qmd")).toContain("@sec-mid-training");
  expect(src("zh/orientation/01-whole-stack.qmd")).toContain("@sec-mid-training");
  expect(src("en/foundations/02-data-curation.qmd")).toContain("covered in @sec-mid-training");
  expect(src("zh/foundations/02-data-curation.qmd")).toContain("放在 @sec-mid-training 讨论");
});

test("reasoning and test-time compute is a full seven-chapter part in both languages", () => {
  const expected = [
    "reasoning/01-eliciting-reasoning.qmd",
    "reasoning/02-structured-reasoning-search.qmd",
    "reasoning/03-programs-solvers-symbolic.qmd",
    "reasoning/04-verifiers-process-supervision.qmd",
    "reasoning/05-training-to-reason.qmd",
    "reasoning/06-reasoning-data-distillation.qmd",
    "reasoning/07-inference-time-scaling.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    const intro = src(`${lang}/reasoning/index.qmd`);
    for (const section of [
      "@sec-eliciting-reasoning",
      "@sec-structured-reasoning-search",
      "@sec-programs-solvers-symbolic",
      "@sec-verifiers-process-supervision",
      "@sec-training-to-reason",
      "@sec-reasoning-data-distillation",
      "@sec-inference-time-scaling",
    ]) {
      expect(intro).toContain(section);
    }
  }
});

test("the expanded reasoning part is tracked in top-level book surfaces", () => {
  expect(src("README.md")).toContain("structured search");
  expect(src("README.md")).toContain("verifiers");
  expect(src("README.md")).toContain("reasoning data");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Reasoning and test-time compute depth**");
});
