// Reader comments: a GitHub-style page thread (markdown body, emoji autocomplete,
// emoji reactions, one level of replies) plus the hooks the inline text-mark
// layer (see inline-marks.tsx) builds on. Talks to the same-origin /api added by
// the Go server; renders nothing destructive (markdown-it with html:false).
import MarkdownIt from "markdown-it";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  },
  zh: {
    title: "评论", login: "登录后评论", logout: "退出",
    placeholder: "写下评论…支持 markdown 与 :emoji:", post: "发表",
    reply: "回复", edit: "编辑", del: "删除", save: "保存", cancel: "取消",
    deleted: "[已删除]", empty: "还没有评论，来开个头。", confirmDel: "删除这条评论？",
    react: "添加表情", sending: "发送中…",
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
  };
}
type Api = ReturnType<typeof makeApi>;

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

function Composer({ t, busy, initial, onSubmit, onCancel, autoFocus }: {
  t: typeof ui.en; busy: boolean; initial?: string; autoFocus?: boolean;
  onSubmit: (body: string) => void; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial ?? "");
  const [menu, setMenu] = useState<{ items: string[]; from: number } | null>(null);
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

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={ref} value={text} onChange={onChange} disabled={busy} autoFocus={autoFocus}
        placeholder={t.placeholder} rows={3}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "9px 11px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--fg-1)", font: "inherit", fontSize: 14, lineHeight: 1.5 }}
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

function CommentItem({ c, me, api, t, refresh, onReply }: {
  c: Comment; me: Me | null; api: Api; t: typeof ui.en; refresh: () => void; onReply?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = c.mine && !c.deleted;
  const canDel = (c.mine || me?.admin) && !c.deleted;
  return (
    <div style={{ display: "flex", gap: 10 }}>
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
          {canDel && <button type="button" onClick={async () => { if (confirm(t.confirmDel)) { await api.del(c.id); refresh(); } }} style={linkBtn}>{t.del}</button>}
        </div>
        {c.replies?.map((r) => (
          <div key={r.id} style={{ marginTop: 12 }}><CommentItem c={r} me={me} api={api} t={t} refresh={refresh} /></div>
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

  const refresh = useCallback(() => { api.list(lang, path).then(setList).catch(() => setList([])); }, [api, lang, path]);

  useEffect(() => {
    api.me().then((m) => { setMe(m); if (m) csrfRef.current = m.csrf; }).catch(() => setMe(null));
    refresh();
  }, [api, refresh]);

  const post = async (body: string, parentId?: string) => {
    await api.create({ lang, path, body, parentId: parentId ?? null });
    setReplyTo(null);
    refresh();
  };

  const top = list ?? [];
  return (
    <section className="rdr-comments" style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>{t.title}{list ? ` · ${countAll(top)}` : ""}</h2>
      {me ? (
        <Composer t={t} busy={false} onSubmit={(b) => post(b)} />
      ) : (
        <a href="/login" style={{ ...btn(true), display: "inline-block", textDecoration: "none" }}>{t.login}</a>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 24 }}>
        {list === null ? null : top.length === 0 ? (
          <p style={{ color: "var(--fg-3)" }}>{t.empty}</p>
        ) : (
          top.map((c) => (
            <div key={c.id}>
              <CommentItem c={c} me={me} api={api} t={t} refresh={refresh} onReply={setReplyTo} />
              {replyTo === c.id && (
                <div style={{ marginLeft: 38, marginTop: 10 }}>
                  <Composer t={t} busy={false} autoFocus onSubmit={(b) => post(b, c.id)} onCancel={() => setReplyTo(null)} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function countAll(cs: Comment[]): number {
  return cs.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);
}
