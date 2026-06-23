# Spec: Reader comments (inline marks + page threads)

Status: draft for approval · Owner: book · Target: `aaai.latere.ai`

## 1. Goal

Let logged-in latere users discuss the book in two places:

1. **Inline marks** — select text in a chapter, attach a comment to that
   selection; the highlight reappears for every reader.
2. **Page thread** — a GitHub-style comment box at the bottom of each chapter
   (markdown body, emoji autocomplete, emoji reactions, one level of replies).

Comments are **public to read**; **posting requires a latere login**. Authors
edit/delete their own; superadmins delete any. Rate-limited.

This is the book's first stateful feature: it adds an OIDC login flow, a
Postgres database, and a JSON API to a server that is today a static-only
embed.

## 2. Decisions (locked)

| Question | Decision |
|---|---|
| Inline anchor model | **Text-quote (fuzzy re-find)**, W3C `TextQuoteSelector` style. Survives most edits; an edited-away mark becomes "orphaned" (listed, not highlighted). |
| Scope | **Both surfaces** (inline marks + page thread). |
| Comment richness | **GitHub-like**: sanitized markdown + emoji autocomplete in composer + emoji reactions + one level of replies. |
| Visibility / moderation | **Public read; latere login to post.** Author edits/deletes own; superadmin deletes any; rate-limited. |

## 3. Architecture

```
Browser (React reader, aaai.latere.ai)
  ├─ GET /{lang}/{path}            static HTML (unchanged)
  ├─ login button → GET /login ──► auth.latere.ai (OIDC) ──► GET /callback (sets __Host session cookie)
  ├─ GET  /api/me                  who am I (cookie)            [public]
  ├─ GET  /api/comments?lang&path  list for a page             [public]
  ├─ POST /api/comments            create (mark or thread)     [auth + CSRF + rate-limit]
  ├─ PATCH/DELETE /api/comments/:id  edit/delete own           [auth]
  └─ PUT  /api/comments/:id/reactions/:emoji  toggle reaction  [auth]
Go server (main.go)
  ├─ serveAPI()  ── pgxpool ──► Postgres `aaai` DB (shared DO cluster)
  └─ oidc.Client (pkg/oidc) for /login /callback /logout /api/me + UserFromRequest
```

The reader stays SSG/static; only the new `/api/*` and `/login`/`/callback`
routes are dynamic. Same-origin → cookies flow automatically, no CORS.

## 4. Auth (reuse `latere.ai/x/pkg/oidc`)

- Register a confidential OAuth client `aaai-web` in the auth admin UI →
  `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, redirect `https://aaai.latere.ai/callback`.
  **(user-gated — needs auth admin access)**
- Env: `AUTH_URL=https://auth.latere.ai`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`,
  `AUTH_REDIRECT_URL=https://aaai.latere.ai/callback`, `AUTH_COOKIE_KEY` (`openssl rand -hex 32`).
- Wiring (mirrors `latere-ai/main.go:59`):
  ```go
  authClient := oidc.New(oidc.LoadConfig()) // nil if AUTH_CLIENT_ID unset → feature degrades to read-only
  // routes: GET /login, /callback, /logout, /logout/notify
  user := authClient.UserFromRequest(w, r)  // *oidc.User or nil
  ```
- `oidc.User.Sub` is the **stable author key**; `Name`, `AvatarURL` denormalized
  onto each comment at post time (so display survives profile changes / is cheap to read).
- `__Host-latere-session` is per-domain by design → the book runs its **own**
  login flow. CSRF: reuse the `__Host-latere-csrf` token pkg/oidc issues; require
  it on all state-changing API calls.
- If `authClient == nil` (no secret configured, e.g. local/dev), the API serves
  reads and the UI shows "log in to comment" with login disabled — the book
  still builds and runs with zero auth config.

## 5. Data model (Postgres `aaai` DB)

Migrations via `golang-migrate` (`migrations/0001_comments.up.sql`), embedded and
run at startup — the pattern used by `auth` and `fs`.

```sql
create table comments (
  id           uuid primary key default gen_random_uuid(),
  lang         text not null check (lang in ('en','zh')),
  path         text not null,                    -- canonical chapter path; '' = lang home
  parent_id    uuid references comments(id) on delete cascade,  -- one-level reply
  author_sub   text not null,                    -- oidc User.Sub
  author_name  text not null,                    -- denormalized at post time
  author_avatar text not null default '',
  body_md      text not null,                    -- raw markdown (rendered+sanitized client-side)
  -- inline anchor (all null for page-thread comments):
  anchor_exact   text,                           -- selected text
  anchor_prefix  text,                           -- ~32 chars before
  anchor_suffix  text,                           -- ~32 chars after
  anchor_section text,                           -- nearest heading id (scope + orphan fallback)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz                       -- soft delete (kept so replies/threads don't break)
);
create index comments_page_idx on comments (lang, path) where deleted_at is null;

create table reactions (
  comment_id uuid not null references comments(id) on delete cascade,
  author_sub text not null,
  emoji      text not null,                      -- unicode, validated against an allowlist
  created_at timestamptz not null default now(),
  primary key (comment_id, author_sub, emoji)
);
```

Replies are one level only: a `parent_id` must point to a top-level comment
(enforced in the handler). Deleting a parent soft-deletes it but keeps the row
("[deleted]") so replies remain.

## 6. API contract (`/api`, JSON, same-origin)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/me` | cookie | `{sub,name,avatar}` or `204` when anonymous |
| GET | `/api/comments?lang=&path=` | public | top-level comments with nested replies, reactions aggregated `{emoji,count,mine}`, and inline-anchor fields; excludes soft-deleted bodies (shows "[deleted]" if it has replies) |
| POST | `/api/comments` | auth+csrf+ratelimit | body `{lang,path,body_md,parent_id?,anchor?}`; server validates length, parent depth, emoji/anchor; returns created comment |
| PATCH | `/api/comments/:id` | author | `{body_md}`; sets `updated_at` |
| DELETE | `/api/comments/:id` | author or superadmin | soft delete |
| PUT | `/api/comments/:id/reactions/:emoji` | auth | toggle the caller's reaction |

Limits: body ≤ 10 000 chars; ≤ 20 posts / 10 min / user (token bucket keyed on
`Sub`); emoji from a fixed allowlist. All write routes require the CSRF token and
a valid session.

## 7. Inline anchoring (text-quote)

Store the W3C `TextQuoteSelector` triple (`exact`,`prefix`,`suffix`) plus
`anchor_section` (nearest heading id) computed client-side from the selection.

**Re-find on load** (client): for each inline comment on the page, search the
`.rdr-article` text (scoped to `anchor_section` first, then whole article) for
`prefix+exact+suffix`; tolerate small drift with an approximate match. On hit,
wrap the range in a `<mark class="rdr-cmt-mark">` carrying the comment id; on
miss, the comment is **orphaned** → shown in a "marks that moved" list in the
thread, not highlighted. This is robust to the active editing of chapter prose.

Selection → anchor and range-wrapping run after hydration in a dedicated island
(`window.__rdrComments()`), over the existing article DOM; marks are an overlay,
never persisted into the compiled HTML.

## 8. Frontend (React island in `app/src`)

- `CommentsSection` rendered in `Reader.tsx` after the article body, before
  `PrevNextNav`. Composer (textarea with markdown + `:emoji:` autocomplete),
  comment list, reactions row, reply affordance. Styled with existing CSS
  vars (`--bg-surface`,`--fg-*`,`--accent`,`--border`,`--radius-*`,`--font-*`)
  and theme/dark-mode aware.
- Inline layer: `mouseup` on the article → selection popover ("Comment") →
  opens composer pre-anchored; existing marks render as `<mark>` with a hover
  popover/click-to-open-in-thread.
- Markdown render: `markdown-it` (already a dep) with **HTML disabled** +
  DOMPurify-style sanitization; emoji shortcodes → unicode. No raw HTML stored
  or rendered.
- Data: fetch like `SearchModal` does. Auth state from `/api/me`; reuse
  `latere-ui` vanilla session helpers (`createApiClient`) for token/CSRF
  injection (Vue-free TS core; latere-ui Vue components are NOT used — React app).
- Mount via a new `window.__rdrComments()` registered in `hydrate.tsx`, called
  after hydration (same pattern as `__rdrViz`).

## 9. Security

- **XSS**: markdown-it with `html:false` + sanitizer; render user content only
  through it; never `dangerouslySetInnerHTML` raw user input.
- **CSRF**: require `__Host-latere-csrf` on POST/PATCH/DELETE/PUT.
- **AuthZ**: edit/delete checked against `author_sub == user.Sub || user.IsSuperadmin`.
- **Rate limit + length caps** as in §6. Emoji allowlist. `path`/`lang` validated
  against the known chapter set (reject arbitrary keys).
- Reads are public but only return non-deleted content.

## 10. Infra & deploy

- **Terraform** (`../terraform/database.tf`): add `digitalocean_database_db.aaai`
  + `kubernetes_secret.aaai_db` (DATABASE_URL) in ns `latere`, copying the `fs`
  block. **(user-gated — terraform apply needs DO/k8s creds)**
- **k8s** (`deploy/prod/deployment.yaml`): inject `DATABASE_URL` and the `AUTH_*`
  secrets as env; add a `comments` Secret (or reuse one) for `AUTH_CLIENT_SECRET`
  / `AUTH_COOKIE_KEY`. Probes unchanged (DB checked in `/readyz`).
- **Go module**: add `latere.ai/x/pkg`, `jackc/pgx/v5`, `golang-migrate/migrate/v4`,
  `caarlos0/env/v11`. The build must fetch the private `latere.ai/x/pkg` —
  confirm the Docker build has `GOPRIVATE=latere.ai/*` + git auth (other apps
  build it; mirror their Dockerfile). Locally, a `go.work`/replace to `../pkg`
  unblocks dev without network. **(build-infra item to verify before deploy)**
- **Migrations** run at boot before serving; `/readyz` fails until DB reachable +
  migrated, so a bad DB can't take traffic.
- **Tests stay green**: `main_test.go` routing/redirect/cache contract must still
  pass; `/api/*` is matched before redirect/canonicalization so it can't be
  swallowed by `try_files`.

## 11. Build order (milestones, each independently shippable behind config)

1. **DB + config plumbing**: `internal/config` (env), `internal/store` (pgxpool +
   embedded migrations), `0001_comments` schema, store unit tests. No behavior change yet.
2. **Auth routes**: wire `pkg/oidc` (`/login` `/callback` `/logout` `/api/me`);
   degrade gracefully when unconfigured.
3. **Comments API**: handlers + authz + sanitize + rate limit; `main_test.go`
   API tests; keep existing routing tests green.
4. **Page-thread UI**: `CommentsSection` + composer + reactions + replies; wire
   to API; styling + dark mode.
5. **Inline marks**: selection → text-quote anchor; re-find + `<mark>` overlay;
   orphan list; popover.
6. **Infra**: terraform DB+secret, deployment env, Dockerfile dep fetch; deploy
   checklist.

Build proceeds 1→6; the reader change in 4–5 is one bundle. Steps needing the
user (OAuth client registration, terraform apply, secrets, deploy) are gated and
listed below.

## 12. User-gated steps (cannot be done from here)

1. Register OAuth client `aaai-web` in auth admin → client id + secret.
2. `openssl rand -hex 32` → `AUTH_COOKIE_KEY`.
3. `terraform apply` to create the `aaai` DB + k8s secret.
4. Put `AUTH_CLIENT_SECRET` / `AUTH_COOKIE_KEY` into a k8s secret.
5. Confirm the Docker build can fetch `latere.ai/x/pkg` (GOPRIVATE + git auth).
6. Deploy (`deploy/publish.sh`) and smoke-test login + post.

## 13. Open questions

- Notifications (email on reply) — out of scope v1?
- Per-language threads vs shared across en/zh of the same chapter — spec assumes
  **separate** (keyed on `(lang,path)`); confirm.
- Markdown feature set (tables? images?) — start minimal (text, links, code, lists).
- Abuse: report button / blocklist — defer to v2 (superadmin delete covers v1).

## 14. Testing

- Go: store CRUD + authz + rate-limit unit tests; `main_test.go` API contract
  (200/401/403/404, CSRF reject) and unchanged routing tests.
- Anchoring: unit test the re-find against edited prose fixtures (exact, drifted,
  orphaned).
- Frontend: a render/interaction check via the headless harness; manual login →
  post → reply → react → mark → reload flow on a preview.
