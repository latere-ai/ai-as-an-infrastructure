-- Reader comments: page threads and inline text-quote marks.
create table comments (
    id            uuid primary key default gen_random_uuid(),
    lang          text not null check (lang in ('en', 'zh')),
    path          text not null,                                  -- canonical chapter path; '' = lang home
    parent_id     uuid references comments (id) on delete cascade, -- one-level reply
    author_sub    text not null,                                  -- oidc User.Sub (stable author key)
    author_name   text not null,                                  -- denormalized at post time
    author_avatar text not null default '',
    body_md       text not null,                                  -- raw markdown (rendered + sanitized client-side)
    -- inline anchor (all null for page-thread comments):
    anchor_exact   text,                                          -- selected text
    anchor_prefix  text,                                          -- context before
    anchor_suffix  text,                                          -- context after
    anchor_section text,                                          -- nearest heading id (scope + orphan fallback)
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz                                     -- soft delete (row kept so replies survive)
);

create index comments_page_idx on comments (lang, path) where deleted_at is null;
create index comments_parent_idx on comments (parent_id);
create index comments_author_recent_idx on comments (author_sub, created_at);

create table reactions (
    comment_id uuid not null references comments (id) on delete cascade,
    author_sub text not null,
    emoji      text not null,                                     -- unicode, validated against an allowlist
    created_at timestamptz not null default now(),
    primary key (comment_id, author_sub, emoji)
);
