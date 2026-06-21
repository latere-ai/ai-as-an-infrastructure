// Glossary rendering: first use in a chapter expands (term + English in parens),
// later uses show the short form; both link to the glossary page. zh always
// glosses with the English original; en only when an abbreviation differs.

import { test, expect } from "bun:test";
import { renderGloss, renderGlossaryPage, type GlossEntry, type GlossFirstUseMap } from "./glossary.ts";
import { renderMarkdown } from "./markdown.ts";

const moe: GlossEntry = { key: "moe", en: "mixture-of-experts", zh: "混合专家", abbr: "MoE" };
const rh: GlossEntry = { key: "reward-hacking", en: "reward hacking", zh: "奖励欺骗" };

test("zh first use expands to 中文（English）, later use is the abbr", () => {
  expect(renderGloss(moe, "zh", true, "../")).toContain("混合专家（MoE）");
  expect(renderGloss(moe, "zh", true, "../")).toContain('href="../glossary#gls-moe"');
  expect(renderGloss(moe, "zh", false, "../")).toContain(">MoE<");
  expect(renderGloss(moe, "zh", false, "../")).not.toContain("（");
});

test("en first use expands to term (ABBR), later use is the abbr", () => {
  expect(renderGloss(moe, "en", true, "")).toContain("mixture-of-experts (MoE)");
  expect(renderGloss(moe, "en", false, "")).toContain(">MoE<");
});

test("a term with no abbr: zh glosses with full English, en shows the term only", () => {
  expect(renderGloss(rh, "zh", true, "../")).toContain("奖励欺骗（reward hacking）");
  expect(renderGloss(rh, "zh", false, "../")).toContain(">奖励欺骗<"); // no abbr → full term
  expect(renderGloss(rh, "en", true, "")).toContain(">reward hacking<");
  expect(renderGloss(rh, "en", true, "")).not.toContain("("); // no parenthetical in en
});

test("glossary page lists only used terms, anchored by key", () => {
  const g = new Map([["moe", moe], ["reward-hacking", rh]]);
  const firstUses: GlossFirstUseMap = new Map([["moe", {
    key: "moe",
    href: "foundations/transformer-architecture",
    title: "Transformer 架构及其变体",
    chapterNum: "7",
    sentence: "混合专家（MoE） routes each token to a small subset of experts.",
  }]]);
  const html = renderGlossaryPage(g, new Set(["moe"]), firstUses, "zh");
  expect(html).toContain('<ul class="rdr-gls-list">');
  expect(html).toContain('<li class="rdr-gls-entry" id="gls-moe">');
  expect(html).toContain('id="gls-moe"');
  expect(html).toContain("混合专家");
  expect(html).toContain("首次出现：");
  expect(html).toContain('href="foundations/transformer-architecture"');
  expect(html).toContain("第 7 章 · Transformer 架构及其变体");
  expect(html).toContain('<p class="rdr-gls-explain">混合专家（MoE） routes each token to a small subset of experts.</p>');
  expect(html).not.toContain("奖励欺骗"); // not in the used set
});

test("rendering records the first book occurrence sentence and does not overwrite it", () => {
  const glossary = new Map([["moe", moe]]);
  const used = new Set<string>();
  const firstUses: GlossFirstUseMap = new Map();
  const common = {
    bib: { entries: new Map(), cited: new Set<string>() },
    xref: new Map([["sec-next", { kind: "sec" as const, label: "Chapter 2", href: "foundations/two#sec-next" }]]),
    prefix: "",
    graphviz: {} as any,
    lang: "en" as const,
    glossary,
    glossaryUsed: used,
    glossaryFirstUses: firstUses,
  };

  renderMarkdown("# One\n\nSetup sentence. Hubinger et al. trained **@gls-moe**: models route best-of-N near @sec-next. This later sentence should stay out.", {
    ...common,
    currentHref: "foundations/one",
    chapterTitle: "One",
    chapterNum: "1",
    glossarySeen: new Set(),
  });
  renderMarkdown("# Two\n\n@gls-moe appears again in a later chapter.", {
    ...common,
    currentHref: "foundations/two",
    chapterTitle: "Two",
    chapterNum: "2",
    glossarySeen: new Set(),
  });

  expect(used.has("moe")).toBe(true);
  expect(firstUses.get("moe")).toEqual({
    key: "moe",
    href: "foundations/one",
    title: "One",
    chapterNum: "1",
    sentence: "Hubinger et al. trained mixture-of-experts (MoE): models route best-of-N near Chapter 2.",
  });
});

test("zh first occurrence sentence starts after full-width punctuation without whitespace", () => {
  const glossary = new Map([["moe", moe]]);
  const firstUses: GlossFirstUseMap = new Map();
  renderMarkdown("# 一\n\n前一句。这里是**@gls-moe**。后一句。", {
    bib: { entries: new Map(), cited: new Set<string>() },
    xref: new Map(),
    currentHref: "foundations/one",
    chapterTitle: "一",
    chapterNum: "1",
    prefix: "",
    graphviz: {} as any,
    lang: "zh",
    glossary,
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: firstUses,
  });

  expect(firstUses.get("moe")?.sentence).toBe("这里是混合专家（MoE）。");
});
