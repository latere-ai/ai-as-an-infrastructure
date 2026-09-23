// Dates the reader shows. Each chapter carries a review date: the day its
// content was last checked against the field, shown under the chapter title so
// a reader can see how current it is. The dates live in
// app/src/data/review-dates.json, keyed by manifest path (the book.yml entry
// shared by en/ and zh/, e.g. "foundations/01-scaling-laws.qmd"), so one review
// covers both language twins. They are data rather than git history: the
// production build runs without .git, and a review that changes no prose still
// moves the date.

import { readFileSync, existsSync } from "node:fs";
import type { Lang } from "../types.ts";

export const REVIEW_DATES_PATH = new URL("../data/review-dates.json", import.meta.url).pathname;

export type ReviewDates = Map<string, string>; // manifest path → YYYY-MM-DD

const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isIsoDay(s: string): boolean {
  return ISO_DAY.test(s);
}

export function isIsoMonth(s: string): boolean {
  return ISO_MONTH.test(s);
}

export function loadReviewDates(path = REVIEW_DATES_PATH): ReviewDates {
  const m: ReviewDates = new Map();
  if (!existsSync(path)) return m;
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v === "string" && isIsoDay(v)) m.set(key, v);
    else console.warn(`  review-dates: ${key} is not a YYYY-MM-DD date (${String(v)})`);
  }
  return m;
}

// The manifest path behind a page: its repo-relative source without the
// language directory ("zh/foundations/01-x.qmd" → "foundations/01-x.qmd").
export function reviewKey(srcRel: string): string {
  return srcRel.replace(/^(en|zh)\//, "");
}

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Labels are assembled by hand rather than with Intl so the server render and
// the client hydration produce the same string on every runtime.
// "2026-09-23" → "23 September 2026" (en) / "2026 年 9 月 23 日" (zh).
export function formatDate(iso: string, lang: Lang): string {
  if (!isIsoDay(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return lang === "zh" ? `${y} 年 ${m} 月 ${d} 日` : `${d} ${EN_MONTHS[m - 1]} ${y}`;
}

// "2026-09" → "September 2026" (en) / "2026 年 9 月" (zh).
export function formatMonth(ym: string, lang: Lang): string {
  if (!isIsoMonth(ym)) return "";
  const [y, m] = ym.split("-").map(Number);
  return lang === "zh" ? `${y} 年 ${m} 月` : `${EN_MONTHS[m - 1]} ${y}`;
}
