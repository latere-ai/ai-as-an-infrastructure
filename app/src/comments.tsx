// Reader comments: a GitHub-style page thread (markdown body, emoji autocomplete,
// emoji reactions, one level of replies) plus the hooks the inline text-mark
// layer (see inline-marks.tsx) builds on. Talks to the same-origin /api added by
// the Go server; renders nothing destructive (markdown-it with html:false).
import MarkdownIt from "markdown-it";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Anchor as TextAnchor, buildAnchor, findAnchor, markRange, textIndex } from "./anchor.ts";

export type Me = { sub: string; name: string; avatar: string; admin: boolean; csrf: string };
export type Reaction = { emoji: string; count: number; mine: boolean };
export type Anchor = { exact: string; prefix: string; suffix: string; section: string };
export type Comment = {
  id: string;
  parentId?: string;
  author: string;
  avatar: string;
  body: string;
  anchor?: Anchor;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  mine: boolean;
  reactions: Reaction[];
  replies?: Comment[];
};

export const REACTIONS = ["👍", "👎", "❤️", "🎉", "😄", "😕", "🚀", "👀"];

// A small emoji shortcode table for the `:name` autocomplete in the composer.
const EMOJI: Record<string, string> = {
  smile: "😄", grin: "😁", joy: "😂", heart: "❤️", "+1": "👍", thumbsup: "👍",
  "-1": "👎", thumbsdown: "👎", tada: "🎉", rocket: "🚀", eyes: "👀", thinking: "🤔",
  fire: "🔥", bug: "🐛", warning: "⚠️", check: "✅", x: "❌", bulb: "💡",
  confused: "😕", clap: "👏", pray: "🙏", sweat_smile: "😅", sparkles: "✨",
};

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const ui = {
  en: {
    title: "Comments", login: "Log in to comment", logout: "Log out",
    placeholder: "Write a comment… markdown and :emoji: supported", post: "Comment",
    reply: "Reply", edit: "Edit", del: "Delete", save: "Save", cancel: "Cancel",
    deleted: "[deleted]", empty: "No comments yet. Start the discussion.",
    confirmDel: "Delete this comment?", react: "Add reaction", sending: "Posting…",
    mark: "Comment", note: "Private note", moved: "Marks whose text has since moved",
    bold: "Bold", italic: "Italic", tCode: "Code", tLink: "Link", tList: "List",
    tQuote: "Quote", tEmoji: "Emoji", tText: "text",
  },
  zh: {
    title: "评论", login: "登录后评论", logout: "退出",
    placeholder: "写下评论…支持 markdown 与 :emoji:", post: "发表",
    reply: "回复", edit: "编辑", del: "删除", save: "保存", cancel: "取消",
    deleted: "[已删除]", empty: "还没有评论，来开个头。", confirmDel: "删除这条评论？",
    react: "添加表情", sending: "发送中…",
    mark: "评论", note: "私人笔记", moved: "原文已变动的标注",
    bold: "加粗", italic: "斜体", tCode: "代码", tLink: "链接", tList: "列表",
    tQuote: "引用", tEmoji: "表情", tText: "文字",
  },
};

// --- API client (same-origin /api, double-submit CSRF) ---------------------

async function jsonOrNull(r: Response): Promise<any> {
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

function makeApi(csrfRef: { current: string }) {
  const write = (method: string, url: string, body?: unknown) =>
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfRef.current },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    me: () => fetch("/api/me").then(jsonOrNull) as Promise<Me | null>,
    list: (lang: string, path: string) =>
      fetch(`/api/comments?lang=${lang}&path=${encodeURIComponent(path)}`).then(jsonOrNull) as Promise<Comment[]>,
    create: (b: object) => write("POST", "/api/comments", b).then(async (r) => {
      if (!r.ok) throw new Error((await jsonOrNull(r))?.error || "failed");
      return jsonOrNull(r) as Promise<Comment>;
    }),
    update: (id: string, body: string) => write("PATCH", `/api/comments/${id}`, { body }).then(jsonOrNull),
    del: (id: string) => write("DELETE", `/api/comments/${id}`),
    react: (id: string, emoji: string) => write("PUT", `/api/comments/${id}/reactions/${encodeURIComponent(emoji)}`),
    listNotes: (lang: string, path: string) =>
      fetch(`/api/notes?lang=${lang}&path=${encodeURIComponent(path)}`).then(jsonOrNull) as Promise<Note[]>,
    createNote: (b: object) => write("POST", "/api/notes", b).then(jsonOrNull) as Promise<Note>,
    delNote: (id: string) => write("DELETE", `/api/notes/${id}`),
  };
}
type Api = ReturnType<typeof makeApi>;
export type Note = { id: string; body: string; anchor?: Anchor; createdAt: string };

// --- helpers ----------------------------------------------------------------

function renderMd(s: string): string {
  return md.render(s.replace(/:([a-z0-9_+-]+):/gi, (m, n) => EMOJI[n.toLowerCase()] ?? m));
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const u: [number, string][] = [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]];
  for (const [secs, label] of u) if (s >= secs) return Math.floor(s / secs) + label;
  return s + "s";
}

function Avatar({ src, name }: { src: string; name: string }) {
  const initials = (name || "?").trim().slice(0, 1).toUpperCase();
  return src ? (
    <img src={src} alt="" width={28} height={28} style={{ borderRadius: "50%", flex: "none" }} />
  ) : (
    <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", background: "var(--bg-raised)", color: "var(--fg-2)", fontSize: 13, fontWeight: 600 }}>{initials}</span>
  );
}

// --- composer with :emoji: autocomplete ------------------------------------

const PICKER = ["👍", "👎", "❤️", "🎉", "😄", "😅", "😂", "🤔", "😕", "🙏", "👏", "🔥", "🚀", "✨", "💡", "✅", "❌", "⚠️", "🐛", "👀", "💯", "🙌", "😎", "🤝"];

const toolBtn: React.CSSProperties = {
  width: 28, height: 26, display: "grid", placeItems: "center", border: "1px solid transparent",
  borderRadius: "var(--radius-sm)", background: "none", color: "var(--fg-2)", cursor: "pointer", fontSize: 13,
};

function Composer({ t, busy, initial, onSubmit, onCancel, autoFocus }: {
  t: typeof ui.en; busy: boolean; initial?: string; autoFocus?: boolean;
  onSubmit: (body: string) => void; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial ?? "");
  const [menu, setMenu] = useState<{ items: string[]; from: number } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    const caret = e.target.selectionStart;
    const m = /:([a-z0-9_+-]{1,20})$/i.exec(v.slice(0, caret));
    if (m) {
      const items = Object.keys(EMOJI).filter((k) => k.startsWith(m[1].toLowerCase())).slice(0, 6);
      setMenu(items.length ? { items, from: caret - m[0].length } : null);
    } else setMenu(null);
  };
  const pick = (name: string) => {
    if (!menu || !ref.current) return;
    const caret = ref.current.selectionStart;
    setText((s) => s.slice(0, menu.from) + EMOJI[name] + s.slice(caret));
    setMenu(null);
    ref.current.focus();
  };
  const submit = () => { const b = text.trim(); if (b) { onSubmit(b); setText(""); } };

  // Toolbar transforms operating on the textarea selection.
  const surround = (before: string, after: string, ph = "") => {
    const ta = ref.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const seg = text.slice(s, e) || ph;
    setText(text.slice(0, s) + before + seg + after + text.slice(e));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + seg.length); });
  };
  const prefix = (p: string) => {
    const ta = ref.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const ls = text.lastIndexOf("\n", s - 1) + 1;
    const out = text.slice(ls, e).split("\n").map((l) => p + l).join("\n");
    setText(text.slice(0, ls) + out + text.slice(e));
    requestAnimationFrame(() => ta.focus());
  };
  const insert = (str: string) => {
    const ta = ref.current; if (!ta) return;
    const s = ta.selectionStart;
    setText(text.slice(0, s) + str + text.slice(ta.selectionEnd));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + str.length, s + str.length); });
  };

  const tools: [string, string, () => void, React.CSSProperties?][] = [
    ["B", t.bold, () => surround("**", "**", t.tText), { fontWeight: 700 }],
    ["I", t.italic, () => surround("*", "*", t.tText), { fontStyle: "italic" }],
    ["<>", t.tCode, () => surround("`", "`", "code"), { fontFamily: "var(--font-mono, monospace)", fontSize: 11 }],
    ["🔗", t.tLink, () => surround("[", "](https://)", t.tText)],
    ["•", t.tList, () => prefix("- ")],
    ["❝", t.tQuote, () => prefix("> ")],
  ];

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 2, marginBottom: 6, alignItems: "center" }}>
        {tools.map(([label, title, on, st]) => (
          <button key={label} type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={on}
            style={{ ...toolBtn, ...st }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-raised)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>{label}</button>
        ))}
        <div style={{ position: "relative" }}>
          <button type="button" title={t.tEmoji} onMouseDown={(e) => e.preventDefault()} onClick={() => setEmojiOpen((o) => !o)} style={toolBtn}>😀</button>
          {emojiOpen && (
            <div style={{ position: "absolute", zIndex: 6, top: 30, left: 0, width: 232, display: "flex", flexWrap: "wrap", gap: 1, padding: 6, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)" }}>
              {PICKER.map((e) => <button key={e} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { insert(e); setEmojiOpen(false); }} style={{ border: 0, background: "none", cursor: "pointer", fontSize: 17, padding: 3, lineHeight: 1 }}>{e}</button>)}
            </div>
          )}
        </div>
      </div>
      <textarea
        ref={ref} value={text} onChange={onChange} disabled={busy} autoFocus={autoFocus}
        placeholder={t.placeholder} rows={3}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
        // 16px so iOS Safari does not auto-zoom the page on focus.
        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--fg-1)", fontFamily: "var(--font-ui)", fontSize: 16, lineHeight: 1.5 }}
      />
      {menu && (
        <ul style={{ position: "absolute", zIndex: 5, listStyle: "none", margin: 0, padding: 4, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)" }}>
          {menu.items.map((n) => (
            <li key={n}><button type="button" onMouseDown={(e) => { e.preventDefault(); pick(n); }} style={{ display: "flex", gap: 8, width: "100%", border: 0, background: "none", color: "var(--fg-1)", padding: "4px 8px", cursor: "pointer", font: "inherit" }}>{EMOJI[n]} <span style={{ color: "var(--fg-3)" }}>:{n}:</span></button></li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={submit} disabled={busy || !text.trim()} style={btn(true)}>{busy ? t.sending : t.post}</button>
        {onCancel && <button type="button" onClick={onCancel} style={btn(false)}>{t.cancel}</button>}
      </div>
    </div>
  );
}

// ConfirmModal replaces the browser's native confirm() for destructive actions.
function ConfirmModal({ title, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  title: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 100, fontFamily: "var(--font-ui)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 20, width: 300, boxShadow: "var(--shadow-lg)" }}>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--fg-1)" }}>{title}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={btn(false)}>{cancelLabel}</button>
          <button type="button" autoFocus onClick={onConfirm} style={{ padding: "6px 14px", borderRadius: "var(--radius-sm)", cursor: "pointer", font: "inherit", fontSize: 13, border: "1px solid #a54646", background: "#a54646", color: "#fff" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: "6px 14px", borderRadius: "var(--radius-sm)", cursor: "pointer", font: "inherit", fontSize: 13,
    border: primary ? "1px solid var(--accent)" : "1px solid var(--border)",
    background: primary ? "var(--accent)" : "transparent",
    color: primary ? "#fff" : "var(--fg-2)",
  };
}

// --- reactions --------------------------------------------------------------

function Reactions({ c, me, api, refresh }: { c: Comment; me: Me | null; api: Api; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const toggle = async (emoji: string) => { if (!me) return; await api.react(c.id, emoji); setOpen(false); refresh(); };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
      {c.reactions?.map((r) => (
        <button key={r.emoji} type="button" disabled={!me} onClick={() => toggle(r.emoji)}
          style={{ display: "flex", gap: 4, alignItems: "center", padding: "1px 8px", borderRadius: 999, cursor: me ? "pointer" : "default", fontSize: 13, border: `1px solid ${r.mine ? "var(--accent)" : "var(--border)"}`, background: r.mine ? "var(--accent-glow)" : "transparent", color: "var(--fg-1)" }}>
          {r.emoji} <span style={{ color: "var(--fg-3)" }}>{r.count}</span>
        </button>
      ))}
      {me && (
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => setOpen((o) => !o)} title="react" style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--fg-3)", borderRadius: 999, cursor: "pointer", padding: "1px 8px", fontSize: 13 }}>＋</button>
          {open && (
            <div style={{ position: "absolute", zIndex: 5, display: "flex", gap: 2, padding: 4, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)" }}>
              {REACTIONS.map((e) => <button key={e} type="button" onClick={() => toggle(e)} style={{ border: 0, background: "none", cursor: "pointer", fontSize: 16, padding: 2 }}>{e}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- one comment ------------------------------------------------------------

function CommentItem({ c, me, api, t, refresh, onReply, onDelete }: {
  c: Comment; me: Me | null; api: Api; t: typeof ui.en; refresh: () => void; onReply?: (id: string) => void; onDelete: (c: Comment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = c.mine && !c.deleted;
  const canDel = (c.mine || me?.admin) && !c.deleted;
  return (
    <div id={`rdr-comment-${c.id}`} style={{ display: "flex", gap: 10, scrollMarginTop: 80 }}>
      <Avatar src={c.avatar} name={c.author} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--fg-2)" }}>
          <strong style={{ color: "var(--fg-1)" }}>{c.deleted ? t.deleted : c.author}</strong>
          {!c.deleted && <span> · {timeAgo(c.createdAt)}{c.updatedAt !== c.createdAt ? " ·✎" : ""}</span>}
        </div>
        {c.anchor?.exact && !c.deleted && (
          <blockquote style={{ margin: "4px 0", padding: "2px 8px", borderLeft: "2px solid var(--accent)", color: "var(--fg-3)", fontSize: 13 }}>“{c.anchor.exact}”</blockquote>
        )}
        {editing ? (
          <Composer t={t} busy={false} initial={c.body} autoFocus
            onSubmit={async (b) => { await api.update(c.id, b); setEditing(false); refresh(); }}
            onCancel={() => setEditing(false)} />
        ) : (
          <div className="rdr-cmt-body" style={{ fontSize: 14, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: c.deleted ? `<p>${t.deleted}</p>` : renderMd(c.body) }} />
        )}
        {!c.deleted && <Reactions c={c} me={me} api={api} refresh={refresh} />}
        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12 }}>
          {me && onReply && !c.deleted && <button type="button" onClick={() => onReply(c.id)} style={linkBtn}>{t.reply}</button>}
          {canEdit && <button type="button" onClick={() => setEditing(true)} style={linkBtn}>{t.edit}</button>}
          {canDel && <button type="button" onClick={() => onDelete(c)} style={linkBtn}>{t.del}</button>}
        </div>
        {c.replies?.map((r) => (
          <div key={r.id} style={{ marginTop: 12 }}><CommentItem c={r} me={me} api={api} t={t} refresh={refresh} onDelete={onDelete} /></div>
        ))}
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = { border: 0, background: "none", color: "var(--fg-3)", cursor: "pointer", font: "inherit", fontSize: 12, padding: 0 };

// --- the section ------------------------------------------------------------

export function Comments({ lang, path }: { lang: "en" | "zh"; path: string }) {
  const t = ui[lang];
  const csrfRef = useRef("");
  const api = useMemo(() => makeApi(csrfRef), []);
  const [me, setMe] = useState<Me | null>(null);
  const [list, setList] = useState<Comment[] | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  // inline marking: floating button on selection, then a composer popover.
  const [mark, setMark] = useState<{ anchor: TextAnchor; x: number; y: number } | null>(null);
  const [composing, setComposing] = useState<"comment" | "note" | null>(null);
  const [orphans, setOrphans] = useState<Comment[]>([]);
  const [delTarget, setDelTarget] = useState<Comment | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteView, setNoteView] = useState<{ note: Note; x: number; y: number } | null>(null);

  const refresh = useCallback(() => { api.list(lang, path).then(setList).catch(() => setList([])); }, [api, lang, path]);

  const loadNotes = useCallback(() => { api.listNotes(lang, path).then((n) => setNotes(n ?? [])).catch(() => setNotes([])); }, [api, lang, path]);

  useEffect(() => {
    api.me().then((m) => { setMe(m); if (m) { csrfRef.current = m.csrf; loadNotes(); } }).catch(() => setMe(null));
    refresh();
  }, [api, refresh, loadNotes]);

  const post = async (body: string, parentId?: string, anchor?: TextAnchor) => {
    await api.create({ lang, path, body, parentId: parentId ?? null, anchor: anchor ?? null });
    setReplyTo(null); setMark(null); setComposing(null);
    refresh();
  };
  const postNote = async (body: string, anchor: TextAnchor) => {
    await api.createNote({ lang, path, body, anchor });
    setMark(null); setComposing(null);
    loadNotes();
  };

  // Render inline marks for anchored comments on the article; collect orphans.
  useEffect(() => {
    if (list === null) return;
    const article = document.querySelector(".rdr-article");
    if (!article) return;
    article.querySelectorAll(".rdr-cmt-mark").forEach((m) => {
      const p = m.parentNode!;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
    });
    article.normalize();
    const { text, nodes } = textIndex(article);
    const orphaned: Comment[] = [];
    for (const c of list) {
      if (!c.anchor?.exact || c.deleted) continue;
      const span = findAnchor(text, c.anchor);
      if (!span) { orphaned.push(c); continue; }
      markRange(nodes, span[0], span[1], () => {
        const el = document.createElement("mark");
        el.className = "rdr-cmt-mark";
        el.style.cssText = "background:var(--accent-glow);border-bottom:1px solid var(--accent);cursor:pointer";
        el.onclick = () => flashComment(c.id);
        return el;
      });
    }
    // Private notes: amber marks, visible only to their author. Click shows the
    // note (no orphan list; a note whose text moved just won't render this pass).
    for (const n of notes) {
      if (!n.anchor?.exact) continue;
      const span = findAnchor(text, n.anchor);
      if (!span) continue;
      markRange(nodes, span[0], span[1], () => {
        const el = document.createElement("mark");
        el.className = "rdr-cmt-mark rdr-note-mark";
        el.style.cssText = "background:rgba(224,147,107,.22);border-bottom:1px dashed var(--accent2,#e0936b);cursor:pointer";
        el.onclick = (ev) => setNoteView({ note: n, x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY });
        return el;
      });
    }
    setOrphans(orphaned);
  }, [list, notes]);

  // Capture a selection inside the article into a pending anchor (logged-in
  // only). selectionchange covers touch devices (iOS, where mouseup doesn't fire
  // for the native selection handles); mouseup keeps desktop snappy.
  useEffect(() => {
    if (!me) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (composing) return;
      // Ignore selection churn while the user is typing in a field (the composer
      // textarea), which otherwise re-renders the thread on every keystroke.
      const ae = document.activeElement;
      if (ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT")) return;
      const sel = window.getSelection();
      const article = document.querySelector(".rdr-article");
      if (!sel || sel.isCollapsed || !sel.rangeCount || !article) { setMark(null); return; }
      const range = sel.getRangeAt(0);
      if (!article.contains(range.commonAncestorContainer)) { setMark(null); return; }
      const anchor = buildAnchor(article, sel);
      if (!anchor || anchor.exact.trim().length < 4) { setMark(null); return; }
      const r = range.getBoundingClientRect();
      setMark({ anchor, x: r.left + r.width / 2, y: Math.max(r.top, 8) });
    };
    const debounced = () => { clearTimeout(timer); timer = setTimeout(check, 350); };
    document.addEventListener("selectionchange", debounced);
    document.addEventListener("mouseup", check);
    return () => { clearTimeout(timer); document.removeEventListener("selectionchange", debounced); document.removeEventListener("mouseup", check); };
  }, [me, composing]);

  const top = list ?? [];
  return (
    <section className="rdr-comments" style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)", fontFamily: "var(--font-ui)", fontSize: 14, lineHeight: 1.6, color: "var(--fg-1)" }}>
      <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 17, fontWeight: 600, marginBottom: 16 }}>{t.title}{list ? ` · ${countAll(top)}` : ""}</h2>
      {me ? (
        <Composer t={t} busy={false} onSubmit={(b) => post(b)} />
      ) : (
        <a href="/login" style={{ ...btn(true), display: "inline-block", textDecoration: "none" }}>{t.login}</a>
      )}

      {orphans.length > 0 && (
        <details style={{ marginTop: 20, fontSize: 13, color: "var(--fg-3)" }}>
          <summary style={{ cursor: "pointer" }}>{t.moved} · {orphans.length}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
            {orphans.map((c) => <CommentItem key={c.id} c={c} me={me} api={api} t={t} refresh={refresh} onDelete={setDelTarget} />)}
          </div>
        </details>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 24 }}>
        {list === null ? null : top.length === 0 ? (
          <p style={{ color: "var(--fg-3)" }}>{t.empty}</p>
        ) : (
          top.map((c) => (
            <div key={c.id}>
              <CommentItem c={c} me={me} api={api} t={t} refresh={refresh} onReply={setReplyTo} onDelete={setDelTarget} />
              {replyTo === c.id && (
                <div style={{ marginLeft: 38, marginTop: 10 }}>
                  <Composer t={t} busy={false} autoFocus onSubmit={(b) => post(b, c.id)} onCancel={() => setReplyTo(null)} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* floating selection actions: comment (public) or private note */}
      {mark && !composing && (
        <div style={{ position: "fixed", left: mark.x, top: mark.y - 42, transform: "translateX(-50%)", zIndex: 50, display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setComposing("comment")} style={{ ...btn(true), boxShadow: "var(--shadow-md)" }}>💬 {t.mark}</button>
          <button type="button" onClick={() => setComposing("note")} style={{ ...btn(false), background: "var(--bg-surface)", boxShadow: "var(--shadow-md)" }}>📝 {t.note}</button>
        </div>
      )}
      {/* inline composer popover (comment or note) */}
      {mark && composing && (
        <div style={{ position: "fixed", left: Math.min(mark.x, window.innerWidth - 340), top: Math.min(mark.y + 10, window.innerHeight - 220), width: 320, zIndex: 50, padding: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 6 }}>{composing === "note" ? `📝 ${t.note}` : `💬 ${t.mark}`}</div>
          <blockquote style={{ margin: "0 0 8px", padding: "2px 8px", borderLeft: `2px solid ${composing === "note" ? "var(--accent2,#e0936b)" : "var(--accent)"}`, color: "var(--fg-3)", fontSize: 12, maxHeight: 48, overflow: "hidden" }}>“{mark.anchor.exact}”</blockquote>
          <Composer t={t} busy={false} autoFocus
            onSubmit={(b) => (composing === "note" ? postNote(b, mark.anchor) : post(b, undefined, mark.anchor))}
            onCancel={() => { setMark(null); setComposing(null); }} />
        </div>
      )}
      {/* private-note view popover */}
      {noteView && (
        <div onClick={() => setNoteView(null)} style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", left: Math.min(noteView.x, window.innerWidth - 300), top: Math.min(noteView.y + 8, window.innerHeight - 180), width: 280, padding: 12, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", fontFamily: "var(--font-ui)" }}>
            <div style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 6 }}>📝 {t.note}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: renderMd(noteView.note.body) }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => setNoteView(null)} style={btn(false)}>{t.cancel}</button>
              <button type="button" onClick={async () => { await api.delNote(noteView.note.id); setNoteView(null); loadNotes(); }} style={{ ...btn(false), color: "#a54646", borderColor: "#a54646" }}>{t.del}</button>
            </div>
          </div>
        </div>
      )}

      {delTarget && (
        <ConfirmModal
          title={t.confirmDel} confirmLabel={t.del} cancelLabel={t.cancel}
          onCancel={() => setDelTarget(null)}
          onConfirm={async () => { const id = delTarget.id; setDelTarget(null); await api.del(id); refresh(); }}
        />
      )}
    </section>
  );
}

function flashComment(id: string) {
  const el = document.getElementById(`rdr-comment-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.style.transition = "background .3s";
  el.style.background = "var(--accent-glow)";
  setTimeout(() => { el.style.background = ""; }, 1200);
}

function countAll(cs: Comment[]): number {
  return cs.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);
}
