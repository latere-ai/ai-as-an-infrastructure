// Bun dev server: SSR the reader shell, bundle the client for hydration, serve
// the page. For shell development and screenshot verification (P0+).

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Reader from "./Reader.tsx";
import { page } from "./html.ts";
import { sampleChapter } from "./sample.ts";

const css = await Bun.file(new URL("./theme.css", import.meta.url)).text();

async function buildClient(): Promise<string> {
  const out = await Bun.build({
    entrypoints: [new URL("./hydrate.tsx", import.meta.url).pathname],
    target: "browser",
    minify: false,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!out.success) {
    console.error(out.logs);
    throw new Error("client build failed");
  }
  return await out.outputs[0].text();
}

let clientJs = await buildClient();

const port = Number(process.env.PORT ?? 4321);
Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/client.js") {
      clientJs = await buildClient(); // rebuild each load in dev
      return new Response(clientJs, { headers: { "content-type": "text/javascript" } });
    }
    const bodyHtml = renderToString(createElement(Reader, { chapter: sampleChapter }));
    const html = page({ chapter: sampleChapter, bodyHtml, css, clientSrc: "/client.js" });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
});

console.log(`reader dev server on http://localhost:${port}`);
