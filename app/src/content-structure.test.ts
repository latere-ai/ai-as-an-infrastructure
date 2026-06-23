import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

function src(p: string) {
  return readFileSync(new URL("../../" + p, import.meta.url), "utf8");
}

function flat(p: string) {
  return src(p).replace(/\s+/g, " ");
}

function qmdPaths(dir: string): string[] {
  const base = new URL("../../" + dir + "/", import.meta.url);
  const out: string[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...qmdPaths(path));
    else if (entry.name.endsWith(".qmd")) out.push(path);
  }
  return out;
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

test("practice and operations closes with operating contracts in both languages", () => {
  const expected = [
    "practice/01-choosing-a-model.qmd",
    "practice/02-serving-and-compute.qmd",
    "practice/03-edge-on-device.qmd",
    "practice/04-training-finetuning-practice.qmd",
    "practice/05-agents-and-sandboxes.qmd",
    "practice/06-retrieval-and-documents.qmd",
    "practice/07-evaluation-and-observability.qmd",
    "practice/08-wiring-a-2026-stack.qmd",
    "practice/09-deployment-lifecycle.qmd",
    "practice/10-reliability-nondeterministic.qmd",
    "practice/11-human-interface-oversight.qmd",
    "practice/12-production-data-engine.qmd",
    "practice/13-operating-contracts.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    expect(src(`${lang}/practice/index.qmd`)).toContain("@sec-operating-contracts");
    expect(src(`${lang}/orientation/02-field-map.qmd`)).toContain("@sec-operating-contracts");
    expect(src(`${lang}/practice/13-operating-contracts.qmd`)).toContain("{#sec-operating-contracts}");
  }
});

test("operating contracts are tracked in top-level book surfaces", () => {
  expect(src("README.md")).toContain("operating contracts for SLOs, cost governance, incidents, and multi-tenancy");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Operating contracts and infrastructure operations**");
  expect(src("en/index.qmd")).toContain("SLOs, cost governance, incidents");
  expect(src("zh/index.qmd")).toContain("SLO、成本治理、事故");
  expect(src("en/summary.qmd")).toContain("operating contracts turn SLOs");
  expect(src("zh/summary.qmd")).toContain("运营契约把 SLO");
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

test("base model formation ends with a mid-training bridge chapter", () => {
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

test("part I is framed as base model formation, not only pretraining", () => {
  expect(src("en/book.yml")).toContain('part: "Part I: Base Model Formation"');
  expect(src("zh/book.yml")).toContain('part: "第一部分 · 基座模型的形成"');
  expect(src("en/foundations/index.qmd")).toContain("# Part I: Base Model Formation");
  expect(src("zh/foundations/index.qmd")).toContain("# 第一部分 · 基座模型的形成");
  expect(src("README.md")).toContain("Part I, Base Model Formation");
  expect(src("en/index.qmd")).toContain("Part I, Base Model Formation");
  expect(src("zh/index.qmd")).toContain("第一部分，基座模型的形成");
  expect(src("en/orientation/02-field-map.qmd")).toContain("Part I\\nBase Model Formation");
  expect(src("zh/orientation/02-field-map.qmd")).toContain("第一部分\\n基座模型的形成");
  expect(src("en/orientation/index.qmd")).toContain("base-model formation, adaptation");
  expect(src("zh/orientation/index.qmd")).toContain("经过基座模型形成和适配");
  expect(src("en/orientation/01-whole-stack.qmd")).toContain("Station two: base-model formation");
  expect(src("zh/orientation/01-whole-stack.qmd")).toContain("环节二：基座模型形成");
  expect(src("en/foundations/summary.qmd")).toContain("base-model formation is infrastructure");
  expect(src("zh/foundations/summary.qmd")).toContain("基座模型形成不是背景知识");
  expect(flat("en/summary.qmd")).toContain("We began with base-model formation");
  expect(src("zh/summary.qmd")).toContain("我们从基座模型的形成开始");
});

test("serving cost references are anchored to the inference and serving part", () => {
  expect(src("en/inference/06-serving-multimodal.qmd")).not.toContain("Part IV built a serving stack");

  const enEconomics = src("en/ecosystem/03-economics.qmd");
  expect(enEconomics).not.toContain("Part VI levers");
  expect(enEconomics).not.toContain("Every chapter in Part VI");
  expect(enEconomics).not.toContain("every Part VI optimization");
  expect(enEconomics).not.toContain("optimizations of Part VI");
  expect(enEconomics).toContain("The serving chapters in Part V");
  expect(enEconomics).toContain("Part V serving levers");
  expect(enEconomics).toContain("serving optimizations in Part V");

  const zhEconomics = src("zh/ecosystem/03-economics.qmd");
  expect(zhEconomics).not.toContain("第六部分的每一章");
  expect(zhEconomics).not.toContain("第六部分每一项优化");
  expect(zhEconomics).not.toContain("第六部分的手段");
  expect(zhEconomics).not.toContain("第六部分的优化为什么能直接回本");
  expect(zhEconomics).toContain("第五部分的服务章节");
  expect(zhEconomics).toContain("第五部分的服务手段");
  expect(zhEconomics).toContain("第五部分的服务优化为什么能直接回本");
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

test("infrastructure closes capability measurement with verification frontier", () => {
  const expected = [
    "infrastructure/01-accelerators-networking.qmd",
    "infrastructure/02-orchestration-data-infra.qmd",
    "infrastructure/03-the-compute-frontier.qmd",
    "infrastructure/04-making-the-silicon.qmd",
    "infrastructure/05-powering-it.qmd",
    "infrastructure/06-the-machine-that-breaks.qmd",
    "infrastructure/07-where-learning-hits-limits.qmd",
    "infrastructure/08-the-capability-horizon.qmd",
    "infrastructure/09-verification-frontier.qmd",
    "infrastructure/summary.qmd",
  ];

  for (const lang of ["en", "zh"]) {
    const yml = src(`${lang}/book.yml`);
    let last = -1;
    for (const chapter of expected) {
      const next = yml.indexOf(chapter);
      expect(next, `${lang}/${chapter} missing from book.yml`).toBeGreaterThan(last);
      last = next;
    }

    expect(src(`${lang}/infrastructure/index.qmd`)).toContain("@sec-verification-frontier");
    expect(src(`${lang}/infrastructure/09-verification-frontier.qmd`)).toContain("{#sec-verification-frontier}");
  }

  expect(src("README.md")).toContain("compute, capability, and verification frontiers");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Verification frontier**");
});

test("mid-book handoffs do not signal that the whole book has ended", () => {
  const forbidden: Record<string, string[]> = {
    en: ["The book closes there", "This brings the book to its last open question"],
    zh: ["全书在这里收束", "全书最后留下", "全书最后落在"],
  };

  for (const lang of ["en", "zh"]) {
    for (const path of qmdPaths(lang)) {
      if (path.endsWith("/summary.qmd")) continue;
      const text = src(path);
      for (const phrase of forbidden[lang]) {
        expect(text.includes(phrase), `${path} uses premature finality phrase: ${phrase}`).toBe(false);
      }
    }
  }
});

test("the infrastructure arc explicitly hands off to ecosystem and practice", () => {
  const enHorizon = src("en/infrastructure/08-the-capability-horizon.qmd");
  expect(enHorizon).toContain("@sec-verification-frontier takes the next step");

  const zhHorizon = src("zh/infrastructure/08-the-capability-horizon.qmd");
  expect(zhHorizon).toContain("@sec-verification-frontier 会往前再走一步");

  const enVerification = src("en/infrastructure/09-verification-frontier.qmd");
  expect(enVerification).toContain("Part X asks how these constraints");
  expect(enVerification).toContain("Part XI asks how to operate systems");
  expect(enVerification).toContain("operating contracts");

  const zhVerification = src("zh/infrastructure/09-verification-frontier.qmd");
  expect(zhVerification).toContain("第十部分会问");
  expect(zhVerification).toContain("第十一部分会问");
  expect(zhVerification).toContain("运营契约");

  const enPractice = flat("en/practice/index.qmd");
  expect(enPractice).toContain("Part IX exposed");
  expect(enPractice).toContain("Part X showed");
  expect(enPractice).toContain("This part asks");

  const zhPractice = src("zh/practice/index.qmd");
  expect(zhPractice).toContain("第九部分暴露");
  expect(zhPractice).toContain("第十部分则说明");
  expect(zhPractice).toContain("这里开始问");
});
