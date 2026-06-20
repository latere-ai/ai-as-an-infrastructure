// Per-chapter search documents written to _book/<lang>/search.json. The sidebar
// search box loads this index and does a simple client-side scan; kept minimal
// and dependency-free (the prior Quarto search.json was ~1MB; this is leaner).

import type { ChapterData } from "../types.ts";

export interface SearchDoc {
  href: string;
  num: string;
  title: string;
  headings: string[];
  text: string; // de-tagged body, truncated
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchDoc(ch: ChapterData, href: string): SearchDoc {
  return {
    // store the bare lang-root-relative href; SearchBox applies the page prefix
    href,
    num: ch.chapterNum,
    title: ch.title,
    headings: ch.headings.map((h) => h.text),
    text: stripTags(ch.contentHtml).slice(0, 4000),
  };
}
