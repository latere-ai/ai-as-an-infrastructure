// Client entry: hydrate the SSR'd reader shell. Chapter data is injected as a
// global by the page template (dev server now; SSG build later).

import { hydrateRoot } from "react-dom/client";
import Reader from "./Reader.tsx";
import type { ChapterData } from "./types.ts";

declare global {
  interface Window { __CHAPTER__: ChapterData; }
}

const root = document.getElementById("root");
if (root && window.__CHAPTER__) {
  hydrateRoot(root, <Reader chapter={window.__CHAPTER__} />);
}
