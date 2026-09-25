// The not-found page is served, status 404, at whatever address was requested.
// A relative URL on it resolves against that invented address, which is how a
// crawler composes the next one, so every href and src must be root-relative,
// absolute https, or a fragment. It must also stay out of the index and leave
// the reader's language cookie alone.

import { test, expect } from "bun:test";
import { notFoundPage } from "./html.ts";

const html = notFoundPage({ css: "" });
const urls = [...html.matchAll(/\b(?:href|src)="([^"]*)"/gi)].map((m) => m[1]);

test("every href and src resolves the same at any address", () => {
  expect(urls.length).toBeGreaterThan(0);
  const relative = urls.filter((u) => !u.startsWith("/") && !u.startsWith("https://") && !u.startsWith("#"));
  expect(relative).toEqual([]);
});

test("links both language homes", () => {
  expect(urls).toContain("/en/");
  expect(urls).toContain("/zh/");
});

test("is not indexed, sets no cookie, and loads no reader bundle", () => {
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).not.toContain("document.cookie");
  expect(html).not.toContain('type="module"');
  expect(html).not.toContain('rel="canonical"');
});
