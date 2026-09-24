// The reader shell: chrome (sticky header, full-book navigation column, "On
// this page" column, settings, chapter opener, page footer) around a compiled
// article body. The document is the scroll container, so the browser owns
// scrolling, anchors and find-in-page. SSR-safe: all browser access is guarded
// and runs in effects so renderToString works.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChapterData, Lang, Layout, Palette, ReaderSettings } from "./types.ts";
import { DEFAULT_SETTINGS } from "./types.ts";
import { runSearch, type SearchDoc } from "./search-match.ts";
import { Comments } from "./comments.tsx";
import { BookmarkButton, ChapterStats, HeaderAuth } from "./account.tsx";
import { REPO_URL, editUrl, issueUrl } from "./repo.ts";
import { pageUrl } from "./site.ts";

type Strings = {
  sidebar: string; onThisPage: string; settings: string; search: string;
  palette: string; ink: string; clay: string; rose: string; theme: string; light: string; dark: string;
  body: string; sans: string; kai: string; size: string; layout: string;
  codex: string; manuscript: string; atlas: string; prev: string; next: string; language: string; resize: string;
  author: string; updated: string; reviewed: string; readtimeLabel: string; noResults: string;
  aboutAuthor: string; aboutLatere: string; sourceRepo: string;
  contributePrompt: string; reportIssue: string; editPage: string;
};

const STRINGS: Record<Lang, Strings> = {
  zh: {
    sidebar: "目录侧栏", onThisPage: "本页目录", settings: "阅读设置", search: "搜索章节…",
    palette: "配色", ink: "墨纸", clay: "靛蓝", rose: "玫瑰", theme: "主题", light: "浅色", dark: "深色",
    body: "正文字体", sans: "黑体", kai: "楷体", size: "字号", layout: "版式",
    codex: "典藏", manuscript: "手稿", atlas: "图册", prev: "上一章", next: "下一章", language: "语言", resize: "拖动调整宽度",
    author: "作者", updated: "更新于", reviewed: "审阅于", readtimeLabel: "阅读时长", noResults: "没有匹配的结果",
    aboutAuthor: "关于作者", aboutLatere: "关于 Latere AI", sourceRepo: "GitHub 源码仓库",
    contributePrompt: "本书在 GitHub 上公开写作。发现错误或有不清楚的地方：", reportIssue: "提交问题", editPage: "编辑本页",
  },
  en: {
    sidebar: "Sidebar", onThisPage: "On this page", settings: "Reading settings", search: "Search chapters…",
    palette: "Palette", ink: "Ink", clay: "Azure", rose: "Rose", theme: "Theme", light: "Light", dark: "Dark",
    body: "Body font", sans: "Sans", kai: "Kai", size: "Text size", layout: "Layout",
    codex: "Codex", manuscript: "Manuscript", atlas: "Atlas", prev: "Previous", next: "Next", language: "Language", resize: "Drag to resize",
    author: "Author", updated: "Updated", reviewed: "Reviewed", readtimeLabel: "Reading time", noResults: "No matching results",
    aboutAuthor: "About Author", aboutLatere: "About Latere AI", sourceRepo: "Source on GitHub",
    contributePrompt: "This book is written in the open. Found an error, or something unclear?", reportIssue: "Report an issue", editPage: "Edit this page",
  },
} as const;

const LS_KEY = "aaai-reader-settings";

// Frame geometry, mirrored in theme.css: the header height (--hdr-h), the
// narrowest article column that keeps figure modules on their wide layout plus
// its gutters, and the viewport width from which the "On this page" column is
// docked instead of living in a drawer.
const HEADER_H = 48;
const MAIN_MIN = 640 + 2 * 32;
const TOC_MIN_VW = 1200;

const SIDEBAR_EXTERNAL_LINKS = [
  { labelKey: "aboutAuthor", href: "https://changkun.de" },
  { labelKey: "aboutLatere", href: "https://latere.ai" },
  { labelKey: "sourceRepo", href: REPO_URL },
] as const;

// GitHub's octicon mark, the one shape readers recognize without a label.
function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

// latere brand mark (from ../latere-ai LatereLogoMark.vue).
function LatereLogo() {
  return (
    <svg viewBox="147 279 736 425" width={26} height={15} fill="var(--accent)" aria-hidden style={{ flex: "none", transform: "translateY(1px)" }}>
      <g transform="translate(0 1024) scale(0.1 -0.1)">
        <path d="M7281 7439 c-263 -25 -575 -124 -883 -280 -385 -196 -764 -463 -1133 -799 -163 -148 -575 -562 -702 -704 -315 -353 -539 -670 -638 -905 -19 -45 -35 -87 -35 -93 0 -6 22 23 48 63 168 256 665 790 1042 1120 638 557 1244 947 1735 1115 304 105 506 139 760 131 175 -6 239 -17 385 -63 103 -32 144 -52 238 -117 225 -155 371 -428 402 -751 35 -378 -122 -885 -405 -1311 -209 -314 -531 -641 -865 -882 -505 -364 -1124 -588 -1747 -633 -196 -14 -423 -1 -648 36 -166 28 -381 81 -464 113 -82 33 -73 17 15 -27 387 -193 909 -283 1409 -242 878 73 1740 531 2341 1245 348 413 589 914 670 1390 23 136 24 434 1 566 -68 393 -280 698 -607 872 -244 130 -585 188 -919 156z" />
        <path d="M3790 7343 c-199 -13 -403 -45 -550 -84 -738 -199 -1279 -609 -1578 -1197 -73 -143 -122 -285 -159 -457 -24 -118 -27 -149 -26 -330 0 -175 3 -215 26 -321 59 -279 177 -525 353 -734 325 -388 794 -609 1348 -637 313 -15 763 72 1096 212 262 110 529 267 730 428 99 80 286 263 365 357 57 68 155 210 155 224 0 4 -43 -32 -96 -78 -286 -251 -789 -554 -1129 -679 -629 -232 -1234 -231 -1698 3 -127 64 -211 123 -311 219 -217 210 -357 460 -422 761 -15 68 -19 127 -19 290 0 186 3 215 27 315 171 719 788 1271 1658 1484 488 119 948 121 1424 6 55 -13 102 -23 103 -21 6 6 -184 85 -277 115 -274 89 -728 145 -1020 124z" />
        <path d="M4355 6874 c-431 -32 -757 -119 -1081 -288 -453 -236 -748 -562 -860 -951 -87 -303 -41 -671 114 -915 170 -269 431 -430 787 -487 140 -22 438 -14 589 16 141 29 289 77 402 133 93 46 209 116 203 123 -2 1 -44 -11 -94 -27 -218 -74 -505 -110 -709 -90 -268 27 -449 86 -641 209 -364 235 -484 682 -295 1099 207 458 718 825 1385 994 444 113 807 127 1130 43 13 -3 17 -2 10 5 -33 32 -307 102 -480 122 -100 11 -382 20 -460 14z" />
        <path d="M7115 6809 c-463 -70 -919 -303 -1510 -775 -518 -413 -995 -938 -1203 -1328 -24 -43 -41 -82 -40 -87 2 -4 38 36 80 89 256 323 656 710 1038 1008 596 465 1139 743 1568 805 118 17 317 7 412 -21 225 -64 378 -206 446 -412 25 -75 28 -98 28 -228 0 -105 -5 -169 -18 -230 -80 -368 -281 -709 -631 -1069 -258 -265 -535 -468 -865 -632 -531 -264 -991 -378 -1539 -380 -210 0 -213 -9 -13 -36 168 -22 500 -22 675 1 333 43 709 152 1027 299 169 77 407 220 570 340 566 418 941 947 1065 1502 25 112 31 372 10 480 -60 317 -255 543 -549 634 -152 47 -389 64 -551 40z" />
        <path d="M6770 6241 c-199 -43 -425 -141 -623 -271 -60 -40 -107 -74 -104 -76 2 -2 42 14 88 35 122 57 334 127 455 151 334 64 544 -32 595 -273 19 -88 6 -238 -30 -346 -40 -118 -133 -301 -218 -428 -198 -297 -501 -598 -818 -811 -264 -177 -470 -272 -845 -391 -59 -18 127 -5 260 19 226 41 432 114 693 247 647 330 1105 859 1233 1424 12 50 17 120 18 214 0 121 -3 149 -23 205 -54 155 -154 253 -305 299 -88 27 -253 28 -376 2z" />
        <path d="M5515 5516 c-58 -27 -116 -82 -142 -135 -14 -27 -18 -59 -18 -131 0 -87 3 -100 30 -148 54 -99 132 -146 245 -146 96 -1 168 32 235 106 168 186 27 478 -230 478 -53 0 -82 -6 -120 -24z" />
      </g>
    </svg>
  );
}

function Icon({ d, size = 16 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      {d}
    </svg>
  );
}

export interface ReaderProps {
  chapter: ChapterData;
  initial?: Partial<ReaderSettings>;
}

export default function Reader({ chapter, initial }: ReaderProps) {
  const lang: Lang = chapter.lang;
  const t = STRINGS[lang];
  const [s, setS] = useState<ReaderSettings>({ ...DEFAULT_SETTINGS, ...initial });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string>(chapter.headings[0]?.id ?? "");
  const [mobile, setMobile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tocDrawer, setTocDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Viewport width, for fitting the side columns around a 640 px article. The
  // SSR value assumes a desktop; CSS media queries hide the columns on narrow
  // screens before hydration corrects it.
  const [vw, setVw] = useState(1440);
  const [tocFits, setTocFits] = useState(true);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Spotlight search: Cmd/Ctrl+K opens it from anywhere (preventDefault so the
  // browser does not steal the chord for its address bar / search shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // hydrate persisted settings + viewport class on the client
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setS((prev) => ({ ...prev, ...saved }));
        // theme/palette/layout live on <html> (a blocking head script already
        // applied them before paint to avoid a flash). Re-assert here so the dev
        // server, which omits that script, still tracks the persisted choice.
        if (saved.theme) document.documentElement.dataset.theme = saved.theme;
        if (saved.palette) document.documentElement.dataset.palette = saved.palette;
        if (saved.layout) document.documentElement.dataset.layout = saved.layout;
      }
    } catch {}
    const mq = window.matchMedia("(max-width: 991.98px)");
    const wide = window.matchMedia(`(min-width: ${TOC_MIN_VW}px)`);
    const onMq = () => { setMobile(mq.matches); setTocFits(wide.matches); setVw(document.documentElement.clientWidth); };
    onMq();
    mq.addEventListener("change", onMq);
    wide.addEventListener("change", onMq);
    window.addEventListener("resize", onMq, { passive: true });
    return () => {
      mq.removeEventListener("change", onMq);
      wide.removeEventListener("change", onMq);
      window.removeEventListener("resize", onMq);
    };
  }, []);

  // With the document as the scroller, an open drawer or the search dialog
  // would let the page scroll underneath it; hold the page still meanwhile.
  const overlayOpen = drawer || tocDrawer || searchOpen;
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [overlayOpen]);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
  }, [s]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = settingsRef.current;
      if (el && !el.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [settingsOpen]);

  // The document is the scroll container. Progress and the active heading
  // track the window's scroll; #fragment links, scroll restoration and
  // find-in-page are left to the browser (scroll-padding clears the header).
  useEffect(() => {
    let ticking = false;
    const ids = chapter.headings.map((h) => h.id);
    const update = () => {
      ticking = false;
      const se = document.scrollingElement ?? document.documentElement;
      const max = se.scrollHeight - se.clientHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, se.scrollTop / max)) : 0);
      let cur = ids[0] ?? "";
      for (const id of ids) {
        const h = document.getElementById(id);
        if (h && h.getBoundingClientRect().top <= HEADER_H + 40) cur = id;
      }
      setActiveId(cur);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [chapter.headings]);

  // Initialize the article runtimes (interactive viz/3d, figure modules,
  // runnable Python, table wrapping) AFTER React has hydrated the article. They
  // operate on dangerouslySetInnerHTML nodes that React owns, so booting them on
  // DOMContentLoaded (the old static-renderer path) races hydration and leaves them dead.
  useEffect(() => {
    let cancelled = false;
    const w = window as unknown as Record<string, (() => void) | undefined>;
    const boot = () => {
      if (cancelled) return;
      w.__rdrViz?.();
      w.__rdrFigures?.();
      w.__rdrLive?.();
      w.__rdrTables?.();
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(boot));
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [chapter.contentHtml]);

  // Drag-to-resize the sidebar / mini-TOC (design: nav 200-460, toc 170-360).
  function startDrag(which: "nav" | "toc", e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = which === "nav" ? s.navW : s.tocW;
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      if (which === "nav") set({ navW: Math.max(200, Math.min(460, startW + delta)) });
      else set({ tocW: Math.max(170, Math.min(360, startW - delta)) });
    };
    const up = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Memoize the article body so scroll/settings re-renders keep the SAME element
  // reference. React then bails out of reconciling this subtree, so it never
  // re-sets innerHTML over the nodes the runtimes mutated (live figures, viz
  // canvases, runnable editors); the boot effect only runs once per chapter, so
  // a reset would never recover.
  const articleBody = useMemo(
    () => <div className="rdr-article" dangerouslySetInnerHTML={{ __html: chapter.contentHtml }} />,
    [chapter.contentHtml],
  );

  const set = (patch: Partial<ReaderSettings>) => {
    // theme/palette are read off <html> by the CSS (so a head script can set them
    // pre-paint); mirror a user toggle there immediately, the rest is React state.
    if (typeof document !== "undefined") {
      if (patch.theme) document.documentElement.dataset.theme = patch.theme;
      if (patch.palette) document.documentElement.dataset.palette = patch.palette;
      // the reading measure is a CSS var keyed on <html data-layout>, same deal.
      if (patch.layout) document.documentElement.dataset.layout = patch.layout;
    }
    setS((p) => ({ ...p, ...patch }));
  };
  const fontScale = Math.min(1.4, Math.max(0.8, s.fontScale));

  // Column fit: the article column keeps at least MAIN_MIN, so a widened nav
  // gives way first, and the mini-TOC docks only where it still fits beside it.
  // Below that it lives in the same drawer the phone layout uses.
  const showSidebar = !mobile && !s.navCollapsed;
  const navW = Math.max(200, Math.min(s.navW, vw - MAIN_MIN));
  const tocRoom = vw - (showSidebar ? navW : 0) - MAIN_MIN;
  const tocDocked = !mobile && tocFits && tocRoom >= 170;
  const tocW = Math.max(170, Math.min(s.tocW, tocRoom));
  const hasToc = chapter.headings.length > 0;
  const showMiniToc = tocDocked && hasToc && !s.tocCollapsed;
  const bodyFont = s.serifBody ? "var(--font-cjk)" : "var(--font-ui)";
  const showBreadcrumbTitle = !chapter.isPartIntro && !!chapter.chapterNum && chapter.title !== chapter.crumbChapter;

  // Header progress ring: an 8px-radius circle (circumference ~50.27) whose dash
  // offset shrinks as the reader scrolls the page.
  const progressDash = (50.27 * (1 - progress)).toFixed(2);
  const progressLabel = `${Math.round(progress * 100)}%`;
  const searchIcon = <Icon d={<><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></>} size={14} />;

  return (
    <div
      className="reader"
      data-layout={s.layout}
      style={{
        background: "var(--bg-surface)", color: "var(--fg-1)", fontFamily: "var(--font-ui)",
        fontSize: `calc(18px * ${fontScale})`,
      }}
    >
      {/* ===== STICKY HEADER ===== */}
      <header className="rdr-header">
        <button onClick={() => (mobile ? (setTocDrawer(false), setDrawer((d) => !d)) : set({ navCollapsed: !s.navCollapsed }))}
          title={t.sidebar} aria-label={t.sidebar} aria-pressed={mobile ? drawer : !s.navCollapsed} className="rdr-btn">
          <Icon d={<><rect x="2" y="3" width="12" height="10" rx="2" /><line x1="6.5" y1="3" x2="6.5" y2="13" /></>} />
        </button>

        <a href={chapter.prefix || "./"} className="rdr-brand">
          <LatereLogo />
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: lang === "zh" ? "normal" : "italic", fontSize: 19, letterSpacing: "-.01em", lineHeight: 1 }}>
            {lang === "zh" ? "AI 基建" : "AI Infra"}
          </span>
        </a>

        {!mobile ? (
          <nav aria-label="breadcrumb" className="rdr-crumb rdr-desk">
            <span style={{ flex: "none", overflow: "hidden", textOverflow: "ellipsis" }}>{chapter.partShort}</span>
            <span className="is-sep">·</span>
            <span className="is-here" style={{ flex: "none" }}>{chapter.crumbChapter}</span>
            {showBreadcrumbTitle && (
              <>
                <span className="is-sep">·</span>
                <span className="is-title">{chapter.title}</span>
              </>
            )}
          </nav>
        ) : (
          <div style={{ flex: "1 1 auto" }} />
        )}

        {!mobile ? (
          <button onClick={() => setSearchOpen(true)} aria-label={t.search} className="rdr-search rdr-desk">
            {searchIcon}
            <span>{t.search}</span>
            <kbd className="rdr-kbd">⌘K</kbd>
          </button>
        ) : (
          <button onClick={() => setSearchOpen(true)} title={t.search} aria-label={t.search} className="rdr-btn">{searchIcon}</button>
        )}

        {!mobile && (
          <div title={progressLabel} className="rdr-pct rdr-desk">
            <svg width={14} height={14} viewBox="0 0 20 20" aria-hidden style={{ flex: "none", transform: "rotate(-90deg)" }}>
              <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border-strong)" strokeWidth={2.5} />
              <circle cx="10" cy="10" r="8" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round"
                strokeDasharray="50.27" strokeDashoffset={progressDash} style={{ transition: "stroke-dashoffset .15s linear" }} />
            </svg>
            <span style={{ minWidth: 26, textAlign: "right" }}>{progressLabel}</span>
          </div>
        )}

        {!mobile && (
          <a href={REPO_URL} target="_blank" rel="noreferrer" title={t.sourceRepo} aria-label={t.sourceRepo} className="rdr-btn rdr-desk">
            <GitHubMark />
          </a>
        )}

        {hasToc && (
          <button onClick={() => (tocDocked ? set({ tocCollapsed: !s.tocCollapsed }) : (setDrawer(false), setTocDrawer((d) => !d)))}
            title={t.onThisPage} aria-label={t.onThisPage} aria-pressed={tocDocked ? !s.tocCollapsed : tocDrawer} className="rdr-btn">
            <Icon d={<><rect x="2" y="3" width="12" height="10" rx="2" /><line x1="9.5" y1="3" x2="9.5" y2="13" /></>} />
          </button>
        )}

        <div ref={settingsRef} style={{ position: "relative", flex: "none" }}>
          <button onClick={() => setSettingsOpen((o) => !o)} title={t.settings} aria-label={t.settings} aria-expanded={settingsOpen} className="rdr-btn">
            <Icon d={<><path d="M2 4.5h7M11 4.5h3M2 11.5h3M7 11.5h7" strokeLinecap="round" /><circle cx="10" cy="4.5" r="2" /><circle cx="5.5" cy="11.5" r="2" /></>} />
          </button>
          {settingsOpen && <SettingsPanel t={t} s={s} set={set} chapter={chapter} />}
        </div>

        <HeaderAuth lang={lang} />

        <div className="rdr-progress" aria-hidden style={{ transform: `scaleX(${progress})` }} />
      </header>

      {/* ===== BODY ROW: nav | article | on this page. The window scrolls. ===== */}
      <div className="rdr-body">
        {/* Desktop nav. Wrapped so a CSS media query can hide it on mobile before
            JS hydrates (mobile starts false in SSR, so it would otherwise flash
            open on phones until the matchMedia effect runs). */}
        <div className="rdr-desktop-aside">
          {showSidebar && (
            <SidebarTree t={t} chapter={chapter} width={navW}
              onStartDrag={(e) => startDrag("nav", e)} />
          )}
        </div>

        <main className="rdr-main">
          <article className="rdr-col" style={{ fontFamily: bodyFont }}>
            <ChapterOpener chapter={chapter} t={t} />
            {articleBody}
            <PrevNextNav chapter={chapter} t={t} />
            <Comments lang={chapter.lang} path={chapter.path} />
            <PageFooter chapter={chapter} t={t} />
          </article>
        </main>

        <div className="rdr-desktop-aside rdr-toc-wrap">
          {showMiniToc && (
            <MiniToc t={t} chapter={chapter} activeId={activeId} width={tocW}
              onStartDrag={(e) => startDrag("toc", e)} onClose={() => set({ tocCollapsed: true })} />
          )}
        </div>
      </div>

      {/* nav drawer (phones) */}
      {mobile && drawer && (
        <>
          <div className="rdr-scrim" onClick={() => setDrawer(false)} />
          <div className="rdr-drawer is-left">
            <SidebarTree t={t} chapter={chapter} embedded onNavigate={() => setDrawer(false)} />
          </div>
        </>
      )}

      {/* "on this page" drawer: phones, and desktops too narrow to dock it */}
      {!tocDocked && tocDrawer && (
        <>
          <div className="rdr-scrim" onClick={() => setTocDrawer(false)} />
          <div className="rdr-drawer is-right">
            <div className="rdr-toc-title" style={{ marginBottom: 10 }}>{t.onThisPage}</div>
            <TocLinks chapter={chapter} activeId={activeId} onNavigate={() => setTocDrawer(false)} />
          </div>
        </>
      )}

      {searchOpen && <SearchModal t={t} prefix={chapter.prefix} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

// Chapter metadata on one compact line that wraps as needed: author, review
// date, reading time, then the view counts and the bookmark toggle once the
// account API answers.
function MetaRow({ chapter, t }: { chapter: ChapterData; t: Strings }) {
  // One date per page: the review date when the chapter has one, else the git
  // modification date (empty in the production build, which has no .git).
  const items = [
    { l: t.author, v: chapter.author },
    chapter.reviewed ? { l: t.reviewed, v: chapter.reviewed } : { l: t.updated, v: chapter.updated },
    { l: t.readtimeLabel, v: chapter.readtime },
  ].filter((i) => i.v);
  if (!items.length) return null;
  return (
    <div className="rdr-meta-row">
      {items.map((i) => (
        <div key={i.l} className="rdr-meta-item" style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 }}>
          <span className="rdr-meta-label">{i.l}</span><span className="rdr-meta-value">{i.v}</span>
        </div>
      ))}
      <ChapterStats lang={chapter.lang} path={chapter.path} />
      <BookmarkButton lang={chapter.lang} path={chapter.path} />
    </div>
  );
}

function ChapterOpener({ chapter, t }: { chapter: ChapterData; t: Strings }) {
  return (
    <div>
      {chapter.eyebrow && <div className="rdr-kicker">{chapter.eyebrow}</div>}
      <h1 className="rdr-title">{chapter.title}</h1>
      <MetaRow chapter={chapter} t={t} />
    </div>
  );
}

// Spotlight-style search overlay: a centred command palette with live results,
// keyboard navigation (↑/↓ to move, Enter to open, Esc to close).
function SearchModal({ t, prefix, onClose }: { t: Strings; prefix: string; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load the index once on open, and focus the field.
  useEffect(() => {
    fetch(`${prefix}search.json`).then((r) => r.json()).then((d: SearchDoc[]) => setDocs(d)).catch(() => setDocs([]));
    inputRef.current?.focus();
  }, [prefix]);

  const results = useMemo(() => (docs ? runSearch(docs, q) : []), [q, docs]);

  // Keep the selection in range as results change, and scrolled into view.
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    const node = listRef.current?.children[sel] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const hrefFor = (d: SearchDoc) => {
    const base = d.href === "index" ? (prefix || "./") : `${prefix}${d.href}`;
    return d.anchor ? `${base}#${d.anchor}` : base;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      const r = results[sel];
      if (r) { e.preventDefault(); location.href = hrefFor(r.doc); }
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 80, display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "12vh 16px 16px", background: "rgba(0,0,0,.32)",
    }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onKey} className="rdr-dialog" role="dialog" aria-modal="true" aria-label={t.search}>
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderBottom: "1px solid var(--border-strong)" }}>
          <span style={{ flex: "none", color: "var(--fg-3)" }}>
            <Icon d={<><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></>} size={17} />
          </span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} style={{
            flex: 1, height: 48, border: "none", background: "transparent", color: "var(--fg-1)",
            fontFamily: "var(--font-ui)", fontSize: 16, outline: "none",
          }} />
          <kbd style={{
            flex: "none", fontFamily: "var(--font-ui)", fontSize: 10.5, fontWeight: 600, color: "var(--fg-3)",
            border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: "2px 6px",
          }}>ESC</kbd>
        </div>
        {results.length > 0 && (
          <div ref={listRef} style={{ overflowY: "auto", padding: 6 }}>
            {results.map(({ doc: d, snip }, i) => (
              <a key={`${d.href}#${d.anchor}-${i}`} href={hrefFor(d)} onMouseEnter={() => setSel(i)} className="rdr-hit" style={{ background: i === sel ? "var(--accent-subtle)" : "transparent" }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--fg-3)", marginRight: 6 }}>{d.num || "·"}</span>
                  {d.title}
                  {d.heading && <span style={{ color: "var(--fg-3)", fontWeight: 400 }}> › {d.heading}</span>}
                </div>
                {snip.hit && (
                  <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 3, lineHeight: 1.45 }}>
                    {snip.pre}
                    <mark style={{ background: "var(--accent-glow)", color: "inherit", padding: "0 1px", borderRadius: 2 }}>{snip.hit}</mark>
                    {snip.post}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
        {q.trim() && results.length === 0 && docs && (
          <div style={{ padding: "22px 16px", color: "var(--fg-3)", fontSize: 13 }}>{t.noResults}</div>
        )}
      </div>
    </div>
  );
}

// Where the chapter nav starts scrolled on load. The early parts sit right
// under the About links, so pulling them to the top of the list would push
// those links out of view and buy the reader nothing: stay at the top unless
// the active part starts at or below the middle of the nav.
export function navInitialScrollTop(offsetTop: number, viewport: number): number {
  return offsetTop >= viewport / 2 ? offsetTop : 0;
}

function SidebarTree({ t, chapter, embedded, onNavigate, onStartDrag, width = 264 }:{ t: Strings; chapter: ChapterData; embedded?: boolean; onNavigate?: () => void; onStartDrag?: (e: React.PointerEvent) => void; width?: number }) {
  // Parts collapse; the part holding the active chapter starts open.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const isOpen = (part: { id: string; chapters: { active?: boolean }[] }) =>
    closed[part.id] === undefined ? true : !closed[part.id];
  // On load, scroll the nav so the part holding the active chapter sits at the
  // top of the list. Setting scrollTop past the max clamps to the bottom, so a
  // part near the end lands as far up as it can: visible either way.
  const scrollRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sc = embedded ? scrollRef.current?.parentElement : scrollRef.current;
    const el = activeRef.current;
    if (sc && el) sc.scrollTop = navInitialScrollTop(el.offsetTop, sc.clientHeight);
  }, [embedded]);
  const list = (
    <nav ref={scrollRef} className={embedded ? undefined : "rdr-nav-scroll"} style={embedded ? { padding: "8px 8px 32px", position: "relative" } : { position: "relative" }}>
      <SidebarExternalLinks t={t} />
      {chapter.toc.map((part) => {
        const active = !!part.active || part.chapters.some((ch) => ch.active);
        if (part.single) {
          return (
            <div key={part.id} ref={active ? activeRef : undefined}>
              {part.chapters.map((ch) => (
                <a key={ch.href} href={ch.href} onClick={onNavigate} className="rdr-nav-row" aria-current={ch.active ? "page" : undefined} style={{ fontWeight: 500 }}>{ch.label}</a>
              ))}
            </div>
          );
        }
        const open = isOpen(part);
        const toggle = () => setClosed((c) => ({ ...c, [part.id]: open }));
        return (
          <div key={part.id} ref={active ? activeRef : undefined}>
            <div className={active ? "rdr-part is-active" : "rdr-part"}>
              {part.href ? (
                <a href={part.href} onClick={onNavigate} className="rdr-part-label">{part.label}</a>
              ) : (
                <button onClick={toggle} className="rdr-part-label">{part.label}</button>
              )}
              <button onClick={toggle} aria-label={open ? "collapse part" : "expand part"} aria-expanded={open} className="rdr-part-toggle">
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {open && part.chapters.map((ch) => (
              <a key={ch.href} href={ch.href} onClick={onNavigate} className="rdr-nav-row" aria-current={ch.active ? "page" : undefined}>
                <span className="rdr-nav-num">{ch.n}</span>
                <span>{ch.label}</span>
              </a>
            ))}
          </div>
        );
      })}
    </nav>
  );
  if (embedded) return list;
  return (
    <aside className="rdr-nav" style={{ width }}>
      {list}
      {onStartDrag && <div onPointerDown={onStartDrag} title={t.resize} className="rdr-resize" style={{ right: -4 }} />}
    </aside>
  );
}

function SidebarExternalLinks({ t }: { t: Strings }) {
  return (
    <div className="rdr-nav-links">
      {SIDEBAR_EXTERNAL_LINKS.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="rdr-nav-row">{t[link.labelKey]} ↗</a>
      ))}
    </div>
  );
}

function TocLinks({ chapter, activeId, onNavigate }: { chapter: ChapterData; activeId: string; onNavigate?: () => void }) {
  return (
    <nav className="rdr-toc-list">
      {chapter.headings.map((h) => {
        const cls = ["rdr-toc-link", h.level === 3 ? "is-l3" : "", activeId === h.id ? "is-active" : ""].filter(Boolean).join(" ");
        return <a key={h.id} href={`#${h.id}`} onClick={onNavigate} className={cls} aria-current={activeId === h.id ? "location" : undefined}>{h.text}</a>;
      })}
    </nav>
  );
}

function MiniToc({ t, chapter, activeId, onClose, width = 208, onStartDrag }: { t: Strings; chapter: ChapterData; activeId: string; onClose: () => void; width?: number; onStartDrag?: (e: React.PointerEvent) => void }) {
  return (
    <aside className="rdr-toc" style={{ width }}>
      {onStartDrag && <div onPointerDown={onStartDrag} title={t.resize} className="rdr-resize" style={{ left: -4 }} />}
      <div className="rdr-toc-scroll">
        <div className="rdr-toc-head">
          <span className="rdr-toc-title">{t.onThisPage}</span>
          <button onClick={onClose} aria-label="close" className="rdr-btn" style={{ width: 22, height: 22 }}>
            <Icon d={<path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />} size={12} />
          </button>
        </div>
        <TocLinks chapter={chapter} activeId={activeId} />
      </div>
    </aside>
  );
}

function PrevNextNav({ chapter, t }: { chapter: ChapterData; t: Strings }) {
  if (!chapter.prev && !chapter.next) return null;
  return (
    <nav className="rdr-pager" aria-label={`${t.prev} / ${t.next}`}>
      {chapter.prev && (
        <a href={chapter.prev.href} rel="prev">
          <div className="rdr-pager-kicker">← {t.prev}</div>
          <div className="rdr-pager-title">{chapter.prev.label}</div>
        </a>
      )}
      {chapter.next && (
        <a href={chapter.next.href} rel="next" className="is-next">
          <div className="rdr-pager-kicker">{t.next} →</div>
          <div className="rdr-pager-title">{chapter.next.label}</div>
        </a>
      )}
    </nav>
  );
}

// The book is written in the open, so each page ends by saying so: one footer
// line offering the two ways a reader can act on what they just read, both
// landing on this exact chapter rather than on the repository's front door.
function PageFooter({ chapter, t }: { chapter: ChapterData; t: Strings }) {
  const here = pageUrl(chapter.lang, chapter.path);
  return (
    <footer className="rdr-footer">
      <span><span className="rdr-footer-mark"><GitHubMark size={14} /></span>{t.contributePrompt}</span>
      <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
        <a href={issueUrl(chapter.title, here)} target="_blank" rel="noreferrer">{t.reportIssue} ↗</a>
        <span aria-hidden style={{ opacity: 0.5 }}>·</span>
        <a href={editUrl(chapter.sourcePath)} target="_blank" rel="noreferrer">{t.editPage} ↗</a>
      </span>
    </footer>
  );
}

function SettingsPanel({ t, s, set, chapter }:{ t: Strings; s: ReaderSettings; set: (p: Partial<ReaderSettings>) => void; chapter: ChapterData }) {
  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 };
  const label: React.CSSProperties = { fontFamily: "var(--font-ui)", fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 500, color: "var(--fg-3)", flex: "none" };
  const seg: React.CSSProperties = { display: "flex", gap: 2, padding: 2, background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)" };
  const langSeg: React.CSSProperties = { ...seg, width: 150, flex: "none" };
  const segBtn = (active: boolean): React.CSSProperties => ({
    border: "none", cursor: "pointer", minWidth: 34, fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500,
    padding: "4px 10px", borderRadius: "var(--radius-sm)", color: active ? "var(--bg-surface)" : "var(--fg-2)", background: active ? "var(--accent)" : "transparent",
  });
  const langChoice = (value: Lang, text: string) => {
    const active = chapter.lang === value;
    const style: React.CSSProperties = { ...segBtn(active), flex: "1 1 0", minWidth: 0, cursor: active ? "default" : "pointer", textAlign: "center", textDecoration: "none" };
    if (active) return <span key={value} aria-current="page" style={style}>{text}</span>;
    return <a key={value} href={chapter.langHref} style={style}>{text}</a>;
  };
  const Seg = <T extends string>(cur: T, opts: { v: T; l: string }[], on: (v: T) => void) => (
    <div style={seg}>{opts.map((o) => <button key={o.v} style={segBtn(cur === o.v)} onClick={() => on(o.v)}>{o.l}</button>)}</div>
  );
  return (
    <div className="rdr-pop" role="dialog" aria-label={t.settings} style={{ width: 276, padding: "14px 14px 16px" }}>
      <div style={{ ...row, marginTop: 0 }}><span style={label}>{t.language}</span><div style={langSeg}>{langChoice("en", "English")}{langChoice("zh", "中文")}</div></div>
      <div style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 7 }}>
        <span style={label}>{t.palette}</span>
        <div style={{ ...seg, width: "100%" }}>
          {([{ v: "ink", l: t.ink }, { v: "clay", l: t.clay }, { v: "rose", l: t.rose }] as { v: Palette; l: string }[]).map((o) => (
            <button key={o.v} style={{ ...segBtn(s.palette === o.v), flex: 1 }} onClick={() => set({ palette: o.v })}>{o.l}</button>
          ))}
        </div>
      </div>
      <div style={row}><span style={label}>{t.theme}</span>{Seg(s.theme, [{ v: "light", l: t.light }, { v: "dark", l: t.dark }], (v) => set({ theme: v as ReaderSettings["theme"] }))}</div>
      <div style={row}><span style={label}>{t.body}</span>{Seg(s.serifBody ? "kai" : "sans", [{ v: "sans", l: t.sans }, { v: "kai", l: t.kai }], (v) => set({ serifBody: v === "kai" }))}</div>
      <div style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 7 }}>
        <span style={label}>{t.layout}</span>
        <div style={{ ...seg, width: "100%" }}>
          {([{ v: "manuscript", l: t.manuscript }, { v: "codex", l: t.codex }, { v: "atlas", l: t.atlas }] as { v: Layout; l: string }[]).map((o) => (
            // "Manuscript" is the longest label in the popover, so this row
            // trades side padding for room instead of widening the dialog.
            <button key={o.v} style={{ ...segBtn(s.layout === o.v), flex: 1, minWidth: 0, padding: "5px 4px" }} onClick={() => set({ layout: o.v })}>{o.l}</button>
          ))}
        </div>
      </div>
      <div style={row}>
        <span style={label}>{t.size}</span>
        <div style={{ ...seg, alignItems: "center" }}>
          <button style={{ ...segBtn(false), color: "var(--fg-1)", fontSize: 15 }} onClick={() => set({ fontScale: Math.max(0.8, +(s.fontScale - 0.1).toFixed(1)) })}>−</button>
          <span style={{ minWidth: 42, textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--fg-1)" }}>{Math.round(s.fontScale * 100)}%</span>
          <button style={{ ...segBtn(false), color: "var(--fg-1)", fontSize: 15 }} onClick={() => set({ fontScale: Math.min(1.4, +(s.fontScale + 0.1).toFixed(1)) })}>+</button>
        </div>
      </div>
    </div>
  );
}
