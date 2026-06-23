package api_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/api"
	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

// fakeStore is an in-memory commentStore for HTTP-layer tests.
type fakeStore struct {
	byID map[string]*store.Comment
	seq  int
}

func newFakeStore() *fakeStore { return &fakeStore{byID: map[string]*store.Comment{}} }

func (f *fakeStore) ListByPage(_ context.Context, lang, path, _ string) ([]*store.Comment, error) {
	var out []*store.Comment
	for _, c := range f.byID {
		if c.Lang == lang && c.Path == path && c.ParentID == nil {
			out = append(out, c)
		}
	}
	return out, nil
}
func (f *fakeStore) Create(_ context.Context, c *store.Comment) (*store.Comment, error) {
	f.seq++
	c.ID = "id" + itoa(f.seq)
	cp := *c
	f.byID[c.ID] = &cp
	return c, nil
}
func (f *fakeStore) GetByID(_ context.Context, id string) (*store.Comment, error) {
	if c, ok := f.byID[id]; ok {
		return c, nil
	}
	return nil, store.ErrNotFound
}
func (f *fakeStore) UpdateBody(_ context.Context, id, body string) error {
	if c, ok := f.byID[id]; ok {
		c.BodyMD = body
		return nil
	}
	return store.ErrNotFound
}
func (f *fakeStore) SoftDelete(_ context.Context, id string) error {
	if _, ok := f.byID[id]; ok {
		delete(f.byID, id)
		return nil
	}
	return store.ErrNotFound
}
func (f *fakeStore) ToggleReaction(_ context.Context, _, _, _ string) (bool, error) { return true, nil }
func (f *fakeStore) CountRecentByAuthor(_ context.Context, _ string, _ time.Time) (int, error) {
	return 0, nil
}

func itoa(n int) string { return string(rune('0' + n)) }

// fakeID is a configurable Identity.
type fakeID struct {
	user *api.User
	csrf bool
}

func (f fakeID) User(http.ResponseWriter, *http.Request) *api.User    { return f.user }
func (f fakeID) EnsureCSRF(http.ResponseWriter, *http.Request) string { return "tok" }
func (f fakeID) CheckCSRF(*http.Request) bool                         { return f.csrf }

func do(h *api.Handler, method, target, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestListIsPublic(t *testing.T) {
	fs := newFakeStore()
	fs.byID["x"] = &store.Comment{ID: "x", Lang: "en", Path: "p", BodyMD: "hi"}
	h := api.New(fs, api.Anonymous{}, nil)
	w := do(h, "GET", "/api/comments?lang=en&path=p", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "hi") {
		t.Fatalf("public read failed: %d %s", w.Code, w.Body)
	}
}

func TestMeAnonymousIs204(t *testing.T) {
	h := api.New(newFakeStore(), api.Anonymous{}, nil)
	if w := do(h, "GET", "/api/me", ""); w.Code != http.StatusNoContent {
		t.Fatalf("want 204, got %d", w.Code)
	}
}

func TestPostRequiresAuthThenCSRF(t *testing.T) {
	fs := newFakeStore()
	body := `{"lang":"en","path":"p","body":"hello"}`

	// anonymous -> 401
	if w := do(api.New(fs, api.Anonymous{}, nil), "POST", "/api/comments", body); w.Code != 401 {
		t.Fatalf("anon want 401, got %d", w.Code)
	}
	// authed but no csrf -> 403
	authedNoCSRF := fakeID{user: &api.User{Sub: "u1", Name: "Ada"}, csrf: false}
	if w := do(api.New(fs, authedNoCSRF, nil), "POST", "/api/comments", body); w.Code != 403 {
		t.Fatalf("no-csrf want 403, got %d", w.Code)
	}
	// authed + csrf -> 201
	authed := fakeID{user: &api.User{Sub: "u1", Name: "Ada"}, csrf: true}
	if w := do(api.New(fs, authed, nil), "POST", "/api/comments", body); w.Code != 201 {
		t.Fatalf("authed want 201, got %d (%s)", w.Code, w.Body)
	}
}

func TestDeleteAuthorization(t *testing.T) {
	fs := newFakeStore()
	fs.byID["c1"] = &store.Comment{ID: "c1", Lang: "en", Path: "p", AuthorSub: "owner"}

	other := fakeID{user: &api.User{Sub: "other"}, csrf: true}
	if w := do(api.New(fs, other, nil), "DELETE", "/api/comments/c1", ""); w.Code != 403 {
		t.Fatalf("non-owner want 403, got %d", w.Code)
	}
	admin := fakeID{user: &api.User{Sub: "admin", IsSuperadmin: true}, csrf: true}
	if w := do(api.New(fs, admin, nil), "DELETE", "/api/comments/c1", ""); w.Code != http.StatusNoContent {
		t.Fatalf("admin want 204, got %d", w.Code)
	}
}

func TestReactionEmojiAllowlist(t *testing.T) {
	fs := newFakeStore()
	fs.byID["c1"] = &store.Comment{ID: "c1", Lang: "en", Path: "p"}
	authed := fakeID{user: &api.User{Sub: "u1"}, csrf: true}
	h := api.New(fs, authed, nil)
	if w := do(h, "PUT", "/api/comments/c1/reactions/💩", ""); w.Code != 400 {
		t.Fatalf("bad emoji want 400, got %d", w.Code)
	}
	if w := do(h, "PUT", "/api/comments/c1/reactions/👍", ""); w.Code != 200 {
		t.Fatalf("good emoji want 200, got %d (%s)", w.Code, w.Body)
	}
}
