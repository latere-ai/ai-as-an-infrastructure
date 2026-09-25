// The home page's title spread and contents (landing/landing.ts renders the
// markup at build time) placed above the Preface. Memoized so the reader's
// re-renders on scroll and settings changes never touch the markup.

import { memo } from "react";

export const Landing = memo(function Landing({ html }: { html: string }) {
  return <div className="lp" dangerouslySetInnerHTML={{ __html: html }} />;
});
