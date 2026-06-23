package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

// registerAccount wires the per-user account routes onto the mux.
func (h *Handler) registerAccount(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/view", h.recordView)
	mux.HandleFunc("GET /api/stats", h.stats)
	mux.HandleFunc("PUT /api/bookmark", h.toggleBookmark)
	mux.HandleFunc("GET /api/bookmarks", h.listBookmarks)
	mux.HandleFunc("GET /api/me/comments", h.myComments)
	mux.HandleFunc("POST /api/notes", h.createNote)
	mux.HandleFunc("GET /api/notes", h.listNotes)
	mux.HandleFunc("GET /api/me/notes", h.myNotes)
	mux.HandleFunc("DELETE /api/notes/{id}", h.deleteNote)
}

func (h *Handler) myNotes(w http.ResponseWriter, r *http.Request) {
	u := h.id.User(w, r)
	if u == nil {
		writeErr(w, http.StatusUnauthorized, "login required")
		return
	}
	list, err := h.store.ListAllNotes(r.Context(), u.Sub)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	writeJSON(w, http.StatusOK, nonNil(list))
}

// recordView counts a page view (public). The visitor is the logged-in sub, else
// a persistent anonymous cookie, so unique visitors are deduplicated.
func (h *Handler) recordView(w http.ResponseWriter, r *http.Request) {
	var req struct{ Lang, Path string }
	if !decode(w, r, &req) {
		return
	}
	if !validLang(req.Lang) {
		writeErr(w, http.StatusBadRequest, "bad lang")
		return
	}
	vid := h.visitorID(w, r)
	if err := h.store.RecordView(r.Context(), req.Lang, req.Path, vid); err != nil {
		writeErr(w, http.StatusInternalServerError, "view failed")
		return
	}
	st, _ := h.store.PageStats(r.Context(), req.Lang, req.Path)
	writeJSON(w, http.StatusOK, st)
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	lang, path := r.URL.Query().Get("lang"), r.URL.Query().Get("path")
	if !validLang(lang) {
		writeErr(w, http.StatusBadRequest, "bad lang")
		return
	}
	st, err := h.store.PageStats(r.Context(), lang, path)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "stats failed")
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// visitorID returns "u:<sub>" for a logged-in user, else "v:<cookie>", setting a
// persistent anonymous id cookie when absent.
func (h *Handler) visitorID(w http.ResponseWriter, r *http.Request) string {
	if u := h.id.User(w, r); u != nil {
		return "u:" + u.Sub
	}
	if c, err := r.Cookie("aaai-vid"); err == nil && c.Value != "" {
		return "v:" + c.Value
	}
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	vid := hex.EncodeToString(b)
	http.SetCookie(w, &http.Cookie{
		Name: "aaai-vid", Value: vid, Path: "/", MaxAge: 86400 * 365,
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
		Secure: r.Header.Get("X-Forwarded-Proto") == "https",
	})
	return "v:" + vid
}

func (h *Handler) toggleBookmark(w http.ResponseWriter, r *http.Request) {
	u := h.requireUser(w, r)
	if u == nil {
		return
	}
	var req struct{ Lang, Path string }
	if !decode(w, r, &req) || !validLang(req.Lang) {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	on, err := h.store.ToggleBookmark(r.Context(), u.Sub, req.Lang, req.Path)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "bookmark failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"bookmarked": on})
}

func (h *Handler) listBookmarks(w http.ResponseWriter, r *http.Request) {
	u := h.id.User(w, r)
	if u == nil {
		writeErr(w, http.StatusUnauthorized, "login required")
		return
	}
	list, err := h.store.ListBookmarks(r.Context(), u.Sub)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	writeJSON(w, http.StatusOK, nonNil(list))
}

func (h *Handler) myComments(w http.ResponseWriter, r *http.Request) {
	u := h.id.User(w, r)
	if u == nil {
		writeErr(w, http.StatusUnauthorized, "login required")
		return
	}
	list, err := h.store.ListByAuthor(r.Context(), u.Sub)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	if list == nil {
		list = []*store.Comment{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) createNote(w http.ResponseWriter, r *http.Request) {
	u := h.requireUser(w, r)
	if u == nil {
		return
	}
	var req struct {
		Lang   string        `json:"lang"`
		Path   string        `json:"path"`
		Body   string        `json:"body"`
		Anchor *store.Anchor `json:"anchor"`
	}
	if !decode(w, r, &req) || !validLang(req.Lang) {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" || utf8.RuneCountInString(body) > maxBodyLen {
		writeErr(w, http.StatusBadRequest, "body empty or too long")
		return
	}
	n, err := h.store.CreateNote(r.Context(), &store.Note{
		Lang: req.Lang, Path: req.Path, BodyMD: body, Anchor: sanitizeAnchor(req.Anchor),
	}, u.Sub)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "note failed")
		return
	}
	writeJSON(w, http.StatusCreated, n)
}

func (h *Handler) listNotes(w http.ResponseWriter, r *http.Request) {
	u := h.id.User(w, r)
	if u == nil {
		writeJSON(w, http.StatusOK, []*store.Note{}) // anonymous: no notes, not an error
		return
	}
	lang, path := r.URL.Query().Get("lang"), r.URL.Query().Get("path")
	if !validLang(lang) {
		writeErr(w, http.StatusBadRequest, "bad lang")
		return
	}
	list, err := h.store.ListNotes(r.Context(), u.Sub, lang, path)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	if list == nil {
		list = []*store.Note{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) deleteNote(w http.ResponseWriter, r *http.Request) {
	u := h.requireUser(w, r)
	if u == nil {
		return
	}
	if err := h.store.DeleteNote(r.Context(), r.PathValue("id"), u.Sub); err != nil {
		if err == store.ErrNotFound {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
