package store_test

import (
	"context"
	"strings"
	"testing"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/store"
)

// poolHost and directHost stand in for the two endpoints. They are distinct so
// an error that names one proves which DSN the failing client was handed.
const (
	poolHost   = "pooled.invalid"
	directHost = "directhost.invalid"
)

// TestNewPoolOpensServingOnTheFirstURL proves the first argument reaches
// pgxpool. An unparseable serving DSN fails while opening the pool, before the
// migrator is consulted at all.
func TestNewPoolOpensServingOnTheFirstURL(t *testing.T) {
	t.Parallel()
	_, err := store.NewPool(context.Background(), "://not-a-dsn", "postgres://u:p@"+directHost+":5432/aaai")
	if err == nil {
		t.Fatal("NewPool() = nil error, want a failure from the serving DSN")
	}
	if !strings.Contains(err.Error(), "open pool") {
		t.Fatalf("NewPool() error = %v, want it to name the pool open", err)
	}
}

// TestNewPoolMigratesOnTheSecondURL proves the migrator is handed the direct
// DSN and never the pooled one. golang-migrate holds a session-scoped advisory
// lock across statements, which a transaction-mode pooler cannot keep on one
// backend, so a migrator pointed at the pool corrupts the schema version under
// concurrency. The serving DSN here is parseable and would connect nowhere: if
// it reached the migrator, the error would name the pooled host.
func TestNewPoolMigratesOnTheSecondURL(t *testing.T) {
	t.Parallel()
	_, err := store.NewPool(context.Background(), "postgres://u:p@"+poolHost+":25061/aaai-pool", "://not-a-dsn")
	if err == nil {
		t.Fatal("NewPool() = nil error, want a failure from the migration DSN")
	}
	if !strings.Contains(err.Error(), "run migrations") {
		t.Fatalf("NewPool() error = %v, want it to name the migration step", err)
	}
	if strings.Contains(err.Error(), poolHost) {
		t.Fatalf("NewPool() error = %v, want the migrator never to see the pooled host %q", err, poolHost)
	}
}
