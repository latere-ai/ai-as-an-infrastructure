// On-demand generator for English social-share cards (Open Graph / Twitter
// "summary_large_image"). One 1200x630 PNG per chapter, English-only: a shared
// zh link unfurls the same English card, so en and zh at one path share an image.
// Output is vendored as source under app/static/og/<href>.png (build.ts copies
// it into _book/og/ on every build) and referenced absolutely from every page
// head (see html.ts / site.ts). These are the one genuinely expensive artifact:
// cards render the template in og-card.ts via headless Chrome (real Instrument
// Serif + Inter from Google Fonts), so this is slow and Chrome-dependent. It
// runs on demand, NOT in the per-commit or container build. Re-run `make og`
// after adding or retitling chapters; commit the regenerated PNGs.
//
// CHROME names the browser binary; a headless shell build is enough.

import { loadBook, type Book } from "./pipeline/book.ts";
import { selectCards } from "./og-select.ts";
import { cardHtml, chapterCard, type Card } from "./og-card.ts";
import { renderCover } from "./landing/cover.ts";
import { coverDataFor } from "./landing/landing.ts";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { AUTHOR, OG_W, OG_H } from "./site.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;
const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

// The card one page of `book` shares: the home page shows the book, every
// other page its part, number and title.
export function cardOf(book: Book, href: string, author: string): Card {
  if (href === "index") return { kind: "home", title: book.title, subtitle: book.subtitle, author };
  const ch = book.chapters.find((c) => c.href === href);
  if (!ch) throw new Error(`no such chapter href: ${href}`);
  return chapterCard(ch, book.lang, book.title, author);
}

// Draws one card of `book` to a PNG at `outPath`, staging its HTML in `tmpDir`.
export function drawCard(chrome: string, book: Book, card: Card, tmpDir: string, name: string, outPath: string): boolean {
  const htmlPath = join(tmpDir, name + ".html");
  writeFileSync(htmlPath, cardHtml(card, book.lang, css, renderCover(book.lang, coverDataFor(book, repoRoot))));
  mkdirSync(dirname(outPath), { recursive: true });
  return screenshot(chrome, htmlPath, outPath);
}

function screenshot(chrome: string, htmlPath: string, outPath: string): boolean {
  const r = spawnSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${OG_W},${OG_H}`, "--virtual-time-budget=8000",
    `--screenshot=${outPath}`, `file://${htmlPath}`,
  ], { encoding: "utf8" });
  const ok = r.status === 0 && existsSync(outPath);
  if (!ok && process.env.OG_DEBUG) {
    const detail = [r.stderr, r.stdout].filter(Boolean).join("\n").trim();
    console.error(`chrome failed for ${htmlPath}: status=${r.status} signal=${r.signal}${detail ? `\n${detail}` : ""}`);
  }
  return ok;
}

if (import.meta.main) {
  const chrome = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const ogRoot = join(repoRoot, "app", "static", "og");
  const tmpDir = join(repoRoot, "app", "static", ".og-tmp");
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(ogRoot, { recursive: true });

  const book = loadBook("en", repoRoot);
  const { wanted, unknown } = selectCards(book.chapters, process.argv.slice(2));
  if (unknown.length) { console.error(`no such chapter href: ${unknown.join(", ")}`); process.exit(1); }
  let made = 0;
  const failed: string[] = [];
  for (const ch of wanted) {
    const card = cardOf(book, ch.href, AUTHOR);
    if (drawCard(chrome, book, card, tmpDir, ch.href.replace(/\//g, "__"), join(ogRoot, ch.href + ".png"))) made++;
    else failed.push(ch.href);
  }
  rmSync(tmpDir, { recursive: true, force: true });

  console.log(`generated ${made} share card(s) into ${ogRoot}`);
  if (failed.length) { console.error(`  ✗ failed: ${failed.join(", ")}`); process.exit(1); }
}
