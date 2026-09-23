import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import YAML from "yaml";

function src(p: string) {
  return readFileSync(new URL("../../" + p, import.meta.url), "utf8");
}

interface Part {
  numeral: string; // "IV" in en, "四" in zh
  dir: string; // "reasoning"
  chapters: string[];
}

// Parts in manifest order, with the numeral from the part label ("Part IV:
// ..." or "第四部分 · ...") and the directory its pages live in.
function parts(lang: "en" | "zh"): Part[] {
  const manifest = YAML.parse(src(`${lang}/book.yml`)) as {
    book: { chapters: Array<string | { part?: string; chapters?: string[] }> };
  };
  return manifest.book.chapters
    .filter((item): item is { part: string; chapters: string[] } => typeof item !== "string" && !!item.part)
    .map((item) => ({
      numeral: (lang === "en" ? item.part.match(/^Part (\w+):/) : item.part.match(/^第(\S+)部分/))![1],
      dir: item.chapters[0].split("/")[0],
      chapters: item.chapters,
    }));
}

function paragraphs(text: string) {
  return text
    .replace(/^# .+\n+/, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Part numerals a page names, in the page's language.
function partMentions(lang: "en" | "zh", text: string): string[] {
  const pattern = lang === "en" ? /\bPart ([0IVXLC]+)\b/g : /第([零一二三四五六七八九十]+)部分/g;
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

test("every part closes with a standalone narrative summary page", () => {
  for (const lang of ["en", "zh"] as const) {
    for (const part of parts(lang)) {
      const summary = `${part.dir}/summary.qmd`;
      expect(part.chapters.at(-1), `${lang}: ${summary} closes its part`).toBe(summary);

      const text = src(`${lang}/${summary}`);
      expect(text, `${lang}/${summary}: title anchor`).toMatch(
        new RegExp(`^# .+ \\{#part-${part.dir}-summary \\.unnumbered\\}$`, "m"),
      );
      expect(text, `${lang}/${summary}: no subheadings`).not.toMatch(/^#{2,} /m);
      expect(text, `${lang}/${summary}: no bullet lists`).not.toMatch(/^\s*[-*+] /m);
      expect(paragraphs(text).length, `${lang}/${summary}: narrative prose`).toBeGreaterThanOrEqual(2);
    }
  }
});

// A summary hands off by naming the next part. Naming only parts that exist
// lets every summary but the last hand off, and keeps the last one closed.
test("part summaries name only parts that exist in the manifest", () => {
  for (const lang of ["en", "zh"] as const) {
    const all = parts(lang);
    const numerals = all.map((part) => part.numeral);
    for (const part of all) {
      for (const numeral of partMentions(lang, src(`${lang}/${part.dir}/summary.qmd`))) {
        expect(numerals, `${lang}/${part.dir}/summary.qmd names part ${numeral}`).toContain(numeral);
      }
    }
  }
});
