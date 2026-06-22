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
