// The reader shell: a faithful React port of the approved "AI 基建 Reader"
// design. Renders chrome (top bar, full-book sidebar, glass mini-TOC, settings,
// chapter opener) around a compiled article body. SSR-safe: all browser access
// is guarded and runs in effects so renderToString works.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChapterData, Lang, Layout, Palette, ReaderSettings } from "./types.ts";
import { DEFAULT_SETTINGS } from "./types.ts";

type Strings = {
  sidebar: string; onThisPage: string; settings: string; search: string;
  palette: string; ink: string; clay: string; theme: string; light: string; dark: string;
  body: string; sans: string; kai: string; size: string; layout: string;
  codex: string; manuscript: string; atlas: string; prev: string; next: string; lang: string;
};

const STRINGS: Record<Lang, Strings> = {
  zh: {
    sidebar: "目录侧栏", onThisPage: "本页目录", settings: "阅读设置", search: "搜索章节…",
    palette: "配色", ink: "墨纸", clay: "靛蓝", theme: "主题", light: "浅色", dark: "深色",
    body: "正文字体", sans: "黑体", kai: "楷体", size: "字号", layout: "版式",
    codex: "典藏", manuscript: "手稿", atlas: "图册", prev: "上一章", next: "下一章", lang: "EN",
  },
  en: {
    sidebar: "Sidebar", onThisPage: "On this page", settings: "Reading settings", search: "Search chapters…",
    palette: "Palette", ink: "Ink", clay: "Azure", theme: "Theme", light: "Light", dark: "Dark",
    body: "Body font", sans: "Sans", kai: "Kai", size: "Text size", layout: "Layout",
    codex: "Codex", manuscript: "Manuscript", atlas: "Atlas", prev: "Previous", next: "Next", lang: "中",
  },
} as const;

const LS_KEY = "aaai-reader-settings";

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
  const mainRef = useRef<HTMLElement>(null);

  // hydrate persisted settings + viewport class on the client
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setS((prev) => ({ ...prev, ...JSON.parse(raw) }));
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

  // reading progress (window is the scroll container) + active heading
  useEffect(() => {
    let ticking = false;
    const ids = chapter.headings.map((h) => h.id);
    const update = () => {
      ticking = false;
      const d = document.documentElement;
      const max = d.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      let cur = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 90) cur = id;
      }
      setActiveId(cur);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [chapter.headings]);

  const set = (patch: Partial<ReaderSettings>) => setS((p) => ({ ...p, ...patch }));
  const fontScale = Math.min(1.4, Math.max(0.8, s.fontScale));

  const showSidebar = s.layout !== "manuscript" && !mobile && !s.navCollapsed;
  const showMiniToc = s.layout === "codex" && !mobile && !s.tocCollapsed;
  const contentMax = s.layout === "manuscript" ? "660px" : s.layout === "atlas" ? "720px" : "700px";
  const bodyFont = s.serifBody ? "var(--font-cjk)" : "var(--font-ui)";

  const iconBtn = (active: boolean): React.CSSProperties => ({
    flex: "none", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1px solid var(--border-strong)", background: active ? "var(--bg-raised)" : "var(--bg)",
    borderRadius: "var(--radius-md)", color: "var(--fg-1)", cursor: "pointer",
  });

  return (
    <div
      className="reader"
      data-palette={s.palette}
      data-theme={s.theme}
      data-layout={s.layout}
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        background: "var(--bg)", color: "var(--fg-1)", fontFamily: "var(--font-ui)",
        fontSize: `calc(18px * ${fontScale})`,
      }}
    >
      {/* ===== TOP BAR ===== */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50, flex: "none", height: 54, display: "flex",
        alignItems: "center", gap: 12, padding: "0 14px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
      }}>
        <button onClick={() => (mobile ? setDrawer((d) => !d) : set({ navCollapsed: !s.navCollapsed }))}
          title={t.sidebar} aria-label={t.sidebar} style={iconBtn(!s.navCollapsed)}>
          <Icon d={<><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="6.5" y1="3" x2="6.5" y2="13" /></>} />
        </button>

        <a href={`${chapter.prefix}index.html`} style={{ display: "flex", alignItems: "center", gap: 9, flex: "none", color: "var(--fg-1)", textDecoration: "none" }}>
          <svg width={22} height={22} viewBox="0 0 32 32" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 16c0-5 3.5-8 8-8s8 3 8 8-3.5 8-8 8M16 24c-5 0-8-3.5-8-8" />
          </svg>
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: lang === "zh" ? "normal" : "italic", fontSize: 21, letterSpacing: "-.01em" }}>
            {lang === "zh" ? "AI 基建" : "AI Infra"}
          </span>
        </a>

        {!mobile && (
          <nav aria-label="breadcrumb" style={{
            display: "flex", alignItems: "center", gap: 9, flex: "none", paddingLeft: 13, marginLeft: 2,
            borderLeft: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 11,
            letterSpacing: ".02em", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden",
          }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{chapter.partLabel}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: "var(--fg-1)" }}>{chapter.title}</span>
          </nav>
        )}

        <div style={{ flex: 1 }} />

        {s.layout === "codex" && !mobile && (
          <button onClick={() => set({ tocCollapsed: !s.tocCollapsed })} title={t.onThisPage} aria-label={t.onThisPage} style={iconBtn(!s.tocCollapsed)}>
            <Icon d={<><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="9.5" y1="3" x2="9.5" y2="13" /></>} />
          </button>
        )}

        <a href={chapter.langHref} style={{
          flex: "none", height: 34, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6,
          border: "1px solid var(--border-strong)", background: "var(--bg)", borderRadius: "var(--radius-md)",
          color: "var(--fg-1)", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
        }}>{t.lang}</a>

        <div style={{ position: "relative" }}>
          <button onClick={() => setSettingsOpen((o) => !o)} title={t.settings} aria-label={t.settings} style={iconBtn(settingsOpen)}>
            <Icon d={<><path d="M2 4.5h7M11 4.5h3M2 11.5h3M7 11.5h7" strokeLinecap="round" /><circle cx="10" cy="4.5" r="2" /><circle cx="5.5" cy="11.5" r="2" /></>} />
          </button>
          {settingsOpen && <SettingsPanel t={t} s={s} set={set} />}
        </div>
      </header>

      {/* reading progress */}
      <div style={{ flex: "none", height: 2, position: "relative", zIndex: 49 }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${(progress * 100).toFixed(2)}%`, transition: "width .12s linear" }} />
      </div>

      {/* ===== BODY ===== */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {showSidebar && <SidebarTree t={t} chapter={chapter} />}

        <main ref={mainRef} style={{ flex: 1, minWidth: 0 }}>
          <article style={{
            maxWidth: contentMax, margin: "0 auto", padding: mobile ? "26px 18px 60px" : "40px 44px 80px",
            fontFamily: bodyFont, lineHeight: 1.85, color: "var(--fg-2)",
          }}>
            <ChapterOpener chapter={chapter} layout={s.layout} />
            <div className="rdr-article" dangerouslySetInnerHTML={{ __html: chapter.contentHtml }} />
            <PrevNextNav chapter={chapter} t={t} />
          </article>
        </main>

        {showMiniToc && <MiniToc t={t} chapter={chapter} activeId={activeId} onClose={() => set({ tocCollapsed: true })} />}
      </div>

      {/* mobile nav drawer */}
      {mobile && drawer && (
        <>
          <div onClick={() => setDrawer(false)} style={{ position: "fixed", inset: "54px 0 0", background: "rgba(0,0,0,.42)", zIndex: 60 }} />
          <div style={{ position: "fixed", top: 54, bottom: 0, left: 0, width: 300, maxWidth: "84vw", zIndex: 61, background: "var(--bg-surface)", boxShadow: "var(--shadow-lg)", overflowY: "auto" }}>
            <SidebarTree t={t} chapter={chapter} embedded onNavigate={() => setDrawer(false)} />
          </div>
        </>
      )}
    </div>
  );
}

function ChapterOpener({ chapter, layout }: { chapter: ChapterData; layout: Layout }) {
  if (layout === "manuscript") {
    return (
      <div style={{ textAlign: "center", margin: "8px 0 40px" }}>
        {chapter.chapterNum && <div style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(72px,12vw,120px)", lineHeight: 0.85, color: "var(--accent)" }}>{chapter.chapterNum}</div>}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase", color: "var(--fg-3)", margin: "8px 0 14px" }}>{chapter.eyebrow}</div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "clamp(2.2rem,5vw,3.2rem)", lineHeight: 1.15, color: "var(--fg-1)" }}>{chapter.title}</h1>
        <div style={{ width: 48, height: 2, background: "var(--accent)", margin: "24px auto 0" }} />
      </div>
    );
  }
  if (layout === "atlas") {
    return (
      <div style={{ marginBottom: 34, paddingBottom: 22, borderBottom: "2px solid var(--fg-1)" }}>
        {chapter.chapterNum && <div style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(64px,9vw,92px)", lineHeight: 0.82, color: "var(--fg-1)" }}>{chapter.chapterNum}</div>}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)", margin: "12px 0" }}>{chapter.eyebrow}</div>
        <h1 style={{ fontFamily: "var(--font-ui)", fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.04, fontSize: "clamp(2.2rem,5vw,3.4rem)", color: "var(--fg-1)" }}>{chapter.title}</h1>
      </div>
    );
  }
  // codex
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10 }}>{chapter.eyebrow}</div>
      <h1 style={{ fontFamily: "var(--font-ui)", fontWeight: 600, letterSpacing: "-.025em", lineHeight: 1.1, fontSize: "clamp(2rem,4vw,2.9rem)", color: "var(--fg-1)", marginBottom: 0 }}>{chapter.title}</h1>
    </div>
  );
}

function SidebarTree({ t, chapter, embedded, onNavigate }: { t: Strings; chapter: ChapterData; embedded?: boolean; onNavigate?: () => void }) {
  return (
    <aside style={{ flex: "none", width: 264, ...(embedded ? {} : { borderRight: "1px solid var(--border)" }), background: "var(--bg-surface)", overflowY: "auto", padding: "18px 0 60px", alignSelf: "stretch" }}>
      <div style={{ padding: "0 16px 14px" }}>
        <input placeholder={t.search} disabled style={{
          width: "100%", height: 36, padding: "0 12px", border: "1px solid var(--border-strong)", background: "var(--bg)",
          borderRadius: "var(--radius-md)", color: "var(--fg-1)", fontFamily: "var(--font-ui)", fontSize: 13, outline: "none",
        }} />
      </div>
      <nav>
        {chapter.toc.map((part) => (
          <div key={part.id} style={{ marginBottom: 2 }}>
            {part.single ? (
              part.chapters.map((ch) => (
                <a key={ch.href} href={ch.href} onClick={onNavigate} style={{ display: "block", padding: "7px 18px", fontSize: 13.5, fontWeight: 500, color: ch.active ? "var(--accent)" : "var(--fg-2)", textDecoration: "none", borderLeft: `2px solid ${ch.active ? "var(--accent)" : "transparent"}` }}>{ch.label}</a>
              ))
            ) : (
              <>
                <div style={{ padding: "9px 16px 6px", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--fg-2)" }}>{part.label}</div>
                {part.chapters.map((ch) => (
                  <a key={ch.href} href={ch.href} onClick={onNavigate} style={{
                    display: "flex", gap: 9, padding: "6px 16px 6px 18px", textDecoration: "none",
                    borderLeft: `2px solid ${ch.active ? "var(--accent)" : "transparent"}`, background: ch.active ? "var(--accent-subtle)" : "transparent",
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)", flex: "none", minWidth: 15 }}>{ch.n}</span>
                    <span style={{ fontSize: 13.5, lineHeight: 1.35, color: ch.active ? "var(--accent)" : "var(--fg-2)", fontWeight: ch.active ? 600 : 400 }}>{ch.label}</span>
                  </a>
                ))}
              </>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function MiniToc({ t, chapter, activeId, onClose }: { t: Strings; chapter: ChapterData; activeId: string; onClose: () => void }) {
  return (
    <aside style={{
      position: "absolute", top: 18, right: 18, width: 208, maxHeight: "calc(100% - 36px)", overflowY: "auto", zIndex: 8,
      background: "color-mix(in srgb, var(--bg-surface) 80%, transparent)", backdropFilter: "blur(16px) saturate(160%)",
      WebkitBackdropFilter: "blur(16px) saturate(160%)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-md)", padding: "13px 15px 11px",
    }}>
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

function SettingsPanel({ t, s, set }: { t: Strings; s: ReaderSettings; set: (p: Partial<ReaderSettings>) => void }) {
  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 };
  const label: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--fg-3)", flex: "none" };
  const seg: React.CSSProperties = { display: "flex", gap: 2, padding: 3, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" };
  const segBtn = (active: boolean): React.CSSProperties => ({
    border: "none", cursor: "pointer", minWidth: 30, fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500,
    padding: "4px 11px", borderRadius: "var(--radius-sm)", color: active ? "var(--bg-surface)" : "var(--fg-2)", background: active ? "var(--accent)" : "transparent",
  });
  const Seg = <T extends string>(cur: T, opts: { v: T; l: string }[], on: (v: T) => void) => (
    <div style={seg}>{opts.map((o) => <button key={o.v} style={segBtn(cur === o.v)} onClick={() => on(o.v)}>{o.l}</button>)}</div>
  );
  return (
    <div role="dialog" aria-label={t.settings} style={{
      position: "absolute", top: 42, right: 0, zIndex: 60, width: 264, padding: "14px 16px 16px",
      background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
    }}>
      <div style={{ ...row, marginTop: 0 }}><span style={label}>{t.palette}</span>{Seg<Palette>(s.palette, [{ v: "ink", l: t.ink }, { v: "clay", l: t.clay }], (v) => set({ palette: v }))}</div>
      <div style={row}><span style={label}>{t.theme}</span>{Seg(s.theme, [{ v: "light", l: t.light }, { v: "dark", l: t.dark }], (v) => set({ theme: v as ReaderSettings["theme"] }))}</div>
      <div style={row}><span style={label}>{t.body}</span>{Seg(s.serifBody ? "kai" : "sans", [{ v: "sans", l: t.sans }, { v: "kai", l: t.kai }], (v) => set({ serifBody: v === "kai" }))}</div>
      <div style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 7 }}>
        <span style={label}>{t.layout}</span>
        <div style={{ ...seg, width: "100%" }}>
          {([{ v: "codex", l: t.codex }, { v: "manuscript", l: t.manuscript }, { v: "atlas", l: t.atlas }] as { v: Layout; l: string }[]).map((o) => (
            <button key={o.v} style={{ ...segBtn(s.layout === o.v), flex: 1 }} onClick={() => set({ layout: o.v })}>{o.l}</button>
          ))}
        </div>
      </div>
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
