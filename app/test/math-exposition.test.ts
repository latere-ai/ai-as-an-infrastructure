import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "..", "..");

type Lang = "en" | "zh";

function qmdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...qmdFiles(path));
    else if (entry.name.endsWith(".qmd")) out.push(path);
  }
  return out;
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\n[\s\S]*?\n---\n/, "");
}

function stripCodeFences(source: string): string {
  return source.replace(/```[\s\S]*?```/g, "");
}

function paragraphs(source: string): Array<{ text: string; line: number }> {
  const clean = stripCodeFences(stripFrontmatter(source));
  const out: Array<{ text: string; line: number }> = [];
  let offset = 0;
  for (const text of clean.split(/\n\s*\n/g)) {
    const idx = clean.indexOf(text, offset);
    const line = clean.slice(0, idx).split("\n").length;
    offset = idx + text.length;
    out.push({ text, line });
  }
  return out;
}

function isTableOrFigure(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("|") || trimmed.startsWith("![") || trimmed.startsWith(":::");
}

function inlineMath(text: string): string[] {
  const out: string[] = [];
  const re = /(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) out.push(match[1].trim());
  return out;
}

function isPriceOrPlainNumber(math: string): boolean {
  return /^[\d.,]+(?:\s*(?:K|M|B|T|%|percent|GB|MB|ms|s|x))?$/i.test(math);
}

function isFormulaLike(math: string): boolean {
  if (isPriceOrPlainNumber(math)) return false;
  return (
    /[=<>]/.test(math) ||
    /\\(?:sum|prod|frac|arg|max|min|operatorname|mathrm|mathbb|mathcal|text|Pr|log|exp)/.test(math) ||
    /[_^]/.test(math) ||
    /\\[a-zA-Z]+/.test(math)
  );
}

function needsExposition(text: string): boolean {
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true;
  const spans = inlineMath(text).filter(isFormulaLike);
  return spans.length >= 2 || spans.some((span) => /[=<>]|\\(?:sum|prod|frac|arg)/.test(span));
}

const expositionMarkers: Record<Lang, RegExp> = {
  en: /\b(where|here|denotes?|represents?|means?|terms?|intuition|numerator|denominator|measures?|read as|in words|formula|symbol|factor|respectively|each)\b/i,
  zh: /(其中|这里|式中|表示|代表|记作|读作|读一读|含义|直觉|直观|分母|分子|项|衡量|可以读成|换句话说|也就是说|这个式子|这条式子|这个量|这些符号|每一项|分别是|指的是|设\s*\$)/,
};

function unexplainedMathParagraphs(lang: Lang): string[] {
  const root = join(repoRoot, lang);
  const offenders: string[] = [];

  for (const file of qmdFiles(root)) {
    const source = readFileSync(file, "utf8");
    const ps = paragraphs(source);

    ps.forEach((paragraph, index) => {
      if (isTableOrFigure(paragraph.text) || !needsExposition(paragraph.text)) return;

      const context = [
        ps[index - 1]?.text ?? "",
        paragraph.text,
        ps[index + 1]?.text ?? "",
      ].join("\n");

      if (!expositionMarkers[lang].test(context)) {
        offenders.push(`${relative(repoRoot, file)}:${paragraph.line}`);
      }
    });
  }

  return offenders;
}

test("formula-bearing prose explains symbols and intuition near the math", () => {
  expect([...unexplainedMathParagraphs("en"), ...unexplainedMathParagraphs("zh")]).toEqual([]);
});
