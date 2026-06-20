// Regression test for the "mermaid diagram reverts to raw text on scroll" bug.
//
// The article body is injected with dangerouslySetInnerHTML and mermaid renders
// its SVG into the <pre class="mermaid"> nodes AFTER hydration. If React
// reconciles that subtree on a later re-render (scroll updates activeId /
// progress), it re-sets innerHTML back to the raw source and wipes the SVG; the
// boot effect only runs once per chapter, so the diagram never recovers. The fix
// memoizes the article element so React bails out of reconciling it.
//
// This test drives real headless Chrome (the bug only reproduces with real
// timers; Chrome's virtual-time budget masks it). It is skipped when neither a
// Chrome binary nor a built _book is available, so CI without a browser stays
// green while local runs catch a regression.

import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = new URL("../../", import.meta.url).pathname;
const chapter = "zh/p0-orientation/01-whole-stack.html";
const figId = "fig-whole-stack-loops";

function findChrome(): string | null {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    process.env.CHROME_PATH ?? "",
    Bun.which("google-chrome") ?? "",
    Bun.which("chromium") ?? "",
    Bun.which("chromium-browser") ?? "",
  ];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

// Probe injected before </body>: render, then scroll, then report the figure
// state. SVG = rendered, RAW = reverted to source text.
const PROBE = `<script>
(async function(){
 const log=(...a)=>console.log("PROBE",...a);
 const fig=()=>document.getElementById(${JSON.stringify(figId)});
 const state=()=>{const f=fig();return f?(f.querySelector('svg')?'SVG':(f.querySelector('pre.mermaid')?'RAW':'NA')):'NONE';};
 await new Promise(r=>setTimeout(r,6000));
 log("AFTER_LOAD",state());
 const main=document.querySelector('main');
 for(let i=0;i<6;i++){main.scrollTop+=180;main.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,150));}
 await new Promise(r=>setTimeout(r,800));
 log("AFTER_SCROLL",state());
 log("DONE_MARKER");
})();
</script>`;

test("mermaid diagram stays rendered after scrolling", async () => {
  const bookDir = join(repoRoot, "_book");
  const chapterPath = join(bookDir, chapter);
  const chrome = findChrome();
  if (!chrome || !existsSync(chapterPath)) {
    console.warn(
      `skipping: ${!chrome ? "no Chrome binary" : "no built _book (run `make build`)"}`,
    );
    return;
  }

  // Serve _book; inject the probe into the target chapter.
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname.replace(/^\/+/, "");
      const file = Bun.file(join(bookDir, path));
      if (!(await file.exists())) return new Response("not found", { status: 404 });
      if (path === chapter) {
        const html = (await file.text()).replace("</body>", PROBE + "</body>");
        return new Response(html, { headers: { "content-type": "text/html" } });
      }
      return new Response(file);
    },
  });

  try {
    const url = `http://localhost:${server.port}/${chapter}`;
    const proc = Bun.spawn(
      [chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--enable-logging=stderr", "--v=0", url],
      { stderr: "pipe", stdout: "pipe" },
    );

    // Read stderr until DONE_MARKER or a hard timeout.
    const decoder = new TextDecoder();
    let log = "";
    const deadline = Date.now() + 30_000;
    const reader = proc.stderr.getReader();
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      log += decoder.decode(value, { stream: true });
      if (log.includes("PROBE DONE_MARKER")) break;
    }
    proc.kill();

    const load = log.match(/PROBE AFTER_LOAD (\w+)/)?.[1];
    const scroll = log.match(/PROBE AFTER_SCROLL (\w+)/)?.[1];
    expect(load, "diagram should render after load").toBe("SVG");
    expect(scroll, "diagram should still be rendered after scrolling").toBe("SVG");
  } finally {
    server.stop(true);
  }
}, 40_000);
