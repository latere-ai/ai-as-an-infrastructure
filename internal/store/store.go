// Package store is the Postgres data layer for reader comments.
package store

import (
	"context"
	"fmt"

	_ "github.com/golang-migrate/migrate/v4/database/postgres" // registers the postgres:// driver
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/latere-ai/ai-as-an-infrastructure/migrations"
	"latere.ai/x/pkg/pgxmigrate"
)

// NewPool opens a pgx connection pool and runs pending migrations. The migrate
// bring-up (and its load-bearing connection-close) lives in the shared
// pgxmigrate helper; the postgres driver is blank-imported here because
// pgxmigrate selects it by the dsn scheme without importing it.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}

	if err := pgxmigrate.Up(databaseURL, migrations.FS, "."); err != nil {
		pool.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return pool, nil
}
