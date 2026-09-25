// The home page's title spread and contents (landing/landing.ts renders the
// markup at build time) placed above the Preface, with the cover's tilt
// attached after hydration. Memoized so the reader's re-renders on scroll and
// settings changes never touch the markup the tilt writes to.

import { memo, useEffect, useRef } from "react";
import { mountCover } from "./tilt.ts";

export const Landing = memo(function Landing({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cover = ref.current?.querySelector<HTMLElement>("[data-cover]");
    return cover ? mountCover(cover) : undefined;
  }, [html]);
  return <div ref={ref} className="lp" dangerouslySetInnerHTML={{ __html: html }} />;
});
