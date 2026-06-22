// The sample chapter the dev server (dev.ts) renders. Defined here, not inline
// in dev.ts, so dev-chapter.test.ts can assert it resolves to a real chapter
// without importing dev.ts (which starts a server on import). Chapter hrefs are
// number-free (the 2026 reorg), so this is "<part>/<slug>", not "NN-slug".
export const DEV_CHAPTER_HREF = "foundations/scaling-laws";
