// Client entry: hydrate the SSR'd reader shell. Chapter data is injected as a
// global by the page template. Also registers the article runtimes (runnable
// cells, table wrapping) on window; the reader invokes them after hydration.
// These imports are client-only (hydrate.tsx is never server-rendered), so the
// runtimes can touch the browser DOM at module load safely.

import { hydrateRoot } from "react-dom/client";
import Reader from "./Reader.tsx";
import type { ChapterData } from "./types.ts";
import { wrapTables } from "./runtime/tables.ts";
import { mountRunnable } from "./runtime/live.ts";

declare global {
  interface Window {
    __CHAPTER__: ChapterData;
    __rdrTables?: () => void;
    __rdrLive?: () => void;
  }
}

window.__rdrTables = wrapTables;
window.__rdrLive = mountRunnable;

const root = document.getElementById("root");
if (root && window.__CHAPTER__) {
  hydrateRoot(root, <Reader chapter={window.__CHAPTER__} />);
}
