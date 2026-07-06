// Per-reader account UI: the header login/avatar widget with a "my stuff" menu
// (bookmarks, comments, notes), the per-chapter bookmark button, and the
// view-count + reading-time stats. All talk to the same-origin /api added by the
// Go server and degrade to nothing when logged out / unconfigured.
import { useEffect, useRef, useState } from "react";

export type Me = { sub: string; name: string; avatar: string; admin: boolean; csrf: string } | null;

// One shared /api/me fetch for the header, comments, bookmark button, and stats.
let mePromise: Promise<Me> | null = null;
function fetchMe(): Promise<Me> {
  if (!mePromise) mePromise = fetch("/api/me").then((r) => (r.status === 204 ? null : r.json())).catch(() => null);
  return mePromise;
}
export function useMe(): { me: Me; ready: boolean } {
  const [s, setS] = useState<{ me: Me; ready: boolean }>({ me: null, ready: false });
  useEffect(() => { let on = true; fetchMe().then((me) => on && setS({ me, ready: true })); return () => { on = false; }; }, []);
  return s;
}

const A = {
  en: { login: "Log in", logout: "Log out", bookmarks: "Bookmarks", comments: "My comments", notes: "My notes", empty: "Nothing here yet.", save: "Bookmark", saved: "Saved", views: "Views", readers: "Readers" },
  zh: { login: "登录", logout: "退出", bookmarks: "收藏", comments: "我的评论", notes: "我的笔记", empty: "这里还什么都没有。", save: "收藏", saved: "已收藏", views: "浏览", readers: "读者" },
};

type PageRef = { lang: string; path: string; createdAt: string; body?: string; anchor?: { exact: string } };

function csrfWrite(me: NonNullable<Me>, method: string, url: string, body?: unknown) {
  return fetch(url, { method, headers: { "Content-Type": "application/json", "X-CSRF-Token": me.csrf }, body: body === undefined ? undefined : JSON.stringify(body) });
}

function Avatar({ me, size = 26 }: { me: NonNullable<Me>; size?: number }) {
  return me.avatar
    ? <img src={me.avatar} alt="" width={size} height={size} style={{ borderRadius: "50%", display: "block" }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--bg-raised)", color: "var(--fg-2)", fontSize: 12, fontWeight: 600 }}>{(me.name || "?").trim().slice(0, 1).toUpperCase()}</span>;
}

// HeaderAuth renders the top-right login button or the user avatar + menu.
export function HeaderAuth({ lang }: { lang: "en" | "zh" }) {
  const { me, ready } = useMe();
  const t = A[lang];
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  // Reserve the pill's footprint so the header doesn't jump when auth resolves.
  if (!ready) return <div style={{ flex: "none", width: 64, height: 38 }} />;
  if (!me) return (
    // Smoke-glass pill: inverse-emphasis in the Liquid Glass chrome (matches the
    // round 38px glass buttons beside it, not the old square accent button).
    <a href="/login" className="lq-smoke-btn" style={{ flex: "none", display: "inline-flex", alignItems: "center", height: 38, padding: "0 18px", borderRadius: 999, border: "1px solid transparent", background: "var(--glass-smoke-strong)", color: "var(--glass-smoke-ink)", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>{t.login}</a>
  );
  return (
    <div ref={box} style={{ position: "relative", flex: "none" }}>
      <button onClick={() => setOpen((o) => !o)} title={me.name} aria-label={me.name} style={{ border: 0, background: "none", padding: 2, cursor: "pointer", display: "grid", placeItems: "center" }}><Avatar me={me} /></button>
      {open && <UserMenu me={me} t={t} lang={lang} />}
    </div>
  );
}

function UserMenu({ me, t, lang }: { me: NonNullable<Me>; t: typeof A.en; lang: "en" | "zh" }) {
  const [tab, setTab] = useState<"bookmarks" | "comments" | "notes">("bookmarks");
  const [items, setItems] = useState<PageRef[] | null>(null);
  useEffect(() => {
    setItems(null);
    const url = tab === "bookmarks" ? "/api/bookmarks" : tab === "comments" ? "/api/me/comments" : "/api/me/notes";
    fetch(url).then((r) => r.json()).then(setItems).catch(() => setItems([]));
  }, [tab]);
  const tabBtn = (k: typeof tab, label: string) => (
    <button onClick={() => setTab(k)} style={{ flex: 1, border: 0, background: "none", padding: "8px 4px", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12, color: tab === k ? "var(--fg-1)" : "var(--fg-3)", borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}` }}>{label}</button>
  );
  return (
    <div className="rdr-glass lq-rise" style={{ position: "absolute", top: 46, right: 0, width: 280, zIndex: 60, borderRadius: 18, fontFamily: "var(--font-ui)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <Avatar me={me} size={28} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.name}</span>
        <a href="/logout" style={{ flex: "none", fontSize: 12, color: "var(--fg-3)", textDecoration: "none" }}>{t.logout}</a>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {tabBtn("bookmarks", t.bookmarks)}{tabBtn("comments", t.comments)}{tabBtn("notes", t.notes)}
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto", padding: 6 }}>
        {items === null ? null : items.length === 0 ? (
          <p style={{ margin: 0, padding: 12, fontSize: 12, color: "var(--fg-3)" }}>{t.empty}</p>
        ) : items.map((it, i) => {
          const href = `/${it.lang}/${it.path}`;
          const label = it.body ? truncate(it.body, 60) : it.path || (lang === "zh" ? "首页" : "Home");
          return <a key={i} href={href} style={{ display: "block", padding: "7px 8px", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--fg-1)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-raised)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>{label}</a>;
        })}
      </div>
    </div>
  );
}

function truncate(s: string, n: number) { const f = s.replace(/[#*`>\n]/g, " ").trim(); return f.length > n ? f.slice(0, n) + "…" : f; }

// BookmarkButton toggles the current chapter in the reader's bookmarks.
export function BookmarkButton({ lang, path }: { lang: "en" | "zh"; path: string }) {
  const { me } = useMe();
  const t = A[lang];
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!me) return;
    fetch("/api/bookmarks").then((r) => r.json()).then((bm: PageRef[]) => setOn(bm.some((b) => b.lang === lang && b.path === path))).catch(() => {});
  }, [me, lang, path]);
  if (!me) return null;
  const toggle = async () => { const r = await csrfWrite(me, "PUT", "/api/bookmark", { lang, path }); const d = await r.json(); setOn(!!d.bookmarked); };
  return (
    <button onClick={toggle} title={on ? t.saved : t.save} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: "var(--radius-md)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent-glow)" : "transparent", color: on ? "var(--accent)" : "var(--fg-2)", fontFamily: "var(--font-ui)", fontSize: 13, cursor: "pointer" }}>
      {on ? "★" : "☆"} {on ? t.saved : t.save}
    </button>
  );
}

// ChapterStats records a view and shows the view + reader counts as meta items.
export function ChapterStats({ lang, path }: { lang: "en" | "zh"; path: string }) {
  const t = A[lang];
  const [st, setSt] = useState<{ views: number; visitors: number } | null>(null);
  useEffect(() => {
    fetch("/api/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, path }) })
      .then((r) => (r.ok ? r.json() : null)).then(setSt).catch(() => {});
  }, [lang, path]);
  if (!st) return null;
  const item = (label: string, value: number) => (
    <div className="rdr-meta-item" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span className="rdr-meta-label" style={{ fontSize: 11, color: "var(--fg-3)" }}>{label}</span>
      <span className="rdr-meta-value" style={{ fontSize: 14, color: "var(--fg-1)" }}>{value.toLocaleString()}</span>
    </div>
  );
  return <>{item(t.views, st.views)}{item(t.readers, st.visitors)}</>;
}
