package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrNotFound is returned when a comment does not exist.
var ErrNotFound = errors.New("comment not found")

// DB is the subset of *pgxpool.Pool the store needs. It lets tests inject a
// pgxmock pool.
type DB interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Store is the comments data layer.
type Store struct{ db DB }

// New wraps a pool (or mock) in a Store.
func New(db DB) *Store { return &Store{db: db} }

// Comment is one comment, with its reactions and (for top-level comments) its
// one level of replies attached.
type Comment struct {
	ID           string     `json:"id"`
	Lang         string     `json:"lang"`
	Path         string     `json:"path"`
	ParentID     *string    `json:"parentId,omitempty"`
	AuthorSub    string     `json:"-"` // never serialized to clients
	AuthorName   string     `json:"author"`
	AuthorAvatar string     `json:"avatar"`
	BodyMD       string     `json:"body"`
	Anchor       *Anchor    `json:"anchor,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	Deleted      bool       `json:"deleted"`
	Mine         bool       `json:"mine"`
	Reactions    []Reaction `json:"reactions"`
	Replies      []*Comment `json:"replies,omitempty"`
}

// Anchor is a W3C TextQuoteSelector plus the nearest heading id.
type Anchor struct {
	Exact   string `json:"exact"`
	Prefix  string `json:"prefix"`
	Suffix  string `json:"suffix"`
	Section string `json:"section"`
}

// Reaction is an aggregated emoji count for a comment.
type Reaction struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	Mine  bool   `json:"mine"`
}

const selectCols = `id, lang, path, parent_id, author_sub, author_name, author_avatar,
	body_md, anchor_exact, anchor_prefix, anchor_suffix, anchor_section,
	created_at, updated_at, deleted_at`

func scanComment(row pgx.Row) (*Comment, *time.Time, error) {
	var c Comment
	var ax, apre, asuf, asec *string
	var deletedAt *time.Time
	if err := row.Scan(&c.ID, &c.Lang, &c.Path, &c.ParentID, &c.AuthorSub,
		&c.AuthorName, &c.AuthorAvatar, &c.BodyMD, &ax, &apre, &asuf, &asec,
		&c.CreatedAt, &c.UpdatedAt, &deletedAt); err != nil {
		return nil, nil, err
	}
	if ax != nil {
		c.Anchor = &Anchor{Exact: *ax}
		if apre != nil {
			c.Anchor.Prefix = *apre
		}
		if asuf != nil {
			c.Anchor.Suffix = *asuf
		}
		if asec != nil {
			c.Anchor.Section = *asec
		}
	}
	return &c, deletedAt, nil
}

// ListByPage returns the comment tree for a page: top-level comments ordered by
// time, each with its reactions and one level of replies. viewerSub marks the
// caller's own comments/reactions ("" for anonymous). Soft-deleted comments are
// dropped unless they still have a surviving reply, in which case they appear as
// a tombstone (blanked body/author).
func (s *Store) ListByPage(ctx context.Context, lang, path, viewerSub string) ([]*Comment, error) {
	rows, err := s.db.Query(ctx, `select `+selectCols+`
		from comments where lang = $1 and path = $2 order by created_at asc`, lang, path)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	byID := map[string]*Comment{}
	var order []*Comment
	deleted := map[string]bool{}
	for rows.Next() {
		c, delAt, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		c.Mine = viewerSub != "" && c.AuthorSub == viewerSub
		if delAt != nil {
			deleted[c.ID] = true
			c.Deleted = true
		}
		byID[c.ID] = c
		order = append(order, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := s.attachReactions(ctx, byID, viewerSub); err != nil {
		return nil, err
	}

	// Build the tree: attach replies under their parents, collect top-levels.
	var top []*Comment
	hasReply := map[string]bool{}
	for _, c := range order {
		if c.ParentID != nil {
			if p, ok := byID[*c.ParentID]; ok {
				if deleted[c.ID] {
					continue // dropped deleted reply
				}
				p.Replies = append(p.Replies, c)
				hasReply[p.ID] = true
			}
		}
	}
	for _, c := range order {
		if c.ParentID != nil {
			continue
		}
		if deleted[c.ID] && !hasReply[c.ID] {
			continue // deleted top-level with no surviving replies: drop entirely
		}
		if deleted[c.ID] {
			c.BodyMD, c.AuthorName, c.AuthorAvatar, c.Anchor, c.Reactions = "", "", "", nil, nil
		}
		top = append(top, c)
	}
	return top, nil
}

func (s *Store) attachReactions(ctx context.Context, byID map[string]*Comment, viewerSub string) error {
	if len(byID) == 0 {
		return nil
	}
	ids := make([]string, 0, len(byID))
	for id := range byID {
		ids = append(ids, id)
	}
	rows, err := s.db.Query(ctx, `select comment_id, emoji, count(*),
		bool_or(author_sub = $1) from reactions where comment_id = any($2)
		group by comment_id, emoji order by emoji`, viewerSub, ids)
	if err != nil {
		return fmt.Errorf("list reactions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid, emoji string
		var cnt int
		var mine bool
		if err := rows.Scan(&cid, &emoji, &cnt, &mine); err != nil {
			return err
		}
		if c, ok := byID[cid]; ok {
			c.Reactions = append(c.Reactions, Reaction{Emoji: emoji, Count: cnt, Mine: mine && viewerSub != ""})
		}
	}
	return rows.Err()
}

// Create inserts a comment and returns it with server-assigned id/timestamps.
func (s *Store) Create(ctx context.Context, c *Comment) (*Comment, error) {
	var ax, apre, asuf, asec *string
	if c.Anchor != nil {
		ax, apre, asuf, asec = &c.Anchor.Exact, &c.Anchor.Prefix, &c.Anchor.Suffix, &c.Anchor.Section
	}
	row := s.db.QueryRow(ctx, `insert into comments
		(lang, path, parent_id, author_sub, author_name, author_avatar, body_md,
		 anchor_exact, anchor_prefix, anchor_suffix, anchor_section)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		returning `+selectCols,
		c.Lang, c.Path, c.ParentID, c.AuthorSub, c.AuthorName, c.AuthorAvatar,
		c.BodyMD, ax, apre, asuf, asec)
	out, _, err := scanComment(row)
	if err != nil {
		return nil, fmt.Errorf("create comment: %w", err)
	}
	out.Mine = true
	return out, nil
}

// GetByID returns a single comment (without replies/reactions) or ErrNotFound.
func (s *Store) GetByID(ctx context.Context, id string) (*Comment, error) {
	row := s.db.QueryRow(ctx, `select `+selectCols+` from comments where id = $1`, id)
	c, delAt, err := scanComment(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.Deleted = delAt != nil
	return c, nil
}

// UpdateBody edits a comment's markdown body and bumps updated_at. Authorization
// (author-only) is enforced by the caller.
func (s *Store) UpdateBody(ctx context.Context, id, bodyMD string) error {
	tag, err := s.db.Exec(ctx, `update comments set body_md = $1, updated_at = now()
		where id = $2 and deleted_at is null`, bodyMD, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SoftDelete marks a comment deleted. Authorization (author or superadmin) is
// enforced by the caller.
func (s *Store) SoftDelete(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `update comments set deleted_at = now()
		where id = $1 and deleted_at is null`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ToggleReaction adds the caller's reaction if absent, removes it if present,
// and reports whether it is now set.
func (s *Store) ToggleReaction(ctx context.Context, commentID, authorSub, emoji string) (bool, error) {
	tag, err := s.db.Exec(ctx, `insert into reactions (comment_id, author_sub, emoji)
		values ($1,$2,$3) on conflict do nothing`, commentID, authorSub, emoji)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 1 {
		return true, nil
	}
	if _, err := s.db.Exec(ctx, `delete from reactions
		where comment_id = $1 and author_sub = $2 and emoji = $3`, commentID, authorSub, emoji); err != nil {
		return false, err
	}
	return false, nil
}

// CountRecentByAuthor counts an author's comments since a cutoff, for rate
// limiting.
func (s *Store) CountRecentByAuthor(ctx context.Context, authorSub string, since time.Time) (int, error) {
	var n int
	if err := s.db.QueryRow(ctx, `select count(*) from comments
		where author_sub = $1 and created_at >= $2`, authorSub, since).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}
