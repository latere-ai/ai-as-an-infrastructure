// Screenshot every figure module on one built page, the way a reader sees it:
// 1280 and 390 px viewports, light and dark theme, and with script disabled
// (the static fallback). Also reports figures that did not hydrate, console
// errors, and a page that scrolls sideways. Build first (bun run build).
//
//   bun run scripts/figure-shots.ts en/inference/memory-scheduling [out-dir]
//
// Headless Chrome is driven over the DevTools protocol; set CHROME to its path
// if it is not the macOS default. Output defaults to $TMPDIR/figure-shots.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const page = (process.argv[2] ?? "").replace(/^\/+|\.html$/g, "");
if (!page) { console.error("usage: bun run scripts/figure-shots.ts <lang>/<chapter-path> [out-dir]"); process.exit(2); }
const OUT = process.argv[3] ?? join(tmpdir(), "figure-shots");
const BOOK = join(import.meta.dir, "..", "..", "_book");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
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
  await Bun.sleep(noJs ? 300 : 900);
  if (dark && !noJs) { await js(`document.documentElement.setAttribute("data-theme", "dark")`); await Bun.sleep(200); }
}

let problems = 0;
for (const [w, noJs, dark] of [[1280, false, false], [390, false, false], [1280, false, true], [1280, true, false], [390, true, false]] as const) {
  await load(w, noJs, dark);
  const ids = await js<string[]>(`[...document.querySelectorAll("figure .fig[data-figure]")].map((h) => h.closest("figure").id)`);
  if (!noJs) {
    const cold = await js<string[]>(`[...document.querySelectorAll(".fig[data-figure]:not(.fig-ready)")].map((h) => h.dataset.figure + (h.dataset.figError ? ": " + h.dataset.figError : ""))`);
    if (cold.length) { problems++; console.log(`  not hydrated at ${w}: ${cold.join(", ")}`); }
  }
  const sideways = await js<number>(`(() => { const m = document.querySelector("main"); if (!m) return 0; const b = m.scrollLeft; m.scrollLeft = 1e5; const r = m.scrollLeft; m.scrollLeft = b; return r; })()`);
  if (sideways > 0) { problems++; console.log(`  page scrolls sideways by ${sideways}px at ${w}`); }
  for (const id of ids) {
    // Make the viewport tall enough for the figure, then bring it to the top
    // of the reader's scroll container (<main>, not the document).
    const h = await js<number>(`document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().height`);
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.ceil(h + 160), deviceScaleFactor: 2, mobile: w < 600 });
    await Bun.sleep(300);
    await js(`(() => { const f = document.getElementById(${JSON.stringify(id)}); f.scrollIntoView({ block: "start", behavior: "instant" }); const m = document.querySelector("main"); if (m) m.scrollBy({ top: -24, behavior: "instant" }); return true; })()`);
    await Bun.sleep(300);
    const b = await js<{ x: number; y: number; w: number; h: number }>(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false, clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.w + 16, height: b.h + 16, scale: 1 } });
    const file = `${id}__${w}${dark ? "-dark" : ""}${noJs ? "-nojs" : ""}.png`;
    writeFileSync(join(OUT, file), Buffer.from(shot.data, "base64"));
    console.log(`${file}  ${Math.round(b.w)}x${Math.round(b.h)}`);
  }
}
if (errors.length) { problems++; console.log(`  console exceptions:\n    ${[...new Set(errors)].join("\n    ")}`); }
console.log(`screenshots in ${OUT}${problems ? `; ${problems} problem(s) above` : ""}`);
ws.close();
chrome.kill();
server.stop(true);
rmSync(profile, { recursive: true, force: true });
process.exit(problems ? 1 : 0);
