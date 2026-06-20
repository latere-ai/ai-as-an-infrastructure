// The bibtex parser ships runtime ESM without bundled .d.ts at the resolved
// path; we only use parse() and a few fields, accessed with local casts.
declare module "@retorquere/bibtex-parser";
