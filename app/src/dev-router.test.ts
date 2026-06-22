import { expect, test } from "bun:test";
import { loadBook } from "./pipeline/book.ts";
import { resolveDevRoute } from "./dev-router.ts";

// Regression: the dev server served one hardcoded English chapter for every
// URL, so the language switch, prev/next, and sidebar links navigated but the
// content never changed. The router must map each URL to its language + chapter
// the same way the static build lays out _book/.
test("resolveDevRoute maps language, chapter, figure, and apex routes", () => {
  expect(resolveDevRoute("/client.js")).toEqual({ kind: "client" });

  // Apex and unknown paths fall back to the English home.
  expect(resolveDevRoute("/")).toEqual({ kind: "redirect", to: "/en/" });
  expect(resolveDevRoute("/nope")).toEqual({ kind: "redirect", to: "/en/" });

  // Language homes and chapters, both clean and legacy .html forms.
  expect(resolveDevRoute("/en")).toEqual({ kind: "page", lang: "en", href: "index" });
  expect(resolveDevRoute("/zh/")).toEqual({ kind: "page", lang: "zh", href: "index" });
  expect(resolveDevRoute("/zh/foundations/scaling-laws")).toEqual({ kind: "page", lang: "zh", href: "foundations/scaling-laws" });
  expect(resolveDevRoute("/en/foundations/scaling-laws.html")).toEqual({ kind: "page", lang: "en", href: "foundations/scaling-laws" });

  // Figures are language-scoped and resolve at any depth.
  expect(resolveDevRoute("/en/figures/scaling-laws-2.svg")).toEqual({ kind: "figure", lang: "en", file: "scaling-laws-2.svg" });
  expect(resolveDevRoute("/zh/figures/scaling-laws-2.svg")).toEqual({ kind: "figure", lang: "zh", file: "scaling-laws-2.svg" });
  expect(resolveDevRoute("/figures/scaling-laws-2.svg")).toEqual({ kind: "figure", lang: "en", file: "scaling-laws-2.svg" });
});

// The language switch links to the same chapter under the other language
// (chapter.langHref). That target must resolve to a real page in both books,
// for both a deep chapter and the language home.
test("language switch target resolves in both books", () => {
  const repoRoot = new URL("../../", import.meta.url).pathname;
  for (const lang of ["en", "zh"] as const) {
    const book = loadBook(lang, repoRoot);
    for (const href of ["index", "foundations/scaling-laws"]) {
      const route = resolveDevRoute(`/${lang}/${href === "index" ? "" : href}`);
      expect(route).toEqual({ kind: "page", lang, href });
      expect(book.chapters.some((c) => c.href === href), `${lang}/${href} missing`).toBeTrue();
    }
  }
});
