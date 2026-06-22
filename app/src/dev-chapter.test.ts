import { expect, test } from "bun:test";
import { loadBook } from "./pipeline/book.ts";
import { DEV_CHAPTER_HREF, figureRequestPath } from "./dev-chapter.ts";

// Regression: the dev server (dev.ts) renders one hardcoded sample chapter. The
// 2026 number-free reorg renamed every chapter href, which silently left the
// dev server pointing at a chapter that no longer exists ("03-scaling-laws"),
// so `make dev` crashed in compileChapter with `undefined.qmdPath`. Pin the
// invariant: the configured sample chapter must resolve in the en book.
test("dev server sample chapter resolves to a real en chapter", () => {
  const repoRoot = new URL("../../", import.meta.url).pathname;
  const book = loadBook("en", repoRoot);
  const found = book.chapters.find((c) => c.href === DEV_CHAPTER_HREF);
  expect(found, `DEV_CHAPTER_HREF "${DEV_CHAPTER_HREF}" not found in en book.yml`).toBeDefined();
  expect(found!.qmdPath).toBeString();
});

// Regression: figures broke in `make dev` because the handler only matched paths
// that started with "/figures/". The client router navigates to /en/<part>/<slug>,
// where a chapter-relative "../figures/x" resolves to /en/figures/x. The handler
// must find the file at any depth, and ignore non-figure paths.
test("figureRequestPath resolves figure URLs at any depth", () => {
  expect(figureRequestPath("/figures/scaling-laws-2.svg")).toBe("scaling-laws-2.svg");
  expect(figureRequestPath("/en/figures/scaling-laws-2.svg")).toBe("scaling-laws-2.svg");
  expect(figureRequestPath("/en/foundations/figures/x.svg")).toBe("x.svg");
  expect(figureRequestPath("/en/foundations/scaling-laws")).toBeNull();
  expect(figureRequestPath("/client.js")).toBeNull();
  expect(figureRequestPath("/")).toBeNull();
});
