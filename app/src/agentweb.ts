// The page index for the site's agent-facing endpoints, written to
// _book/agentweb.json. The server's agentweb package reads it to answer
// robots.txt, sitemap.xml, llms.txt and llms-full.txt, and to serve a page's
// Markdown twin to a request that asks for text/markdown. The field names are
// the contract that package decodes: paths are origin-relative, an absent
// value is omitted rather than written empty, and pages come in reading
// order, English first. `editions` is the book's own addition, which the
// package ignores and the server reads so each language's llms.txt is
// written in that language: its title, summary, and section headings.

import { BASE, BOOK_SUMMARY, MATTER_SECTION, SITE_NAME, markdownPath, pagePath } from "./site.ts";
import { twinTitle, type TwinInput } from "./twin.ts";
import type { Lang } from "./types.ts";

export interface AgentwebPage {
  path: string; // origin-relative page path, "/en/" for the home page
  lang: Lang;
  title: string;
  description?: string;
  section?: string; // the part the page belongs to
  lastmod?: string; // YYYY-MM-DD
  markdown: string; // origin-relative path of the page's Markdown twin
  alternates?: Partial<Record<Lang, string>>; // the same page in other languages, origin-relative
}

// One language edition of the book: its title as that edition's manifest
// names it, the summary quoted under the title of its llms.txt, and the
// heading llms.txt lists the pages outside any part under.
export interface AgentwebEdition {
  title: string;
  summary: string;
  defaultSection: string;
}

export interface AgentwebIndex {
  origin: string;
  title: string;
  summary: string;
  editions: Record<Lang, AgentwebEdition>;
  pages: AgentwebPage[];
}

const LANG_ORDER: Record<Lang, number> = { en: 0, zh: 1 };

// Fields are written in the contract's order; an optional field without a
// value is left out.
export function agentwebPage(input: TwinInput): AgentwebPage {
  const { data } = input;
  return {
    path: pagePath(data.lang, data.path),
    lang: data.lang,
    title: twinTitle(input),
    ...(data.description ? { description: data.description } : {}),
    ...(input.section ? { section: input.section } : {}),
    ...(input.lastmod ? { lastmod: input.lastmod } : {}),
    markdown: markdownPath(data.lang, data.path),
    ...(input.alternates.length ? { alternates: Object.fromEntries(input.alternates.map((l) => [l, pagePath(l, data.path)])) } : {}),
  };
}

// `pages` in reading order per language; the sort is stable, so each
// language keeps its order and English comes first. `titles` are the book's
// title in each language, from the manifests.
export function agentwebIndex(pages: AgentwebPage[], titles: Record<Lang, string>): AgentwebIndex {
  return {
    origin: BASE,
    title: SITE_NAME,
    summary: BOOK_SUMMARY.en,
    editions: {
      en: { title: titles.en, summary: BOOK_SUMMARY.en, defaultSection: MATTER_SECTION.en },
      zh: { title: titles.zh, summary: BOOK_SUMMARY.zh, defaultSection: MATTER_SECTION.zh },
    },
    pages: [...pages].sort((a, b) => LANG_ORDER[a.lang] - LANG_ORDER[b.lang]),
  };
}
