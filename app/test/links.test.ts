// Link-crawl gate: the build emits extensionless internal hrefs that nginx
// serves via `try_files $uri $uri.html $uri/`. `bun run build` succeeding does
// NOT prove those links resolve — a missed ".html" strip 404s silently. This
// resolves every internal href in _book/**/*.html against the file tree using
// the same rule, and asserts zero dangling links. Run after a build.
//
// Not every href is static, though. The server claims a small set of dynamic
// routes before the try_files fallback ever runs, so a link to one of them
// resolves without a file behind it. That set is mirrored below from
// `Handler.Owns, internal/api/api.go`; keep the two in step.

import { test, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const bookRoot = join(import.meta.dir, "..", "..", "_book");

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// Routes the Go server answers itself (`Handler.Owns`, matched in `serve`
// before the static fallback). Exact match for the four auth paths, prefix for
// the comments API: `/loginx` is still a dangling link.
const SERVER_OWNED = new Set(["/login", "/callback", "/logout", "/logout/notify"]);
const serverOwned = (p: string) => SERVER_OWNED.has(p) || p.startsWith("/api/");

// Does an nginx `try_files $uri $uri.html $uri/` request for absPath resolve?
function resolves(absPath: string): boolean {
  if (existsSync(absPath) && statSync(absPath).isFile()) return true;     // $uri
  if (existsSync(absPath + ".html")) return true;                          // $uri.html
  if (existsSync(join(absPath, "index.html"))) return true;               // $uri/ (index)
  return false;
}

const skip = (h: string) =>
  !h || h.startsWith("#") || h.startsWith("http://") || h.startsWith("https://") ||
  h.startsWith("mailto:") || h.startsWith("data:") || h.startsWith("//");

test("every internal link in _book resolves under nginx try_files", () => {
  if (!existsSync(bookRoot)) throw new Error("run `bun run build` first");
  const files = htmlFiles(bookRoot);
  expect(files.length).toBeGreaterThan(100);
  const dangling: string[] = [];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      const raw = m[1];
      if (skip(raw)) continue;
      const path = raw.split("#")[0].split("?")[0];
      if (!path) continue; // pure #anchor
      if (serverOwned(path)) continue; // answered by the server, not by a file
      // root-absolute (/favicon.svg) resolves against the site root; otherwise
      // relative to the file's directory, like a browser would.
      const abs = path.startsWith("/") ? join(bookRoot, path) : resolve(dirname(f), path);
      // a trailing-slash link (directory) → its index.html
      const target = path.endsWith("/") ? join(abs, "index.html") : abs;
      if (!resolves(target)) dangling.push(`${f.replace(bookRoot + "/", "")} -> ${raw}`);
    }
  }
  expect(dangling.slice(0, 30)).toEqual([]);
});
