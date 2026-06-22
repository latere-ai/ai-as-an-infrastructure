// The reader shell: a faithful React port of the approved "AI 基建 Reader"
// design. Renders chrome (top bar, full-book sidebar, glass mini-TOC, settings,
// chapter opener) around a compiled article body. SSR-safe: all browser access
// is guarded and runs in effects so renderToString works.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChapterData, Lang, Layout, Palette, ReaderSettings } from "./types.ts";
import { DEFAULT_SETTINGS } from "./types.ts";
import { runSearch, type SearchDoc } from "./search-match.ts";

type Strings = {
  sidebar: string; onThisPage: string; settings: string; search: string;
  palette: string; ink: string; clay: string; rose: string; theme: string; light: string; dark: string;
  body: string; sans: string; kai: string; size: string; layout: string;
  codex: string; manuscript: string; atlas: string; prev: string; next: string; language: string; resize: string;
  author: string; updated: string; readtimeLabel: string; noResults: string;
  aboutAuthor: string; aboutLatere: string;
};

const STRINGS: Record<Lang, Strings> = {
  zh: {
    sidebar: "目录侧栏", onThisPage: "本页目录", settings: "阅读设置", search: "搜索章节…",
    palette: "配色", ink: "墨纸", clay: "靛蓝", rose: "玫瑰", theme: "主题", light: "浅色", dark: "深色",
    body: "正文字体", sans: "黑体", kai: "楷体", size: "字号", layout: "版式",
    codex: "典藏", manuscript: "手稿", atlas: "图册", prev: "上一章", next: "下一章", language: "语言", resize: "拖动调整宽度",
    author: "作者", updated: "更新于", readtimeLabel: "阅读时长", noResults: "没有匹配的结果",
    aboutAuthor: "关于作者", aboutLatere: "关于 Latere AI",
  },
  en: {
    sidebar: "Sidebar", onThisPage: "On this page", settings: "Reading settings", search: "Search chapters…",
    palette: "Palette", ink: "Ink", clay: "Azure", rose: "Rose", theme: "Theme", light: "Light", dark: "Dark",
    body: "Body font", sans: "Sans", kai: "Kai", size: "Text size", layout: "Layout",
    codex: "Codex", manuscript: "Manuscript", atlas: "Atlas", prev: "Previous", next: "Next", language: "Language", resize: "Drag to resize",
    author: "Author", updated: "Updated", readtimeLabel: "Reading time", noResults: "No matching results",
    aboutAuthor: "About Author", aboutLatere: "About Latere AI",
  },
} as const;

const LS_KEY = "aaai-reader-settings";

const SIDEBAR_EXTERNAL_LINKS = [
  { labelKey: "aboutAuthor", href: "https://changkun.de" },
  { labelKey: "aboutLatere", href: "https://latere.ai" },
] as const;

// latere brand mark (from ../latere-ai LatereLogoMark.vue).
function LatereLogo() {
  return (
    <svg viewBox="147 279 736 425" width={26} height={15} fill="var(--accent)" aria-hidden style={{ flex: "none" }}>
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
  const mainRef = useRef<HTMLElement>(null);
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
        // theme/palette live on <html> (a blocking head script already applied
        // them before paint to avoid a flash). Re-assert here so the dev server,
        // which omits that script, still tracks the persisted choice.
        if (saved.theme) document.documentElement.dataset.theme = saved.theme;
        if (saved.palette) document.documentElement.dataset.palette = saved.palette;
      }
    } catch {}
    const mq = window.matchMedia("(max-width: 991px)");
    const onMq = () => setMobile(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

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

  // The <main> column is the scroll container (the design model: a fixed-height
  // shell with a non-moving header). Progress + active heading track it.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let ticking = false;
    const ids = chapter.headings.map((h) => h.id);
    const update = () => {
      ticking = false;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
      let cur = ids[0] ?? "";
      for (const id of ids) {
        const h = el.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
        if (h && h.getBoundingClientRect().top <= 90) cur = id;
      }
      setActiveId(cur);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [chapter.headings]);

  // Own the #fragment scroll. The browser's native anchor scroll is unreliable
  // in this inner-scroll shell: arriving via a deep-link it can scroll the
  // DOCUMENT (pushing the fixed header off-screen) rather than <main>, and the
  // overflow:hidden lock then traps it there with no way back. So always pin the
  // document to the top (the header can never leave) and scroll <main> to the
  // target ourselves, with a small gap below the header.
  useEffect(() => {
    const align = () => {
      const se = document.scrollingElement;
      if (se) se.scrollTop = 0;
      const main = mainRef.current;
      const id = decodeURIComponent(location.hash.replace(/^#/, ""));
      if (!main || !id) return;
      const el = main.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (!el) return;
      const delta = el.getBoundingClientRect().top - main.getBoundingClientRect().top;
      main.scrollTo({ top: main.scrollTop + delta - 16, behavior: "auto" });
    };
    // The document must never scroll in this fixed shell; snap any stray scroll
    // (a late/programmatic native fragment scroll) back so the header can't be
    // pushed off. document-level 'scroll' does not fire for <main>'s own scroll.
    const pin = () => { const se = document.scrollingElement; if (se && se.scrollTop !== 0) se.scrollTop = 0; };
    // Correct across hydration + late native scroll + async diagram layout.
    const r1 = requestAnimationFrame(() => requestAnimationFrame(align));
    const t1 = setTimeout(align, 120);
    window.addEventListener("hashchange", align);
    document.addEventListener("scroll", pin, { passive: true });
    return () => {
      cancelAnimationFrame(r1); clearTimeout(t1);
      window.removeEventListener("hashchange", align);
      document.removeEventListener("scroll", pin);
    };
  }, [chapter.path]);

  // Initialize the article runtimes (mermaid, interactive viz/3d, runnable
  // Python, table wrapping) AFTER React has hydrated the article — they operate
  // on dangerouslySetInnerHTML nodes that React owns, so booting them on
  // DOMContentLoaded (the old static-renderer path) races hydration and leaves them dead.
  useEffect(() => {
    let cancelled = false;
    const w = window as unknown as Record<string, (() => void) | undefined>;
    const boot = () => {
      if (cancelled) return;
      w.__rdrViz?.();
      w.__rdrLive?.();
      w.__rdrTables?.();
      w.__rdrMermaid?.();
    };
    // mermaid loads as an async CDN module; let it re-run once ready.
    w.__rdrRuntimesReady = () => { if (!cancelled) w.__rdrMermaid?.(); };
    const raf = requestAnimationFrame(() => requestAnimationFrame(boot));
    return () => { cancelled = true; cancelAnimationFrame(raf); delete w.__rdrRuntimesReady; };
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
  // re-sets innerHTML over the SVG that mermaid mutated into the .mermaid nodes
  // (the boot effect only runs once per chapter, so a reset would never recover).
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
    }
    setS((p) => ({ ...p, ...patch }));
  };
  const fontScale = Math.min(1.4, Math.max(0.8, s.fontScale));

  const showSidebar = !mobile && !s.navCollapsed;
  const showMiniToc = !mobile && !s.tocCollapsed;
  const bodyFont = s.serifBody ? "var(--font-cjk)" : "var(--font-ui)";
  const showBreadcrumbTitle = !chapter.isPartIntro && !!chapter.chapterNum && chapter.title !== chapter.crumbChapter;

  const iconBtn = (active: boolean): React.CSSProperties => ({
    flex: "none", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1px solid var(--border-strong)", background: active ? "var(--bg-raised)" : "var(--bg)",
    borderRadius: "var(--radius-md)", color: "var(--fg-1)", cursor: "pointer",
  });

  return (
    <div
      className="reader"
      data-layout="codex"
      style={{
        height: "100%", overflow: "hidden", display: "flex", flexDirection: "column",
        background: "var(--bg)", color: "var(--fg-1)", fontFamily: "var(--font-ui)",
        fontSize: `calc(18px * ${fontScale})`,
      }}
    >
      {/* ===== TOP BAR (fixed: the shell is fixed-height, only <main> scrolls) ===== */}
      <header style={{
        zIndex: 50, flex: "none", height: 54, display: "flex",
        alignItems: "center", gap: 12, padding: "0 14px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}>
        <button onClick={() => (mobile ? (setTocDrawer(false), setDrawer((d) => !d)) : set({ navCollapsed: !s.navCollapsed }))}
          title={t.sidebar} aria-label={t.sidebar} style={iconBtn(mobile ? drawer : !s.navCollapsed)}>
          <Icon d={<><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="6.5" y1="3" x2="6.5" y2="13" /></>} />
        </button>

        <a href={chapter.prefix || "./"} style={{ display: "flex", alignItems: "center", gap: 9, flex: "none", color: "var(--fg-1)", textDecoration: "none" }}>
          <LatereLogo />
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: lang === "zh" ? "normal" : "italic", fontSize: 21, letterSpacing: "-.01em" }}>
            {lang === "zh" ? "AI 基建" : "AI Infra"}
          </span>
        </a>

        {!mobile && (
          <nav aria-label="breadcrumb" style={{
            display: "flex", alignItems: "center", gap: 9, flex: "1 1 auto", minWidth: 0, paddingLeft: 13, marginLeft: 2,
            borderLeft: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 11,
            letterSpacing: ".02em", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden",
          }}>
            <span style={{ flex: "none", overflow: "hidden", textOverflow: "ellipsis" }}>{chapter.partShort}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ flex: "none", color: "var(--fg-1)", whiteSpace: "nowrap" }}>{chapter.crumbChapter}</span>
            {showBreadcrumbTitle && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: "var(--fg-1)", whiteSpace: "nowrap" }}>{chapter.title}</span>
              </>
            )}
          </nav>
        )}

        <div style={{ flex: "0 1 18px" }} />

        {(!mobile || chapter.headings.length > 0) && (
          <button onClick={() => (mobile ? (setDrawer(false), setTocDrawer((d) => !d)) : set({ tocCollapsed: !s.tocCollapsed }))}
            title={t.onThisPage} aria-label={t.onThisPage} style={iconBtn(mobile ? tocDrawer : !s.tocCollapsed)}>
            <Icon d={<><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="9.5" y1="3" x2="9.5" y2="13" /></>} />
          </button>
        )}

        <div ref={settingsRef} style={{ position: "relative" }}>
          <button onClick={() => setSettingsOpen((o) => !o)} title={t.settings} aria-label={t.settings} style={iconBtn(settingsOpen)}>
            <Icon d={<><path d="M2 4.5h7M11 4.5h3M2 11.5h3M7 11.5h7" strokeLinecap="round" /><circle cx="10" cy="4.5" r="2" /><circle cx="5.5" cy="11.5" r="2" /></>} />
          </button>
          {settingsOpen && <SettingsPanel t={t} s={s} set={set} chapter={chapter} />}
        </div>
      </header>

      {/* reading progress */}
      <div style={{ flex: "none", height: 2, position: "relative", zIndex: 49 }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${(progress * 100).toFixed(2)}%`, transition: "width .12s linear" }} />
      </div>

      {/* ===== BODY (only this row scrolls; header stays put) ===== */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        {showSidebar && <SidebarTree t={t} chapter={chapter} width={s.navW} onOpenSearch={() => setSearchOpen(true)} />}
        {showSidebar && (
          <div onPointerDown={(e) => startDrag("nav", e)} title={t.resize} className="rdr-resize"
            style={{ flex: "none", width: 7, marginLeft: -1, cursor: "col-resize", zIndex: 6 }} />
        )}

        <main ref={mainRef} style={{ flex: 1, minWidth: 0, overflowY: "auto", overscrollBehavior: "none", scrollBehavior: "smooth" }}>
          <article style={{
            maxWidth: "none", margin: 0,
            padding: mobile ? "26px 18px 60px" : "40px 56px 80px",
            fontFamily: bodyFont, lineHeight: 1.85, color: "var(--fg-2)",
          }}>
            <ChapterOpener chapter={chapter} t={t} />
            {articleBody}
            <PrevNextNav chapter={chapter} t={t} />
          </article>
        </main>

        {showMiniToc && (
          <MiniToc t={t} chapter={chapter} activeId={activeId} width={s.tocW}
            onStartDrag={(e) => startDrag("toc", e)} onClose={() => set({ tocCollapsed: true })} />
        )}
      </div>

      {/* mobile nav drawer */}
      {mobile && drawer && (
        <>
          <div onClick={() => setDrawer(false)} style={{ position: "fixed", inset: "54px 0 0", background: "rgba(0,0,0,.42)", zIndex: 60 }} />
          <div style={{ position: "fixed", top: 54, bottom: 0, left: 0, width: 300, maxWidth: "84vw", zIndex: 61, background: "var(--bg-surface)", boxShadow: "var(--shadow-lg)", overflowY: "auto" }}>
            <SidebarTree t={t} chapter={chapter} embedded onNavigate={() => setDrawer(false)}
              onOpenSearch={() => { setDrawer(false); setSearchOpen(true); }} />
          </div>
        </>
      )}

      {/* mobile "on this page" drawer */}
      {mobile && tocDrawer && (
        <>
          <div onClick={() => setTocDrawer(false)} style={{ position: "fixed", inset: "54px 0 0", background: "rgba(0,0,0,.42)", zIndex: 60 }} />
          <div style={{ position: "fixed", top: 54, bottom: 0, right: 0, width: 300, maxWidth: "84vw", zIndex: 61, background: "var(--bg-surface)", boxShadow: "var(--shadow-lg)", overflowY: "auto", padding: "16px 18px 24px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 12 }}>{t.onThisPage}</div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {chapter.headings.map((h) => (
                <a key={h.id} href={`#${h.id}`} onClick={() => setTocDrawer(false)} style={{
                  display: "block", padding: "7px 0 7px 12px", textDecoration: "none",
                  borderLeft: `2px solid ${activeId === h.id ? "var(--accent)" : "transparent"}`,
                  marginLeft: h.level === 3 ? 12 : 0,
                  fontSize: 13.5, lineHeight: 1.4, color: activeId === h.id ? "var(--accent)" : "var(--fg-2)", fontWeight: activeId === h.id ? 600 : 400,
                }}>{h.text}</a>
              ))}
            </nav>
          </div>
        </>
      )}

      {searchOpen && <SearchModal t={t} prefix={chapter.prefix} onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function MetaRow({ chapter, t }: { chapter: ChapterData; t: Strings }) {
  const items = [
    { l: t.author, v: chapter.author },
    { l: t.updated, v: chapter.updated },
    { l: t.readtimeLabel, v: chapter.readtime },
  ].filter((i) => i.v);
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      {items.map((i) => (
        <div key={i.l}>
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 3 }}>{i.l}</div>
          <div style={{ fontSize: 14, color: "var(--fg-1)" }}>{i.v}</div>
        </div>
      ))}
    </div>
  );
}

function ChapterOpener({ chapter, t }: { chapter: ChapterData; t: Strings }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10 }}>{chapter.eyebrow}</div>
      <h1 style={{ fontFamily: "var(--font-ui)", fontWeight: 600, letterSpacing: "-.025em", lineHeight: 1.1, fontSize: "clamp(2rem,4vw,2.9rem)", color: "var(--fg-1)", marginBottom: 14 }}>{chapter.title}</h1>
      <MetaRow chapter={chapter} t={t} />
    </div>
  );
}

// The sticky search trigger that lives at the top of the sidebar. It looks like
// an input but only opens the spotlight modal (so the real search field has one
// home, reachable from the sidebar, the mobile drawer, and Cmd/Ctrl+K).
function SearchTrigger({ t, onOpen }: { t: Strings; onOpen: () => void }) {
  return (
    <div style={{ flex: "none", padding: "0 16px 14px" }}>
      <button onClick={onOpen} aria-label={t.search} style={{
        width: "100%", height: 36, padding: "0 10px 0 12px", display: "flex", alignItems: "center", gap: 8,
        border: "1px solid var(--border-strong)", background: "var(--bg)", borderRadius: "var(--radius-md)",
        color: "var(--fg-3)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, textAlign: "left",
      }}>
        <Icon d={<><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></>} size={14} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.search}</span>
        <kbd style={{
          flex: "none", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: ".02em",
          color: "var(--fg-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1px 5px",
        }}>⌘K</kbd>
      </button>
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
      padding: "12vh 16px 16px", background: "rgba(0,0,0,.42)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onKey} className="rd-rev" role="dialog" aria-modal="true" aria-label={t.search} style={{
        width: "100%", maxWidth: 600, maxHeight: "76vh", display: "flex", flexDirection: "column", overflow: "hidden",
        background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)",
      }}>
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "0 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ flex: "none", color: "var(--fg-3)" }}>
            <Icon d={<><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></>} size={17} />
          </span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} style={{
            flex: 1, height: 52, border: "none", background: "transparent", color: "var(--fg-1)",
            fontFamily: "var(--font-ui)", fontSize: 16, outline: "none",
          }} />
          <kbd style={{
            flex: "none", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--fg-3)",
            border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "2px 6px",
          }}>ESC</kbd>
        </div>
        {results.length > 0 && (
          <div ref={listRef} style={{ overflowY: "auto", padding: 6 }}>
            {results.map(({ doc: d, snip }, i) => (
              <a key={`${d.href}#${d.anchor}-${i}`} href={hrefFor(d)} onMouseEnter={() => setSel(i)} style={{
                display: "block", padding: "9px 12px", textDecoration: "none", borderRadius: "var(--radius-md)",
                color: "var(--fg-1)", background: i === sel ? "var(--accent-subtle)" : "transparent",
              }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", marginRight: 6 }}>{d.num || "·"}</span>
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

function SidebarTree({ t, chapter, embedded, onNavigate, onOpenSearch, width = 264 }: { t: Strings; chapter: ChapterData; embedded?: boolean; onNavigate?: () => void; onOpenSearch: () => void; width?: number }) {
  // Parts collapse; the part holding the active chapter starts open.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const isOpen = (part: { id: string; chapters: { active?: boolean }[] }) =>
    closed[part.id] === undefined ? true : !closed[part.id];
  // On load, scroll the nav so the part holding the active chapter sits at the
  // top of the list. Setting scrollTop past the max clamps to the bottom, so a
  // part near the end lands as far up as it can: visible either way.
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sc = scrollRef.current, el = activeRef.current;
    if (sc && el) sc.scrollTop = el.offsetTop;
  }, []);
  return (
    <aside style={{ flex: "none", width: embedded ? "100%" : width, height: embedded ? "100%" : undefined, ...(embedded ? {} : { borderRight: "1px solid var(--border)" }), background: "var(--bg-surface)", display: "flex", flexDirection: "column", paddingTop: 18, alignSelf: "stretch", minHeight: 0 }}>
      <SearchTrigger t={t} onOpen={onOpenSearch} />
      <nav ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", paddingBottom: 60 }}>
        <SidebarExternalLinks t={t} />
        {chapter.toc.map((part) => {
          const active = !!part.active || part.chapters.some((ch) => ch.active);
          if (part.single) {
            return (
              <div key={part.id} ref={active ? activeRef : undefined} style={{ marginBottom: 2 }}>
                {part.chapters.map((ch) => (
                  <a key={ch.href} href={ch.href} onClick={onNavigate} style={{ display: "block", padding: "7px 18px", fontSize: 13.5, fontWeight: 500, color: ch.active ? "var(--accent)" : "var(--fg-2)", textDecoration: "none", borderLeft: `2px solid ${ch.active ? "var(--accent)" : "transparent"}` }}>{ch.label}</a>
                ))}
              </div>
            );
          }
          const open = isOpen(part);
          const labelStyle: React.CSSProperties = {
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: active ? "var(--accent)" : "var(--fg-2)",
            textDecoration: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
          };
          const chevron = (
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="var(--fg-3)" strokeWidth={1.5} style={{ flex: "none", transform: open ? "none" : "rotate(-90deg)", transition: "transform .2s" }}>
              <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          );
          return (
            <div key={part.id} ref={active ? activeRef : undefined} style={{ marginBottom: 2 }}>
              <div style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                padding: "9px 10px 6px 16px", textAlign: "left",
              }}>
                {part.href ? (
                  <a href={part.href} onClick={onNavigate} style={labelStyle}>{part.label}</a>
                ) : (
                  <button onClick={() => setClosed((c) => ({ ...c, [part.id]: open }))} style={{
                    ...labelStyle,
                    display: "block",
                    padding: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}>{part.label}</button>
                )}
                <button onClick={() => setClosed((c) => ({ ...c, [part.id]: open }))} aria-label={open ? "collapse part" : "expand part"} style={{
                  flex: "none", width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: "none", background: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--fg-3)",
                }}>
                  {chevron}
                </button>
              </div>
              {open && part.chapters.map((ch) => (
                <a key={ch.href} href={ch.href} onClick={onNavigate} style={{
                  display: "flex", gap: 9, padding: "6px 16px 6px 18px", textDecoration: "none",
                  borderLeft: `2px solid ${ch.active ? "var(--accent)" : "transparent"}`, background: ch.active ? "var(--accent-subtle)" : "transparent",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)", flex: "none", minWidth: 15 }}>{ch.n}</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.35, color: ch.active ? "var(--accent)" : "var(--fg-2)", fontWeight: ch.active ? 600 : 400 }}>{ch.label}</span>
                </a>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function SidebarExternalLinks({ t }: { t: Strings }) {
  return (
    <div style={{ margin: "0 0 10px", padding: "0 0 10px", borderBottom: "1px solid var(--border)" }}>
      {SIDEBAR_EXTERNAL_LINKS.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noreferrer" style={{
          display: "block",
          padding: "7px 18px",
          fontSize: 13.5,
          fontWeight: 500,
          color: "var(--fg-2)",
          textDecoration: "none",
          borderLeft: "2px solid transparent",
        }}>{t[link.labelKey]}</a>
      ))}
    </div>
  );
}

function MiniToc({ t, chapter, activeId, onClose, width = 208, onStartDrag }: { t: Strings; chapter: ChapterData; activeId: string; onClose: () => void; width?: number; onStartDrag?: (e: React.PointerEvent) => void }) {
  return (
    <aside style={{
      position: "absolute", top: 18, right: 18, width, maxHeight: "calc(100% - 36px)", overflowY: "auto", zIndex: 8,
      background: "color-mix(in srgb, var(--bg-surface) 80%, transparent)", backdropFilter: "blur(16px) saturate(160%)",
      WebkitBackdropFilter: "blur(16px) saturate(160%)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-md)", padding: "13px 15px 11px",
    }}>
      {onStartDrag && <div onPointerDown={onStartDrag} title={t.resize} className="rdr-resize"
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 2, borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)" }} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 11 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--fg-3)" }}>{t.onThisPage}</span>
        <button onClick={onClose} aria-label="close" style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--fg-3)" }}>
          <Icon d={<path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />} size={13} />
        </button>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {chapter.headings.map((h) => (
          <a key={h.id} href={`#${h.id}`} style={{
            display: "block", padding: "5px 0 5px 12px", textDecoration: "none",
            borderLeft: `2px solid ${activeId === h.id ? "var(--accent)" : "transparent"}`,
            marginLeft: h.level === 3 ? 12 : 0,
            fontSize: 12.5, lineHeight: 1.4, color: activeId === h.id ? "var(--accent)" : "var(--fg-2)", fontWeight: activeId === h.id ? 600 : 400,
          }}>{h.text}</a>
        ))}
      </nav>
    </aside>
  );
}

function PrevNextNav({ chapter, t }: { chapter: ChapterData; t: Strings }) {
  const card: React.CSSProperties = {
    flex: 1, minWidth: 200, padding: "16px 18px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)",
    background: "var(--bg-surface)", textDecoration: "none",
  };
  const kicker: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 6 };
  return (
    <nav style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
      {chapter.prev && (
        <a href={chapter.prev.href} style={card}>
          <div style={kicker}>← {t.prev}</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg-1)" }}>{chapter.prev.label}</div>
        </a>
      )}
      {chapter.next && (
        <a href={chapter.next.href} style={{ ...card, textAlign: "right" }}>
          <div style={kicker}>{t.next} →</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg-1)" }}>{chapter.next.label}</div>
        </a>
      )}
    </nav>
  );
}

function SettingsPanel({ t, s, set, chapter }: { t: Strings; s: ReaderSettings; set: (p: Partial<ReaderSettings>) => void; chapter: ChapterData }) {
  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 };
  const label: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--fg-3)", flex: "none" };
  const seg: React.CSSProperties = { display: "flex", gap: 2, padding: 3, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" };
  const langSeg: React.CSSProperties = { ...seg, width: 150, flex: "none" };
  const segBtn = (active: boolean): React.CSSProperties => ({
    border: "none", cursor: "pointer", minWidth: 30, fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500,
    padding: "4px 11px", borderRadius: "var(--radius-sm)", color: active ? "var(--bg-surface)" : "var(--fg-2)", background: active ? "var(--accent)" : "transparent",
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
    <div role="dialog" aria-label={t.settings} style={{
      position: "absolute", top: 42, right: 0, zIndex: 60, width: 264, padding: "14px 16px 16px",
      background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
    }}>
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
      <div style={row}>
        <span style={label}>{t.size}</span>
        <div style={{ ...seg, alignItems: "center" }}>
          <button style={{ ...segBtn(false), color: "var(--fg-1)", fontSize: 15 }} onClick={() => set({ fontScale: Math.max(0.8, +(s.fontScale - 0.1).toFixed(1)) })}>−</button>
          <span style={{ minWidth: 42, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-1)" }}>{Math.round(s.fontScale * 100)}%</span>
          <button style={{ ...segBtn(false), color: "var(--fg-1)", fontSize: 15 }} onClick={() => set({ fontScale: Math.min(1.4, +(s.fontScale + 0.1).toFixed(1)) })}>+</button>
        </div>
      </div>
    </div>
  );
}
