// Screenshot every figure module on one built page, the way a reader sees it:
// 1280 and 390 px viewports, light and dark theme, and with script disabled
// (the static fallback). Also reports figures that did not hydrate, console
// errors, and a page that scrolls sideways. Build first (bun run build).
//
//   bun run scripts/figure-shots.ts en/inference/memory-scheduling [out-dir]
//
// A headless Chrome is driven over the DevTools protocol. CHROME must name a
// standalone headless binary such as chrome-headless-shell
// (`bunx @puppeteer/browsers install chrome-headless-shell@stable`). There is no
// fallback to the desktop Chrome app: on macOS a headless instance of that app
// bundle captures the next Dock or Finder launch, so the desktop browser will
// not open while shots run. Output defaults to $TMPDIR/figure-shots.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const page = (process.argv[2] ?? "").replace(/^\/+|\.html$/g, "");
if (!page) { console.error("usage: bun run scripts/figure-shots.ts <lang>/<chapter-path> [out-dir]"); process.exit(2); }
const OUT = process.argv[3] ?? join(tmpdir(), "figure-shots");
const BOOK = join(import.meta.dir, "..", "..", "_book");
const CHROME = process.env.CHROME ?? "";
if (!CHROME) { console.error("set CHROME to a headless Chrome binary, for example chrome-headless-shell"); process.exit(2); }
if (CHROME.includes(".app/Contents/MacOS/")) { console.error(`CHROME points into a macOS app bundle (${CHROME}); use chrome-headless-shell instead`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const server = Bun.serve({
  port: 0, hostname: "127.0.0.1",
  async fetch(req) {
    const p = decodeURIComponent(new URL(req.url).pathname);
    if (p.includes("..")) return new Response("bad path", { status: 400 });
    let file = Bun.file(join(BOOK, p.endsWith("/") ? p + "index.html" : p));
    if (!(await file.exists())) file = Bun.file(join(BOOK, p + ".html"));
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});

const profile = join(OUT, ".chrome-profile");
rmSync(profile, { recursive: true, force: true });
mkdirSync(profile, { recursive: true });
const chrome = Bun.spawn([CHROME, "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdout: "ignore", stderr: "ignore" });
let port = 0;
for (let i = 0; i < 100 && !port; i++) {
  const f = join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = Number(readFileSync(f, "utf8").split("\n")[0]); else await Bun.sleep(100);
}
if (!port) throw new Error(`Chrome did not start (CHROME=${CHROME})`);
const target = ((await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as any[]).find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res) => (ws.onopen = res));

let seq = 0;
const pending = new Map<number, (m: any) => void>();
const events: Array<(m: any) => void> = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(String(ev.data));
  if (m.id != null) pending.get(m.id)?.(m); else events.forEach((f) => f(m));
};
function send(method: string, params: object = {}): Promise<any> {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))));
}
const errors: string[] = [];
events.push((m) => {
  if (m.method === "Runtime.exceptionThrown") errors.push(String(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).split("\n")[0]);
});
async function js<T>(expression: string): Promise<T> {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value as T;
}
await send("Page.enable");
await send("Runtime.enable");

async function load(w: number, noJs: boolean, dark: boolean) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 2, mobile: w < 600 });
  await send("Emulation.setScriptExecutionDisabled", { value: noJs });
  await send("Page.navigate", { url: "about:blank" });
  const loaded = new Promise((res) => events.push((m) => m.method === "Page.loadEventFired" && res(null)));
  await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/${page}.html` });
  await loaded;
  if (noJs) await Bun.sleep(300); else await hydrated(w);
  if (dark && !noJs) { await js(`document.documentElement.setAttribute("data-theme", "dark")`); await Bun.sleep(200); }
}

// Wait until every figure host has mounted (.fig-ready) or recorded a failure
// (data-fig-error), since figure modules load as lazy chunks after the page's
// load event. The check runs only once the page itself has loaded: the load
// event awaited above can be the one from about:blank. A host that does
// neither within the timeout stops the run.
const HYDRATE_TIMEOUT_MS = 15_000;
async function hydrated(w: number) {
  const deadline = Date.now() + HYDRATE_TIMEOUT_MS;
  const path = JSON.stringify(`/${page}.html`);
  for (;;) {
    const waiting = await js<string[] | null>(`location.pathname !== ${path} || document.readyState !== "complete" ? null : [...document.querySelectorAll(".fig[data-figure]")].filter((h) => !h.classList.contains("fig-ready") && !h.dataset.figError).map((h) => h.dataset.figure)`);
    if (waiting && !waiting.length) break;
    if (Date.now() > deadline) throw new Error(waiting ? `figures not hydrated ${HYDRATE_TIMEOUT_MS / 1000} s after load of ${page} at ${w} px: ${waiting.join(", ")}` : `${page} did not finish loading within ${HYDRATE_TIMEOUT_MS / 1000} s at ${w} px`);
    await Bun.sleep(100);
  }
  await js(`document.fonts.ready.then(() => true)`);
  await Bun.sleep(200); // the ResizeObserver redraw at the measured column width
}

let problems = 0;
try {
  for (const [w, noJs, dark] of [[1280, false, false], [390, false, false], [1280, false, true], [1280, true, false], [390, true, false]] as const) {
    await load(w, noJs, dark);
    const ids = await js<string[]>(`[...document.querySelectorAll("figure .fig[data-figure]")].map((h) => h.closest("figure").id)`);
    if (!noJs) {
      const cold = await js<string[]>(`[...document.querySelectorAll(".fig[data-figure]:not(.fig-ready)")].map((h) => h.dataset.figure + (h.dataset.figError ? ": " + h.dataset.figError : ""))`);
      if (cold.length) { problems++; console.log(`  not hydrated at ${w}: ${cold.join(", ")}`); }
    }
    const sideways = await js<number>(`(() => { const m = document.scrollingElement; const b = m.scrollLeft; m.scrollLeft = 1e5; const r = m.scrollLeft; m.scrollLeft = b; return r; })()`);
    if (sideways > 0) { problems++; console.log(`  page scrolls sideways by ${sideways}px at ${w}`); }
    for (const id of ids) {
      // Make the viewport tall enough for the figure, then bring it to the top
      // of the page; the document's scroll-padding keeps it clear of the header.
      const h = await js<number>(`document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().height`);
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.ceil(h + 160), deviceScaleFactor: 2, mobile: w < 600 });
      await Bun.sleep(300);
      await js(`(() => { const f = document.getElementById(${JSON.stringify(id)}); f.scrollIntoView({ block: "start", behavior: "instant" }); return true; })()`);
      await Bun.sleep(300);
      // The clip is in page coordinates, so the document's scroll offset is
      // added to the figure's viewport position.
      const b = await js<{ x: number; y: number; w: number; h: number }>(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false, clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.w + 16, height: b.h + 16, scale: 1 } });
      const file = `${id}__${w}${dark ? "-dark" : ""}${noJs ? "-nojs" : ""}.png`;
      writeFileSync(join(OUT, file), Buffer.from(shot.data, "base64"));
      console.log(`${file}  ${Math.round(b.w)}x${Math.round(b.h)}`);
    }
  }
} catch (e) {
  problems++;
  console.log(`  ${(e as Error).message}`);
} finally {
  ws.close();
  chrome.kill();
  server.stop(true);
  rmSync(profile, { recursive: true, force: true });
}
if (errors.length) { problems++; console.log(`  console exceptions:\n    ${[...new Set(errors)].join("\n    ")}`); }
console.log(`screenshots in ${OUT}${problems ? `; ${problems} problem(s) above` : ""}`);
process.exit(problems ? 1 : 0);
