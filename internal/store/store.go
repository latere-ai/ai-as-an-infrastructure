// Package store is the Postgres data layer for reader comments.
package store

import (
	"context"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/latere-ai/ai-as-an-infrastructure/migrations"
)

// NewPool opens a pgx connection pool and runs pending migrations. It mirrors
// the pattern used across latere services (see fs/internal/store).
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}

	d, err := iofs.New(migrations.FS, ".")
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("init migrations source: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", d, databaseURL)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("init migrate: %w", err)
	}
	if err := runMigrations(m); err != nil {
		pool.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return pool, nil
}

// migrator is the subset of *migrate.Migrate that runMigrations needs, so tests
// can verify the instance is always closed.
type migrator interface {
	Up() error
	Close() (sourceErr error, dbErr error)
}

// runMigrations applies pending migrations and always closes the migrator.
// migrate.NewWithSourceInstance opens its own database/sql pool, separate from
// the returned pgxpool; without this Close its idle connections leak for the
// process lifetime. Closing the migrator does not touch the returned pgxpool.
func runMigrations(m migrator) error {
	defer m.Close()
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
