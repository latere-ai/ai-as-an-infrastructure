// Per-section search documents written to _book/<lang>/search.json. Each chapter
// is split at its <h2>/<h3 id="..."> boundaries so a match can deep-link to the
// section (href#anchor) and the sidebar search box can show a snippet. The box
// loads this index lazily and does a dependency-free client-side scan.

import type { ChapterData } from "../types.ts";

export interface SearchDoc {
  href: string; // chapter href (lang-root-relative, extensionless)
  anchor: string; // heading id to jump to; "" for the chapter intro
  num: string; // chapter number ("" for unnumbered)
  title: string; // chapter title
  heading: string; // section heading text; "" for the chapter intro
  text: string; // de-tagged section body
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

// h2/h3 with an id are the section anchors the reader already renders. We split
// on heading boundaries of either level; each section runs until the next
// heading of any level (so an h2 intro stops at its first h3, which is fine for
// deep-linking to the nearest heading).
const HEADING_RE = /<h([23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;

export interface Section {
  anchor: string;
  heading: string;
  text: string;
}

export function splitSections(html: string): Section[] {
  const bounds: { id: string; heading: string; start: number; bodyStart: number }[] = [];
  for (const m of html.matchAll(HEADING_RE)) {
    bounds.push({
      id: m[2],
      heading: stripTags(m[3]),
      start: m.index!,
      bodyStart: m.index! + m[0].length,
    });
  }

  const sections: Section[] = [];
  const introEnd = bounds.length ? bounds[0].start : html.length;
  const introText = stripTags(html.slice(0, introEnd));
  if (introText) sections.push({ anchor: "", heading: "", text: introText });

  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    const end = i + 1 < bounds.length ? bounds[i + 1].start : html.length;
    const text = stripTags(html.slice(b.bodyStart, end));
    sections.push({ anchor: b.id, heading: b.heading, text });
  }
  return sections;
}

export function buildSearchDocs(ch: ChapterData, href: string): SearchDoc[] {
  return splitSections(ch.contentHtml).map((s) => ({
    href,
    anchor: s.anchor,
    num: ch.chapterNum,
    title: ch.title,
    heading: s.heading,
    text: s.text,
  }));
}
