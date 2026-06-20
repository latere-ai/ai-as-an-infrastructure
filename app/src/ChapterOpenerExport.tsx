// A simple, layout-agnostic chapter opener for the PDF/EPUB export: eyebrow +
// numbered title. (The reader's interactive ChapterOpener has layout variants;
// print wants one plain heading.)

import type { ChapterData } from "./types.ts";

export default function ChapterOpenerExport({ chapter }: { chapter: ChapterData }) {
  return (
    <header style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
        {chapter.eyebrow}
      </div>
      <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "2rem", lineHeight: 1.15, color: "var(--fg-1)" }}>
        {chapter.chapterNum ? `${chapter.chapterNum}. ` : ""}{chapter.title}
      </h1>
    </header>
  );
}
