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

test("the expanded ecosystem part is reflected in top-level book surfaces", () => {
  expect(src("README.md")).toContain("market structure");
  expect(src("README.md")).toContain("adoption and productivity");
  expect(src("README.md")).toContain("data rights");
  expect(src("CONTENT-GAPS.md")).toContain("- [x] **Ecosystem and economics depth**");
});
