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
