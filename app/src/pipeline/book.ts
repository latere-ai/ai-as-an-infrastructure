// Book model: parse a language's _quarto.yml into the nav tree the reader shell
// needs (parts, numbered chapters, titles, hrefs, prev/next, breadcrumbs).
// Chapter titles come from each .qmd's H1; chapter numbers are assigned in
// order, skipping unnumbered front/back matter (Preface, Summary, References).

import { parse as parseYaml } from "yaml";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Lang, NavChapter, NavPart } from "../types.ts";

export interface BookChapter {
  qmdPath: string; // absolute path to the source .qmd
  href: string; // output path, e.g. "p1-foundations/06-....html"
  title: string;
  num: string; // "" for unnumbered
  partLabel: string; // "" for front/back matter
  unnumbered: boolean;
}

export interface Book {
  lang: Lang;
  title: string;
  langDir: string; // absolute path to en/ or zh/
  parts: { label: string; single: boolean; chapters: BookChapter[] }[];
  chapters: BookChapter[]; // flat, in order
}

// Read a chapter's H1: "# Title {#sec-x .unnumbered}" → { title, unnumbered }.
function readHeading(qmdPath: string): { title: string; unnumbered: boolean } {
  const text = readFileSync(qmdPath, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("# ")) {
      const unnumbered = /\{[^}]*\.unnumbered[^}]*\}/.test(line);
      const title = line
        .replace(/^#\s+/, "")
        .replace(/\s*\{[^}]*\}\s*$/, "") // strip trailing {#id .class}
        .trim();
      return { title, unnumbered };
    }
  }
  return { title: qmdPath, unnumbered: true };
}

function qmdToHref(qmdRel: string): string {
  return qmdRel.replace(/\.qmd$/, ".html");
}

export function loadBook(lang: Lang, repoRoot: string): Book {
  const langDir = join(repoRoot, lang);
  const yml = parseYaml(readFileSync(join(langDir, "_quarto.yml"), "utf8"));
  const bookTitle: string = yml?.book?.title ?? "AI as an Infrastructure";
  const rawChapters: unknown[] = yml?.book?.chapters ?? [];

  const parts: Book["parts"] = [];
  const flat: BookChapter[] = [];
  let frontSingle: BookChapter[] = []; // top-level chapters with no part
  let chapterCounter = 0;

  const makeChapter = (qmdRel: string, partLabel: string): BookChapter => {
    const qmdPath = join(langDir, qmdRel);
    const { title, unnumbered } = readHeading(qmdPath);
    let num = "";
    if (!unnumbered) num = String(++chapterCounter);
    return { qmdPath, href: qmdToHref(qmdRel), title, num, partLabel, unnumbered };
  };

  for (const entry of rawChapters) {
    if (typeof entry === "string") {
      const ch = makeChapter(entry, "");
      frontSingle.push(ch);
      flat.push(ch);
    } else if (entry && typeof entry === "object" && "part" in entry) {
      const part = entry as { part: string; chapters: string[] };
      const chs = (part.chapters ?? []).map((c) => {
        const ch = makeChapter(c, part.part);
        flat.push(ch);
        return ch;
      });
      parts.push({ label: part.part, single: false, chapters: chs });
    }
  }

  // Front/back single chapters become standalone single-rows in nav order:
  // index first, summary/references last. We keep them grouped as singles.
  const front = frontSingle.filter((c) => c.href === "index.html");
  const back = frontSingle.filter((c) => c.href !== "index.html");
  const navParts: Book["parts"] = [
    ...front.map((c) => ({ label: "", single: true, chapters: [c] })),
    ...parts,
    ...back.map((c) => ({ label: "", single: true, chapters: [c] })),
  ];

  return { lang, title: bookTitle, langDir, parts: navParts, chapters: flat };
}

// Build the shell's NavPart[] for a given current chapter href.
export function navFor(book: Book, currentHref: string): NavPart[] {
  return book.parts.map((p, i) => ({
    id: `p${i}`,
    label: p.label,
    single: p.single,
    chapters: p.chapters.map<NavChapter>((c) => ({
      n: c.num,
      label: c.title,
      href: c.href,
      active: c.href === currentHref,
    })),
  }));
}

export function prevNext(book: Book, href: string): { prev: BookChapter | null; next: BookChapter | null } {
  const i = book.chapters.findIndex((c) => c.href === href);
  return {
    prev: i > 0 ? book.chapters[i - 1] : null,
    next: i >= 0 && i < book.chapters.length - 1 ? book.chapters[i + 1] : null,
  };
}
