// SPDX-FileCopyrightText: 2026 Latere AI
// SPDX-License-Identifier: MIT

package api

import (
	"bytes"
	"context"
	"encoding/json/v2"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

// benchStore serves a fixed page of comments and echoes creations back. The
// methods the benchmarks do not reach stay nil on the embedded interface.
type benchStore struct {
	commentStore
	page []*store.Comment
}

func (s benchStore) ListByPage(context.Context, string, string, string) ([]*store.Comment, error) {
	return s.page, nil
}

func (s benchStore) CountRecentByAuthor(context.Context, string, time.Time) (int, error) {
	return 0, nil
}

func (s benchStore) Create(_ context.Context, c *store.Comment) (*store.Comment, error) {
	out := *c
	out.ID = "01JC3Y8Q4W6N2Z5R7T9V1B3D5F"
	out.CreatedAt = time.Date(2026, 11, 1, 9, 30, 0, 0, time.UTC)
	out.UpdatedAt = out.CreatedAt
	out.Reactions = []store.Reaction{}
	return &out, nil
}

type benchIdentity struct{}

func (benchIdentity) User(http.ResponseWriter, *http.Request) *User {
	return &User{Sub: "user-1234", Name: "Reader One", Avatar: "https://avatars.example.test/u/1234?s=64"}
}
func (benchIdentity) EnsureCSRF(http.ResponseWriter, *http.Request) string { return "csrf" }
func (benchIdentity) CheckCSRF(*http.Request) bool                         { return true }

// benchComments builds a page of top-level comments, each with two replies.
func benchComments(n int) []*store.Comment {
	at := time.Date(2026, 10, 30, 8, 0, 0, 0, time.UTC)
	body := "The argument about retry budgets holds for a single caller, but with several agents sharing one provider key the budget has to be shared too. Is that covered in the chapter on gateways, or is it left to the reader?"
	mk := func(i int, parent *string) *store.Comment {
		return &store.Comment{
			ID: fmt.Sprintf("01JC3Y8Q4W6N2Z5R7T9V%05d", i), Lang: "en", Path: "/en/gateways/",
			ParentID: parent, AuthorName: fmt.Sprintf("Reader %d", i%17),
			AuthorAvatar: fmt.Sprintf("https://avatars.example.test/u/%d?s=64", i%17),
			BodyMD:       body,
			CreatedAt:    at.Add(time.Duration(i) * time.Minute), UpdatedAt: at.Add(time.Duration(i) * time.Minute),
			Reactions: []store.Reaction{{Emoji: "👍", Count: i%5 + 1}, {Emoji: "🚀", Count: i % 3, Mine: i%4 == 0}},
		}
	}
	out := make([]*store.Comment, 0, n)
	for i := range n {
		c := mk(i*10, nil)
		if i%2 == 0 {
			c.Anchor = &store.Anchor{
				Exact:   "retry budgets are shared across callers",
				Prefix:  "When several agents use one key, ",
				Suffix:  " or the provider throttles all of them",
				Section: "retries-and-budgets",
			}
		}
		for j := 1; j <= 2; j++ {
			c.Replies = append(c.Replies, mk(i*10+j, &c.ID))
		}
		out = append(out, c)
	}
	return out
}

// BenchmarkJSONCommentListEncode stands for GET /api/comments, which the
// book's pages call on every page view that opens the discussion.
func BenchmarkJSONCommentListEncode(b *testing.B) {
	for _, sz := range []struct {
		name     string
		comments int
	}{{"small", 1}, {"medium", 8}, {"large", 100}} {
		b.Run(sz.name, func(b *testing.B) {
			h := New(benchStore{page: benchComments(sz.comments)}, benchIdentity{}, nil)
			req := httptest.NewRequest(http.MethodGet, "/api/comments?lang=en&path=/en/gateways/", nil)
			warm := httptest.NewRecorder()
			h.ServeHTTP(warm, req)
			if warm.Code != http.StatusOK {
				b.Fatalf("status %d: %s", warm.Code, warm.Body.String())
			}
			b.ReportAllocs()
			b.SetBytes(int64(warm.Body.Len()))
			for b.Loop() {
				rec := httptest.NewRecorder()
				h.ServeHTTP(rec, req)
				if rec.Code != http.StatusOK {
					b.Fatalf("status %d", rec.Code)
				}
			}
		})
	}
}

// BenchmarkJSONCommentCreateRoundTrip stands for POST /api/comments: the
// request body is decoded strictly and the stored comment is encoded back.
func BenchmarkJSONCommentCreateRoundTrip(b *testing.B) {
	for _, sz := range []struct {
		name  string
		words int
	}{{"small", 40}, {"medium", 600}, {"large", 1400}} {
		b.Run(sz.name, func(b *testing.B) {
			h := New(benchStore{}, benchIdentity{}, nil)
			text := strings.TrimSpace(strings.Repeat("retry budget shared across agents ", sz.words/5+1))
			payload, err := json.Marshal(createReq{
				Lang: "en", Path: "/en/gateways/", Body: text,
				Anchor: &store.Anchor{Exact: "retry budgets", Prefix: "when several agents use one key, ", Suffix: " or the provider throttles", Section: "retries-and-budgets"},
			})
			if err != nil {
				b.Fatal(err)
			}
			b.ReportAllocs()
			b.SetBytes(int64(len(payload)))
			for b.Loop() {
				req := httptest.NewRequest(http.MethodPost, "/api/comments", bytes.NewReader(payload))
				rec := httptest.NewRecorder()
				h.ServeHTTP(rec, req)
				if rec.Code != http.StatusCreated {
					b.Fatalf("status %d: %s", rec.Code, rec.Body.String())
				}
			}
		})
	}
}
