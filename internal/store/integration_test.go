package store_test

import (
	"context"
	"os"
	"testing"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

// TestIntegration exercises migrations + real CRUD against a Postgres named by
// AAAI_TEST_DATABASE_URL. Skipped when unset, so the default `go test` stays
// hermetic (pgxmock covers logic). Run with a throwaway docker pg.
func TestIntegration(t *testing.T) {
	dsn := os.Getenv("AAAI_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set AAAI_TEST_DATABASE_URL to run the Postgres integration test")
	}
	ctx := context.Background()

	pool, err := store.NewPool(ctx, dsn) // runs migrations
	if err != nil {
		t.Fatalf("NewPool/migrations: %v", err)
	}
	defer pool.Close()

	// clean slate (migrations already ran; truncate for a repeatable test)
	if _, err := pool.Exec(ctx, "truncate comments cascade"); err != nil {
		t.Fatalf("truncate: %v", err)
	}

	s := store.New(pool)

	top, err := s.Create(ctx, &store.Comment{
		Lang: "en", Path: "reasoning/x", AuthorSub: "sub-1", AuthorName: "Ada",
		BodyMD: "first!", Anchor: &store.Anchor{Exact: "compute", Prefix: "the ", Suffix: " is", Section: "intro"},
	})
	if err != nil {
		t.Fatalf("create top: %v", err)
	}
	if _, err := s.Create(ctx, &store.Comment{
		Lang: "en", Path: "reasoning/x", ParentID: &top.ID, AuthorSub: "sub-2",
		AuthorName: "Bob", BodyMD: "reply",
	}); err != nil {
		t.Fatalf("create reply: %v", err)
	}

	if added, err := s.ToggleReaction(ctx, top.ID, "sub-2", "👍"); err != nil || !added {
		t.Fatalf("react: added=%v err=%v", added, err)
	}

	list, err := s.ListByPage(ctx, "en", "reasoning/x", "sub-2")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 || len(list[0].Replies) != 1 {
		t.Fatalf("want 1 top + 1 reply, got %d top", len(list))
	}
	if list[0].Anchor == nil || list[0].Anchor.Exact != "compute" {
		t.Fatalf("anchor round-trip failed: %+v", list[0].Anchor)
	}
	if len(list[0].Reactions) != 1 || list[0].Reactions[0].Count != 1 || !list[0].Reactions[0].Mine {
		t.Fatalf("reaction round-trip failed: %+v", list[0].Reactions)
	}

	if err := s.SoftDelete(ctx, top.ID); err != nil {
		t.Fatalf("soft delete: %v", err)
	}
	list, err = s.ListByPage(ctx, "en", "reasoning/x", "")
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	if len(list) != 1 || !list[0].Deleted || list[0].BodyMD != "" {
		t.Fatalf("want tombstone after delete, got %+v", list)
	}
}

func TestAccountIntegration(t *testing.T) {
	dsn := os.Getenv("AAAI_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set AAAI_TEST_DATABASE_URL")
	}
	ctx := context.Background()
	pool, err := store.NewPool(ctx, dsn) // runs migrations 0001 + 0002
	if err != nil {
		t.Fatalf("NewPool/migrations: %v", err)
	}
	defer pool.Close()
	for _, q := range []string{"truncate bookmarks", "truncate notes", "truncate page_stats", "truncate page_visitors"} {
		pool.Exec(ctx, q)
	}
	s := store.New(pool)

	// bookmark toggle
	if on, err := s.ToggleBookmark(ctx, "u1", "en", "reasoning/x"); err != nil || !on {
		t.Fatalf("bookmark on: %v %v", on, err)
	}
	if bm, _ := s.ListBookmarks(ctx, "u1"); len(bm) != 1 || bm[0].Path != "reasoning/x" {
		t.Fatalf("list bookmarks: %+v", bm)
	}
	if on, _ := s.ToggleBookmark(ctx, "u1", "en", "reasoning/x"); on {
		t.Fatalf("bookmark should toggle off")
	}

	// note round-trip
	n, err := s.CreateNote(ctx, &store.Note{Lang: "en", Path: "p", BodyMD: "private", Anchor: &store.Anchor{Exact: "x"}}, "u1")
	if err != nil || n.ID == "" {
		t.Fatalf("create note: %v", err)
	}
	if ns, _ := s.ListNotes(ctx, "u1", "en", "p"); len(ns) != 1 || ns[0].BodyMD != "private" {
		t.Fatalf("list notes: %+v", ns)
	}
	if err := s.DeleteNote(ctx, n.ID, "u1"); err != nil {
		t.Fatalf("delete note: %v", err)
	}

	// views: 2 hits from 2 visitors -> views=2, visitors=2; same visitor again -> views=3, visitors=2
	s.RecordView(ctx, "en", "p", "v:a")
	s.RecordView(ctx, "en", "p", "v:b")
	s.RecordView(ctx, "en", "p", "v:a")
	st, err := s.PageStats(ctx, "en", "p")
	if err != nil || st.Views != 3 || st.Visitors != 2 {
		t.Fatalf("stats: %+v err=%v (want views=3 visitors=2)", st, err)
	}
}
