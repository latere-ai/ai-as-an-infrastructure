// Migration safety net: any chapter whose "Further reading" is driven by
// refs/ (its .qmd uses the ::: {#further-reading} marker) must render exactly
// the set of works it referenced when the section was hand-written. The
// baseline lives in fr-snapshot.json (captured once, pre-migration, via
// app/scripts/fr-snapshot.ts). As chapters are converted, each is added to the
// checked set automatically; un-converted chapters are skipped (still prose).

import { test, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { furtherReadingEntries } from "../src/pipeline/further-reading.ts";
import { normalizeUrl } from "../scripts/fr-snapshot.ts";

const repoRoot = join(import.meta.dir, "..", "..");
const refsDir = join(repoRoot, "refs");
const snapshot: Record<string, string[]> = JSON.parse(
  readFileSync(join(import.meta.dir, "fr-snapshot.json"), "utf8"),
);

// Chapters already converted to the refs/-driven marker (en side is canonical).
function convertedSlugs(): string[] {
  const out: string[] = [];
  const enRoot = join(repoRoot, "en");
  for (const part of readdirSync(enRoot)) {
    let entries: string[];
    try { entries = readdirSync(join(enRoot, part)); } catch { continue; }
    for (const f of entries) {
      if (!/^\d+-.*\.qmd$/.test(f)) continue;
      const src = readFileSync(join(enRoot, part, f), "utf8");
      // Key by the bare slug (strip the authoring-order "NN-" prefix): that is
      // how the build derives the refs/<slug>.bib name from the de-numbered href.
      if (src.includes("{#further-reading}")) out.push(basename(f, ".qmd").replace(/^\d+-/, ""));
    }
  }
  return out.sort();
}

const slugs = convertedSlugs();

test("at least one chapter is converted", () => {
  expect(slugs.length).toBeGreaterThan(0);
});

for (const slug of slugs) {
  test(`${slug}: refs/ covers the same works as the original Further reading`, () => {
    expect(existsSync(join(refsDir, `${slug}.bib`))).toBe(true);
    const rendered = new Set(
      furtherReadingEntries(refsDir, slug)
        .filter((e) => e.inFurther)
        .map((e) => normalizeUrl(e.url ?? ""))
        .filter(Boolean), // a no-URL work (book) can't be URL-tracked
    );
    const baseline = new Set((snapshot[slug] ?? []).map(normalizeUrl).filter(Boolean));
    const missing = [...baseline].filter((u) => !rendered.has(u));
    const extra = [...rendered].filter((u) => !baseline.has(u));
    expect({ slug, missing, extra }).toEqual({ slug, missing: [], extra: [] });
  });
}
