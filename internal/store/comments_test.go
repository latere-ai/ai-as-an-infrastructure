package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v4"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

func newMock(t *testing.T) pgxmock.PgxPoolIface {
	t.Helper()
	mock, err := pgxmock.NewPool()
	if err != nil {
		t.Fatalf("new mock pool: %v", err)
	}
	t.Cleanup(mock.Close)
	return mock
}

func commentCols() []string {
	return []string{"id", "lang", "path", "parent_id", "author_sub", "author_name",
		"author_avatar", "body_md", "anchor_exact", "anchor_prefix", "anchor_suffix",
		"anchor_section", "created_at", "updated_at", "deleted_at"}
}

func TestCreateReturnsServerFields(t *testing.T) {
	mock := newMock(t)
	s := store.New(mock)
	now := time.Now()
	mock.ExpectQuery("insert into comments").
		WithArgs("en", "reasoning/x", pgxmock.AnyArg(), "sub-1", "Ada", "", "hello",
			pgxmock.AnyArg(), pgxmock.AnyArg(), pgxmock.AnyArg(), pgxmock.AnyArg()).
		WillReturnRows(pgxmock.NewRows(commentCols()).AddRow(
			"id-1", "en", "reasoning/x", nil, "sub-1", "Ada", "", "hello",
			nil, nil, nil, nil, now, now, nil))

	got, err := s.Create(context.Background(), &store.Comment{
		Lang: "en", Path: "reasoning/x", AuthorSub: "sub-1", AuthorName: "Ada", BodyMD: "hello",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if got.ID != "id-1" || !got.Mine || got.AuthorName != "Ada" {
		t.Fatalf("unexpected comment: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestToggleReactionAddsThenRemoves(t *testing.T) {
	mock := newMock(t)
	s := store.New(mock)
	ctx := context.Background()

	mock.ExpectExec("insert into reactions").WithArgs("c1", "u1", "👍").
		WillReturnResult(pgxmock.NewResult("INSERT", 1))
	if added, err := s.ToggleReaction(ctx, "c1", "u1", "👍"); err != nil || !added {
		t.Fatalf("first toggle: added=%v err=%v", added, err)
	}

	mock.ExpectExec("insert into reactions").WithArgs("c1", "u1", "👍").
		WillReturnResult(pgxmock.NewResult("INSERT", 0))
	mock.ExpectExec("delete from reactions").WithArgs("c1", "u1", "👍").
		WillReturnResult(pgxmock.NewResult("DELETE", 1))
	if added, err := s.ToggleReaction(ctx, "c1", "u1", "👍"); err != nil || added {
		t.Fatalf("second toggle: added=%v err=%v", added, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestSoftDeleteMissingIsNotFound(t *testing.T) {
	mock := newMock(t)
	s := store.New(mock)
	mock.ExpectExec("update comments set deleted_at").WithArgs("nope").
		WillReturnResult(pgxmock.NewResult("UPDATE", 0))
	if err := s.SoftDelete(context.Background(), "nope"); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListByPageDropsDeletedLeafKeepsTombstoneWithReply(t *testing.T) {
	mock := newMock(t)
	s := store.New(mock)
	now := time.Now()
	del := now
	rows := pgxmock.NewRows(commentCols()).
		// deleted top-level WITH a reply -> tombstone
		AddRow("t1", "en", "p", nil, "a", "Ann", "", "gone", nil, nil, nil, nil, now, now, &del).
		AddRow("r1", "en", "p", new("t1"), "b", "Bob", "", "reply", nil, nil, nil, nil, now, now, nil).
		// deleted top-level with NO reply -> dropped
		AddRow("t2", "en", "p", nil, "c", "Cleo", "", "bye", nil, nil, nil, nil, now, now, &del)
	mock.ExpectQuery("from comments where lang").WithArgs("en", "p").WillReturnRows(rows)
	mock.ExpectQuery("from reactions").WithArgs("", pgxmock.AnyArg()).
		WillReturnRows(pgxmock.NewRows([]string{"comment_id", "emoji", "count", "mine"}))

	got, err := s.ListByPage(context.Background(), "en", "p", "")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 1 || got[0].ID != "t1" || !got[0].Deleted || got[0].BodyMD != "" {
		t.Fatalf("want one tombstone t1, got %+v", got)
	}
	if len(got[0].Replies) != 1 || got[0].Replies[0].ID != "r1" {
		t.Fatalf("want reply r1 under tombstone, got %+v", got[0].Replies)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
