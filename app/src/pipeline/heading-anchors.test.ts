// Sections could only be shared by copying a chapter URL and scrolling; each
// h2 and h3 now ends in a link to its own fragment.
import { expect, test } from "bun:test";
import { addHeadingAnchors } from "./markdown.ts";

test("every section heading ends in a link to its own fragment", () => {
  const html = addHeadingAnchors('<h2 id="a">The model gateway</h2>\n<p>x</p>\n<h3 id="b" class="k">Tools and <code>MCP</code></h3>', "en");
  expect(html).toContain('<h2 id="a">The model gateway<a class="rdr-anchor" href="#a" aria-label="Link to this section" data-copied="Link copied">');
  expect(html).toContain('<h3 id="b" class="k">Tools and <code>MCP</code><a class="rdr-anchor" href="#b"');
  expect(html.match(/rdr-anchor/g)?.length).toBe(2);
});

test("the link is labeled in the page's language and adds no visible text", () => {
  const html = addHeadingAnchors('<h2 id="a">网关</h2>', "zh");
  expect(html).toContain('aria-label="本节链接" data-copied="链接已复制"');
  const link = html.slice(html.indexOf("<a "), html.indexOf("</a>"));
  expect(link.replace(/<[^>]+>/g, "").trim()).toBe("");
});

test("headings without an id and other levels are left alone", () => {
  const src = '<h2>No id</h2><h4 id="x">Deep</h4><h1 id="t">Title</h1>';
  expect(addHeadingAnchors(src, "en")).toBe(src);
});
