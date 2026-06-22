// Dev-server (dev.ts) URL routing, kept side-effect-free so tests can import it
// without dev.ts starting a server on import. The routes mirror the static
// build's output layout (/{lang}/{href}, /{lang}/figures/...), so in-page
// navigation, prev/next, and the language switch resolve exactly as they do on
// the deployed site instead of all collapsing onto one hardcoded chapter.
import type { Lang } from "./types.ts";

export type DevRoute =
  | { kind: "client" } // the hydration bundle (/client.js)
  | { kind: "figure"; lang: Lang; file: string } // a figure under <lang>/figures/
  | { kind: "static"; file: string } // a root asset from app/static/ (e.g. favicon.svg)
  | { kind: "search"; lang: Lang } // the per-language search index (/{lang}/search.json)
  | { kind: "redirect"; to: string } // apex / unknown -> a language home
  | { kind: "page"; lang: Lang; href: string }; // a chapter ("index" = lang home)

// Root assets the static build copies to _book/ (build.ts). The dev server must
// serve these directly so the favicon resolves as on the deployed site, instead
// of falling through to the apex redirect and returning HTML.
const STATIC_ROOT_ASSETS = new Set(["favicon.svg"]);

export function resolveDevRoute(pathname: string): DevRoute {
  if (pathname === "/client.js") return { kind: "client" };

  const asset = pathname.slice(1);
  if (STATIC_ROOT_ASSETS.has(asset)) return { kind: "static", file: asset };

  const m = pathname.match(/^\/(en|zh)(?:\/(.*))?$/);
  if (!m) {
    // No language prefix: a figure referenced from the apex resolves to en;
    // anything else goes to the English home.
    const fig = pathname.match(/\/figures\/(.+)$/);
    if (fig) return { kind: "figure", lang: "en", file: fig[1] };
    return { kind: "redirect", to: "/en/" };
  }

  const lang = m[1] as Lang;
  const rest = m[2] ?? "";

  // The search modal fetches "<prefix>search.json", which resolves to
  // /{lang}/search.json. The static build writes this file; the dev server has
  // to generate it on demand or search silently returns nothing.
  if (rest === "search.json") return { kind: "search", lang };

  // A chapter-relative "../figures/x" resolves to /{lang}/figures/x (or deeper),
  // so match "figures/" anywhere in the remainder.
  const fig = rest.match(/(?:^|\/)figures\/(.+)$/);
  if (fig) return { kind: "figure", lang, file: fig[1] };

  // "/en" or "/en/" -> the language home (the "index" chapter); strip a trailing
  // slash and the legacy .html so clean and .html URLs both resolve.
  const href = rest.replace(/\/$/, "").replace(/\.html$/, "");
  return { kind: "page", lang, href: href === "" ? "index" : href };
}
