// Package migrations embeds the SQL migration files for the comments database.
package migrations

import "embed"

// FS holds the numbered .sql migrations, applied by store.NewPool via
// golang-migrate's iofs source.
//
//go:embed *.sql
var FS embed.FS
