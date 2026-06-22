// Dev-server (dev.ts) support, kept side-effect-free so tests can import it
// without dev.ts starting a server on import.

// The sample chapter the dev server renders. Chapter hrefs are number-free (the
// 2026 reorg), so this is "<part>/<slug>", not "NN-slug".
export const DEV_CHAPTER_HREF = "foundations/scaling-laws";

// Map a request path to the file under <lang>/figures/ it refers to, or null
// for non-figure paths. A figure's src is chapter-relative ("../figures/x"), so
// once the client router navigates to /en/<part>/<slug> the browser requests
// /en/figures/x, not /figures/x: match "/figures/" at any depth, not just the
// root, so the dev server still finds the file.
export function figureRequestPath(pathname: string): string | null {
  const marker = "/figures/";
  const i = pathname.indexOf(marker);
  if (i === -1) return null;
  return pathname.slice(i + marker.length);
}
