// Contract checks for the figure system. Deliberately generic and cheap: they
// check that chapter blocks resolve, that every module renders in both
// languages, that the two trees embed the same figures with the same inputs,
// and that the static SVG scales to the column. They do not assert what any
// one figure draws.

import { expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { FIGURES } from "./index.ts";
import { LOADERS } from "./loaders.ts";
import { defaults, resolve } from "./lib/params.ts";
import { STATIC_WIDTHS, renderStatic, openingTime } from "./static.ts";
import { parseFigureBlock } from "../pipeline/figures.ts";
import type { Lang, ParamSpec } from "./types.ts";

const repoRoot = join(import.meta.dir, "../../..");
const LANGS: Lang[] = ["en", "zh"];

function qmdFiles(lang: Lang): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".qmd")) out.push(relative(join(repoRoot, lang), p));
    }
  };
  walk(join(repoRoot, lang));
  return out.sort();
}

// Every ```{figure} block on a page, in order.
function blocks(lang: Lang, page: string) {
  const src = readFileSync(join(repoRoot, lang, page), "utf8");
  return [...src.matchAll(/^(`{3,})\{figure\}[ \t]*\n([\s\S]*?)^\1[ \t]*$/gm)].map((m) => parseFigureBlock(m[2]));
}

test("every figure named in a chapter resolves to a module and its parameters validate", () => {
  for (const lang of LANGS) {
    for (const page of qmdFiles(lang)) {
      for (const b of blocks(lang, page)) {
        const fig = FIGURES.get(b.name);
        expect(fig, `${lang}/${page}: figure "${b.name}"`).toBeDefined();
        expect(() => resolve(fig!, b.entries), `${lang}/${page}: ${b.name} parameters`).not.toThrow();
        expect(b.label, `${lang}/${page}: ${b.name} needs a //| label: fig-... for cross-references`).toMatch(/^fig-[a-z0-9-]+$/);
        expect(b.cap, `${lang}/${page}: ${b.name} needs a caption`).toBeTruthy();
      }
    }
  }
});

test("en and zh embed the same figures with the same parameters on each page", () => {
  for (const page of qmdFiles("en")) {
    const sig = (lang: Lang) => blocks(lang, page).map((b) => JSON.stringify({ name: b.name, label: b.label, entries: b.entries }));
    expect(sig("zh"), `${page}: figure blocks`).toEqual(sig("en"));
  }
});

test("every module is registered under its file name and labels both languages", async () => {
  const infra = new Set(["index.ts", "loaders.ts", "static.ts", "types.ts"]);
  const modules = readdirSync(import.meta.dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !infra.has(f));
  for (const f of modules) expect(Object.keys(LOADERS), `${f} is not in loaders.ts`).toContain(f.slice(0, -3));
  for (const [key, load] of Object.entries(LOADERS)) expect((await load()).default.name, `loaders.ts key ${key}`).toBe(key);
  for (const [name, fig] of FIGURES) {
    expect(fig.name).toBe(name);
    expect(existsSync(join(import.meta.dir, `${name}.ts`)), `${name}.ts`).toBe(true);
    expect(Object.keys(fig.labels.zh).sort()).toEqual(Object.keys(fig.labels.en).sort());
    const texts: string[] = [fig.title.en, fig.title.zh, ...(Object.values(fig.labels.en) as string[]), ...(Object.values(fig.labels.zh) as string[])];
    for (const spec of Object.values(fig.params as Record<string, ParamSpec>)) {
      texts.push(spec.label.en, spec.label.zh);
      if (spec.kind === "choice") for (const o of spec.options) texts.push(o.label.en, o.label.zh);
    }
    for (const s of texts) {
      expect(s.trim().length, `${name}: empty label`).toBeGreaterThan(0);
      expect(s, `${name}: labels use commas, periods, or colons, not em dashes`).not.toContain("\u2014");
    }
  }
});

test("every module renders its opening state in both languages at both column widths", () => {
  for (const [name, fig] of FIGURES) {
    const p = defaults(fig);
    const t = openingTime(fig, p);
    for (const lang of LANGS) {
      for (const w of [STATIC_WIDTHS.wide, STATIC_WIDTHS.narrow]) {
        const out = fig.render({ p, t, w, uid: "test" }, lang);
        // The root carries a viewBox no wider than the layout width and no
        // fixed pixel width, so it scales to the column instead of scrolling.
        const root = out.match(/^<svg\b[^>]*>/)?.[0] ?? "";
        expect(root, `${name} ${lang} ${w}: root <svg>`).toContain("viewBox=");
        expect(root, `${name} ${lang} ${w}: fixed width`).not.toMatch(/\swidth="/);
        const vbw = Number(root.match(/viewBox="0 0 ([\d.]+) /)?.[1]);
        expect(vbw, `${name} ${lang} ${w}: viewBox width`).toBeLessThanOrEqual(w);
        expect(fig.describe({ p, t, w, uid: "test" }, lang).length).toBeGreaterThan(0);
      }
      if (fig.timeline) {
        const d = fig.timeline.duration(p);
        expect(d).toBeGreaterThan(0);
        for (const k of fig.timeline.keyframes(p, lang)) expect(k.t >= 0 && k.t <= d && k.label.length > 0).toBe(true);
        expect(() => fig.render({ p, t: d, w: STATIC_WIDTHS.wide, uid: "test" }, lang)).not.toThrow();
      }
    }
  }
});

test("the static host carries both layouts and the parameters to hydrate from", () => {
  for (const [name, fig] of FIGURES) {
    const html = renderStatic(fig, defaults(fig), "en", `fig-${name}`);
    expect(html).toContain(`data-figure="${name}"`);
    expect(html).toContain('class="fig-v fig-v-wide"');
    expect(html).toContain('class="fig-v fig-v-narrow"');
    expect(html.match(/<svg class="fig-svg"/g)?.length).toBe(2);
  }
});
