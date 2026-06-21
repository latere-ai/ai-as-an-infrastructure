// Glossary rendering: first use in a chapter expands (term + English in parens),
// later uses show the short form; both link to the glossary page. zh always
// glosses with the English original; en only when an abbreviation differs.

import { test, expect } from "bun:test";
import { renderGloss, renderGlossaryPage, type GlossEntry } from "./glossary.ts";

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
  const html = renderGlossaryPage(g, new Set(["moe"]), "zh");
  expect(html).toContain('id="gls-moe"');
  expect(html).toContain("混合专家");
  expect(html).not.toContain("奖励欺骗"); // not in the used set
});
