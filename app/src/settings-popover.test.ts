import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";

const reader = readFileSync(new URL("./Reader.tsx", import.meta.url), "utf8");

test("settings popover closes on outside pointerdown", () => {
  expect(reader).toContain("const settingsRef = useRef<HTMLDivElement>(null)");
  expect(reader).toContain('document.addEventListener("pointerdown", onPointerDown)');
  expect(reader).toContain('document.removeEventListener("pointerdown", onPointerDown)');
  expect(reader).toContain("!el.contains(e.target as Node)");
  expect(reader).toContain("<div ref={settingsRef}");
});

test("language selection lives in the settings popover, not a top-bar text button", () => {
  expect(reader).toContain('language: "Language"');
  expect(reader).toContain('language: "语言"');
  expect(reader).toContain('langChoice("en", "English")');
  expect(reader).toContain('langChoice("zh", "中文")');
  expect(reader).toContain("href={chapter.langHref}");
  expect(reader).not.toContain(">{t.lang}</a>");
  expect(reader).not.toContain('lang: "中"');
  expect(reader).not.toContain('lang: "EN"');
});
