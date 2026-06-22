// Dev-server (dev.ts) URL routing, kept side-effect-free so tests can import it
// without dev.ts starting a server on import. The routes mirror the static
// build's output layout (/{lang}/{href}, /{lang}/figures/...), so in-page
// navigation, prev/next, and the language switch resolve exactly as they do on
// the deployed site instead of all collapsing onto one hardcoded chapter.
import type { Lang } from "./types.ts";

export type DevRoute =
  | { kind: "client" } // the hydration bundle (/client.js)
  | { kind: "figure"; lang: Lang; file: string } // a figure under <lang>/figures/
  | { kind: "redirect"; to: string } // apex / unknown -> a language home
  | { kind: "page"; lang: Lang; href: string }; // a chapter ("index" = lang home)

export function resolveDevRoute(pathname: string): DevRoute {
  if (pathname === "/client.js") return { kind: "client" };

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

  // A chapter-relative "../figures/x" resolves to /{lang}/figures/x (or deeper),
  // so match "figures/" anywhere in the remainder.
  const fig = rest.match(/(?:^|\/)figures\/(.+)$/);
  if (fig) return { kind: "figure", lang, file: fig[1] };

  // "/en" or "/en/" -> the language home (the "index" chapter); strip a trailing
  // slash and the legacy .html so clean and .html URLs both resolve.
  const href = rest.replace(/\/$/, "").replace(/\.html$/, "");
  return { kind: "page", lang, href: href === "" ? "index" : href };
}
