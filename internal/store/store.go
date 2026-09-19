// Package store is the Postgres data layer for reader comments.
package store

import (
	"context"
	"fmt"

	_ "github.com/golang-migrate/migrate/v4/database/postgres" // registers the postgres:// driver
	"github.com/jackc/pgx/v5/pgxpool"

	"latere.ai/x/pkg/pgxmigrate"

	"github.com/latere-ai/ai-as-an-infrastructure/migrations"
)

// NewPool opens a pgx connection pool on servingURL and runs pending
// migrations over migrationURL. The two are separate because migrations hold a
// session-scoped advisory lock across statements: a transaction-mode pooler
// reassigns the backend between transactions and the lock is lost, so the
// migrator stays on the direct endpoint while serving traffic goes through the
// pooler. The migrate bring-up (and the connection-close it needs) lives in the
// shared pgxmigrate helper; the postgres driver is blank-imported here because
// pgxmigrate selects it by the dsn scheme without importing it.
func NewPool(ctx context.Context, servingURL, migrationURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, servingURL)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}

	if err := pgxmigrate.Up(migrationURL, migrations.FS, "."); err != nil {
		pool.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return pool, nil
}
