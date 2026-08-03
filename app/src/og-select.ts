// Which share cards a run of `bun run og` should draw. Cards are committed
// source, so redrawing all of them to add one page would rewrite a hundred
// unchanged PNGs: any arguments name the hrefs to redraw, and no arguments
// means the whole book.

export interface CardTarget { href: string }

export function selectCards<T extends CardTarget>(chapters: T[], args: string[]): { wanted: T[]; unknown: string[] } {
  const only = new Set(args);
  if (!only.size) return { wanted: chapters, unknown: [] };
  const known = new Set(chapters.map((ch) => ch.href));
  return {
    wanted: chapters.filter((ch) => only.has(ch.href)),
    unknown: [...only].filter((href) => !known.has(href)),
  };
}
