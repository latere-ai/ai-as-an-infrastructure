// Package api serves the reader-comments JSON API. It is mounted by main.go
// under /api and is only active when a database is configured; with no DB the
// book stays a pure static server.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

// User is the authenticated principal behind a request.
type User struct {
	Sub          string
	Name         string
	Avatar       string
	IsSuperadmin bool
}

// Identity resolves the current user and validates CSRF for writes. main.go
// supplies an OIDC-backed implementation; an anonymous one keeps the read path
// working with no auth configured.
type Identity interface {
	// User returns the current user, or nil when the request is anonymous.
	User(w http.ResponseWriter, r *http.Request) *User
	// CheckCSRF reports whether a state-changing request carries a valid token.
	CheckCSRF(r *http.Request) bool
}

// Anonymous is an Identity that never authenticates; writes are rejected.
type Anonymous struct{}

func (Anonymous) User(http.ResponseWriter, *http.Request) *User { return nil }
func (Anonymous) CheckCSRF(*http.Request) bool                  { return false }

// store-shaped dependency, narrowed so tests can fake it.
type commentStore interface {
	ListByPage(ctx context.Context, lang, path, viewerSub string) ([]*store.Comment, error)
	Create(ctx context.Context, c *store.Comment) (*store.Comment, error)
	GetByID(ctx context.Context, id string) (*store.Comment, error)
	UpdateBody(ctx context.Context, id, bodyMD string) error
	SoftDelete(ctx context.Context, id string) error
	ToggleReaction(ctx context.Context, commentID, authorSub, emoji string) (bool, error)
	CountRecentByAuthor(ctx context.Context, authorSub string, since time.Time) (int, error)
}

// Handler is the comments API.
type Handler struct {
	store commentStore
	id    Identity
	mux   *http.ServeMux
}

const (
	maxBodyLen   = 10000
	rateMax      = 20               // comments
	rateWindow   = 10 * time.Minute // per window
	anchorCtxMax = 200
)

// reactionEmoji is the fixed reaction allowlist (GitHub's set).
var reactionEmoji = map[string]bool{
	"👍": true, "👎": true, "❤️": true, "🎉": true, "😄": true, "😕": true, "🚀": true, "👀": true,
}

// New builds the API handler over a store and an identity provider.
func New(s commentStore, id Identity) *Handler {
	h := &Handler{store: s, id: id}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/me", h.me)
	mux.HandleFunc("GET /api/comments", h.list)
	mux.HandleFunc("POST /api/comments", h.create)
	mux.HandleFunc("PATCH /api/comments/{id}", h.update)
	mux.HandleFunc("DELETE /api/comments/{id}", h.delete)
	mux.HandleFunc("PUT /api/comments/{id}/reactions/{emoji}", h.react)
	h.mux = mux
	return h
}

// ServeHTTP routes an /api request.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) { h.mux.ServeHTTP(w, r) }

// Owns reports whether the API (vs the static file server) should handle a path.
// The OIDC login routes added in M3 extend this set.
func (h *Handler) Owns(path string) bool { return strings.HasPrefix(path, "/api/") }

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	u := h.id.User(w, r)
	if u == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sub": u.Sub, "name": u.Name, "avatar": u.Avatar, "admin": u.IsSuperadmin})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	lang := r.URL.Query().Get("lang")
	path := r.URL.Query().Get("path")
	if !validLang(lang) {
		writeErr(w, http.StatusBadRequest, "bad lang")
		return
	}
	viewer := ""
	if u := h.id.User(w, r); u != nil {
		viewer = u.Sub
	}
	list, err := h.store.ListByPage(r.Context(), lang, path, viewer)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	if list == nil {
		list = []*store.Comment{}
	}
	writeJSON(w, http.StatusOK, list)
}

// createReq is the POST body.
type createReq struct {
	Lang     string        `json:"lang"`
	Path     string        `json:"path"`
	ParentID *string       `json:"parentId"`
	Body     string        `json:"body"`
	Anchor   *store.Anchor `json:"anchor"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	u := h.requireUser(w, r)
	if u == nil {
		return
	}
	var req createReq
	if !decode(w, r, &req) {
		return
	}
	if !validLang(req.Lang) {
		writeErr(w, http.StatusBadRequest, "bad lang")
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" || utf8.RuneCountInString(body) > maxBodyLen {
		writeErr(w, http.StatusBadRequest, "body empty or too long")
		return
	}
	// One level of replies: a parent must itself be top-level and on this page.
	if req.ParentID != nil {
		parent, err := h.store.GetByID(r.Context(), *req.ParentID)
		if errors.Is(err, store.ErrNotFound) || (err == nil && (parent.ParentID != nil || parent.Lang != req.Lang || parent.Path != req.Path)) {
			writeErr(w, http.StatusBadRequest, "bad parent")
			return
		} else if err != nil {
			writeErr(w, http.StatusInternalServerError, "parent lookup failed")
			return
		}
	}
	anchor := sanitizeAnchor(req.Anchor)
	// Rate limit by author.
	if n, err := h.store.CountRecentByAuthor(r.Context(), u.Sub, time.Now().Add(-rateWindow)); err == nil && n >= rateMax {
		writeErr(w, http.StatusTooManyRequests, "slow down")
		return
	}
	c, err := h.store.Create(r.Context(), &store.Comment{
		Lang: req.Lang, Path: req.Path, ParentID: req.ParentID,
		AuthorSub: u.Sub, AuthorName: u.Name, AuthorAvatar: u.Avatar,
		BodyMD: body, Anchor: anchor,
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "create failed")
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	u := h.requireUser(w, r)
	if u == nil {
		return
	}
	c, ok := h.ownedComment(w, r, u, false)
	if !ok {
		return
	}
	var req struct {
		Body string `json:"body"`
	}
	if !decode(w, r, &req) {
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" || utf8.RuneCountInString(body) > maxBodyLen {
		writeErr(w, http.StatusBadRequest, "body empty or too long")
		return
	}
	if err := h.store.UpdateBody(r.Context(), c.ID, body); err != nil {
		writeErr(w, http.StatusInternalServerError, "update failed")
		return
	}
	c.BodyMD = body
	writeJSON(w, http.StatusOK, c)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	u := h.requireUser(w, r)
	if u == nil {
		return
	}
	c, ok := h.ownedComment(w, r, u, true) // superadmin may delete any
	if !ok {
		return
	}
	if err := h.store.SoftDelete(r.Context(), c.ID); err != nil {
		writeErr(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) react(w http.ResponseWriter, r *http.Request) {
	u := h.requireUser(w, r)
	if u == nil {
		return
	}
	emoji := r.PathValue("emoji")
	if !reactionEmoji[emoji] {
		writeErr(w, http.StatusBadRequest, "bad emoji")
		return
	}
	added, err := h.store.ToggleReaction(r.Context(), r.PathValue("id"), u.Sub, emoji)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "react failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"emoji": emoji, "added": added})
}

// requireUser enforces auth + CSRF for write routes, writing the error itself.
func (h *Handler) requireUser(w http.ResponseWriter, r *http.Request) *User {
	u := h.id.User(w, r)
	if u == nil {
		writeErr(w, http.StatusUnauthorized, "login required")
		return nil
	}
	if !h.id.CheckCSRF(r) {
		writeErr(w, http.StatusForbidden, "bad csrf")
		return nil
	}
	return u
}

// ownedComment loads the path comment and checks the caller may modify it.
func (h *Handler) ownedComment(w http.ResponseWriter, r *http.Request, u *User, allowAdmin bool) (*store.Comment, bool) {
	c, err := h.store.GetByID(r.Context(), r.PathValue("id"))
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return nil, false
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "lookup failed")
		return nil, false
	}
	if c.AuthorSub != u.Sub && !(allowAdmin && u.IsSuperadmin) {
		writeErr(w, http.StatusForbidden, "not your comment")
		return nil, false
	}
	return c, true
}

func validLang(l string) bool { return l == "en" || l == "zh" }

// sanitizeAnchor caps context lengths and drops an anchor with no quote.
func sanitizeAnchor(a *store.Anchor) *store.Anchor {
	if a == nil || strings.TrimSpace(a.Exact) == "" {
		return nil
	}
	clip := func(s string) string {
		if utf8.RuneCountInString(s) <= anchorCtxMax {
			return s
		}
		return string([]rune(s)[:anchorCtxMax])
	}
	return &store.Anchor{Exact: clip(a.Exact), Prefix: clip(a.Prefix), Suffix: clip(a.Suffix), Section: clip(a.Section)}
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "bad json")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
