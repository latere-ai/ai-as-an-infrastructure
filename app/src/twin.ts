// The Markdown twin of a page: the same chapter as clean Markdown, written
// beside the page's HTML (_book/<lang>/<path>.md) for agents and tools that
// read text rather than render a reader. YAML front matter names the page, its
// canonical and other-language URLs, its part, its review date and the book's
// license; the body is the compiled chapter converted from its rendered HTML,
// so cross-references, citations and glossary links read as they do on the
// page. The home page's twin adds the book's title and contents above the
// Preface, the way the landing page does.

import { stringify } from "yaml";
import type { Book, BookChapter } from "./pipeline/book.ts";
import { reviewedIso } from "./pipeline/compile.ts";
import { htmlToMarkdown, markdownText } from "./pipeline/html-markdown.ts";
import { BASE, LICENSE, LICENSE_URL, pageUrl } from "./site.ts";
import type { ChapterData, Lang, NavPart } from "./types.ts";

export interface TwinInput {
  data: ChapterData;
  section: string; // the part from the manifest, "" for front and back matter
  lastmod: string; // review date, YYYY-MM-DD, "" when the page has none
  alternates: Lang[]; // other languages the page exists in
  book: { title: string; subtitle: string };
}

// A compiled page with the manifest facts its twin needs. `otherHrefs` are the
// chapter hrefs of the other language's manifest, so the twin names the other
// language's page only when it exists.
export function twinInput(book: Book, ch: BookChapter, data: ChapterData, otherHrefs: Set<string>): TwinInput {
  const other: Lang = book.lang === "en" ? "zh" : "en";
  return {
    data,
    section: ch.partLabel,
    lastmod: reviewedIso(ch.srcRel),
    alternates: otherHrefs.has(ch.href) ? [other] : [],
    book: { title: book.title, subtitle: book.subtitle },
  };
}

const CONTENTS: Record<Lang, string> = { en: "Contents", zh: "目录" };

// The page's title as a listing names it: the book's title for the home page,
// whose own chapter title is the Preface's.
export function twinTitle(input: TwinInput): string {
  return input.data.path === "" ? input.book.title : input.data.title;
}

// The book's contents as a nested list of absolute links, from the reader's
// navigation tree. The home page itself is left out.
function contents(toc: NavPart[], lang: Lang): string {
  const home = `/${lang}/`;
  const link = (label: string, href: string) => `[${markdownText(label)}](${BASE}${href})`;
  const lines: string[] = [];
  for (const part of toc) {
    if (part.single) {
      for (const c of part.chapters) if (c.href !== home) lines.push(`- ${link(c.label, c.href)}`);
      continue;
    }
    lines.push(`- ${part.href ? link(part.label, part.href) : markdownText(part.label)}`);
    for (const c of part.chapters) lines.push(`  - ${link(c.n ? `${c.n}. ${c.label}` : c.label, c.href)}`);
  }
  return lines.join("\n");
}

export function markdownTwin(input: TwinInput): string {
  const { data } = input;
  const isHome = data.path === "";
  const meta: Record<string, unknown> = {
    title: twinTitle(input),
    lang: data.lang,
    url: pageUrl(data.lang, data.path),
  };
  if (input.section) meta.part = input.section;
  if (data.chapterNum) meta.chapter = Number(data.chapterNum);
  if (input.lastmod) meta.updated = input.lastmod;
  meta.author = data.author;
  meta.license = LICENSE;
  meta.license_url = LICENSE_URL;
  if (input.alternates.length) meta.alternate = Object.fromEntries(input.alternates.map((l) => [l, pageUrl(l, data.path)]));

  const body = htmlToMarkdown(data.contentHtml, {
    pageUrl: pageUrl(data.lang, data.path),
    origin: BASE,
    lang: data.lang,
    headingShift: isHome ? 1 : 0,
  });
  const parts = isHome
    ? [
      `# ${markdownText(input.book.title)}`,
      ...(input.book.subtitle ? [markdownText(input.book.subtitle)] : []),
      `## ${CONTENTS[data.lang]}`,
      contents(data.toc, data.lang),
      `## ${markdownText(data.title)}`,
      body,
    ]
    : [`# ${markdownText(data.title)}`, body];
  return `---\n${stringify(meta, { lineWidth: 0 })}---\n\n${parts.map((p) => p.trim()).join("\n\n")}\n`;
}
