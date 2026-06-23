-- Per-reader account features: bookmarks, private notes, and page view stats.

create table bookmarks (
    user_sub   text not null,                 -- oidc User.Sub
    lang       text not null check (lang in ('en', 'zh')),
    path       text not null,
    created_at timestamptz not null default now(),
    primary key (user_sub, lang, path)
);
create index bookmarks_user_idx on bookmarks (user_sub, created_at desc);

-- Private inline notes: like comment marks, but visible only to their author.
create table notes (
    id            uuid primary key default gen_random_uuid(),
    user_sub      text not null,
    lang          text not null check (lang in ('en', 'zh')),
    path          text not null,
    body_md       text not null,
    anchor_exact   text,
    anchor_prefix  text,
    anchor_suffix  text,
    anchor_section text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index notes_user_page_idx on notes (user_sub, lang, path);

-- Page views: a running total (PV) plus a distinct-visitor set (UV). A visitor
-- is the logged-in user's sub, else an anonymous cookie id.
create table page_stats (
    lang  text not null check (lang in ('en', 'zh')),
    path  text not null,
    views bigint not null default 0,
    primary key (lang, path)
);
create table page_visitors (
    lang       text not null,
    path       text not null,
    visitor_id text not null,
    created_at timestamptz not null default now(),
    primary key (lang, path, visitor_id)
);
