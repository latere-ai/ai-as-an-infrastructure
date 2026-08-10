import { expect, test } from "bun:test";
import { parse as parseBib } from "@retorquere/bibtex-parser";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { furtherReadingEntries } from "./pipeline/further-reading.ts";

const repoRoot = join(import.meta.dir, "../..");
const refsDir = join(repoRoot, "refs");
const noteOverlay = readFileSync(join(refsDir, "00-further-reading-notes-zh.bib"), "utf8");
const chapterSlugs = readdirSync(refsDir)
  .filter((name) => name.endsWith(".bib") && !name.startsWith("00-"))
  .map((name) => name.slice(0, -4));

test("the Chinese Further Reading gloss overlay contains glosses only", () => {
  const overlay = parseBib(noteOverlay, { errorHandler: () => {} });
  expect(overlay.entries).toHaveLength(180);
  expect(new Set(overlay.entries.map((entry: { key: string }) => entry.key)).size).toBe(overlay.entries.length);
  for (const entry of overlay.entries) {
    const fields = entry.fields as Record<string, unknown>;
    expect(Object.keys(fields), entry.key).toEqual(["note-zh"]);
    expect(String(fields["note-zh"]).trim().length, entry.key).toBeGreaterThan(0);
    expect(String(fields["note-zh"]), entry.key).not.toContain("—");
  }
});

test("every Chinese Further Reading gloss is explicitly localized", () => {
  const bibliography = loadBibliographyDir(refsDir);
  const missing: string[] = [];
  for (const slug of chapterSlugs) {
    for (const entry of furtherReadingEntries(refsDir, slug).filter((item) => item.inFurther)) {
      const translated = entry.noteZh ?? bibliography.entries.get(entry.key)?.noteZh;
      if (entry.note?.trim() && !translated?.trim()) missing.push(`${slug}:${entry.key}`);
    }
  }
  expect(missing.sort()).toEqual([]);
});

test("every Chinese Further Reading entry has a Chinese explanation", () => {
  const bibliography = loadBibliographyDir(refsDir);
  const missing: string[] = [];
  for (const slug of chapterSlugs) {
    for (const entry of furtherReadingEntries(refsDir, slug).filter((item) => item.inFurther)) {
      if (!bibliography.entries.get(entry.key)?.tldrZh?.trim()) missing.push(`${slug}:${entry.key}`);
    }
  }
  expect(missing.sort()).toEqual([]);
});
