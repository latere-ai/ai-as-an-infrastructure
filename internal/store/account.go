package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// PageRef is a (lang, path) reference with when it was saved, for bookmark and
// note lists. The display title is resolved client-side from the book manifest.
type PageRef struct {
	Lang      string    `json:"lang"`
	Path      string    `json:"path"`
	CreatedAt time.Time `json:"createdAt"`
}

// Note is a private inline annotation (only its author ever sees it).
type Note struct {
	ID        string    `json:"id"`
	Lang      string    `json:"lang"`
	Path      string    `json:"path"`
	BodyMD    string    `json:"body"`
	Anchor    *Anchor   `json:"anchor,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Stats is the view counters for a page.
type Stats struct {
	Views    int64 `json:"views"`
	Visitors int64 `json:"visitors"`
}

// --- bookmarks --------------------------------------------------------------

// ToggleBookmark adds the bookmark if absent, removes it if present, and reports
// whether it is now set.
func (s *Store) ToggleBookmark(ctx context.Context, sub, lang, path string) (bool, error) {
	tag, err := s.db.Exec(ctx, `insert into bookmarks (user_sub, lang, path)
		values ($1,$2,$3) on conflict do nothing`, sub, lang, path)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 1 {
		return true, nil
	}
	if _, err := s.db.Exec(ctx, `delete from bookmarks
		where user_sub = $1 and lang = $2 and path = $3`, sub, lang, path); err != nil {
		return false, err
	}
	return false, nil
}

// IsBookmarked reports whether the user has bookmarked a page.
func (s *Store) IsBookmarked(ctx context.Context, sub, lang, path string) (bool, error) {
	var one int
	err := s.db.QueryRow(ctx, `select 1 from bookmarks
		where user_sub = $1 and lang = $2 and path = $3`, sub, lang, path).Scan(&one)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

// ListBookmarks returns a user's bookmarks, newest first.
func (s *Store) ListBookmarks(ctx context.Context, sub string) ([]PageRef, error) {
	return s.pageRefs(ctx, `select lang, path, created_at from bookmarks
		where user_sub = $1 order by created_at desc`, sub)
}

func (s *Store) pageRefs(ctx context.Context, sql, sub string) ([]PageRef, error) {
	rows, err := s.db.Query(ctx, sql, sub)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PageRef
	for rows.Next() {
		var r PageRef
		if err := rows.Scan(&r.Lang, &r.Path, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// --- private notes ----------------------------------------------------------

// CreateNote inserts a private note and returns it.
func (s *Store) CreateNote(ctx context.Context, n *Note, sub string) (*Note, error) {
	var ax, apre, asuf, asec *string
	if n.Anchor != nil {
		ax, apre, asuf, asec = &n.Anchor.Exact, &n.Anchor.Prefix, &n.Anchor.Suffix, &n.Anchor.Section
	}
	row := s.db.QueryRow(ctx, `insert into notes
		(user_sub, lang, path, body_md, anchor_exact, anchor_prefix, anchor_suffix, anchor_section)
		values ($1,$2,$3,$4,$5,$6,$7,$8)
		returning id, lang, path, body_md, anchor_exact, anchor_prefix, anchor_suffix, anchor_section, created_at, updated_at`,
		sub, n.Lang, n.Path, n.BodyMD, ax, apre, asuf, asec)
	return scanNote(row)
}

func scanNote(row pgx.Row) (*Note, error) {
	var n Note
	var ax, apre, asuf, asec *string
	if err := row.Scan(&n.ID, &n.Lang, &n.Path, &n.BodyMD, &ax, &apre, &asuf, &asec, &n.CreatedAt, &n.UpdatedAt); err != nil {
		return nil, err
	}
	if ax != nil {
		n.Anchor = &Anchor{Exact: *ax}
		if apre != nil {
			n.Anchor.Prefix = *apre
		}
		if asuf != nil {
			n.Anchor.Suffix = *asuf
		}
		if asec != nil {
			n.Anchor.Section = *asec
		}
	}
	return &n, nil
}

// ListNotes returns a user's notes for one page (for the inline overlay).
func (s *Store) ListNotes(ctx context.Context, sub, lang, path string) ([]*Note, error) {
	rows, err := s.db.Query(ctx, `select id, lang, path, body_md,
		anchor_exact, anchor_prefix, anchor_suffix, anchor_section, created_at, updated_at
		from notes where user_sub = $1 and lang = $2 and path = $3 order by created_at`, sub, lang, path)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Note
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// DeleteNote removes a note the caller owns.
func (s *Store) DeleteNote(ctx context.Context, id, sub string) error {
	tag, err := s.db.Exec(ctx, `delete from notes where id = $1 and user_sub = $2`, id, sub)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// --- my comments ------------------------------------------------------------

// ListByAuthor returns the caller's own comments across all pages, newest first.
func (s *Store) ListByAuthor(ctx context.Context, sub string) ([]*Comment, error) {
	rows, err := s.db.Query(ctx, `select `+selectCols+` from comments
		where author_sub = $1 and deleted_at is null order by created_at desc limit 200`, sub)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Comment
	for rows.Next() {
		c, _, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		c.Mine = true
		out = append(out, c)
	}
	return out, rows.Err()
}

// --- page views -------------------------------------------------------------

// RecordView increments the page's view count and records the visitor for the
// unique-visitor tally.
func (s *Store) RecordView(ctx context.Context, lang, path, visitorID string) error {
	if _, err := s.db.Exec(ctx, `insert into page_stats (lang, path, views)
		values ($1,$2,1) on conflict (lang, path) do update set views = page_stats.views + 1`, lang, path); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `insert into page_visitors (lang, path, visitor_id)
		values ($1,$2,$3) on conflict do nothing`, lang, path, visitorID)
	return err
}

// PageStats returns the view and unique-visitor counts for a page.
func (s *Store) PageStats(ctx context.Context, lang, path string) (Stats, error) {
	var st Stats
	if err := s.db.QueryRow(ctx, `select coalesce(
		(select views from page_stats where lang = $1 and path = $2), 0),
		(select count(*) from page_visitors where lang = $1 and path = $2)`, lang, path).Scan(&st.Views, &st.Visitors); err != nil {
		return st, err
	}
	return st, nil
}
