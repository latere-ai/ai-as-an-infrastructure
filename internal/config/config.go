// Package config loads runtime configuration from the environment.
package config

import "github.com/caarlos0/env/v11"

// Config holds the book server's runtime configuration. Every field is
// optional: with an empty DatabaseURL the comments feature is disabled and the
// server behaves exactly like the static-only book it was before. The OIDC
// fields are read by pkg/oidc's own loader; they are mirrored here only so the
// server can decide whether posting is available (read stays public regardless).
type Config struct {
	// DatabaseURL is the Postgres DSN for the comments database. Empty disables
	// comments entirely (server stays a pure static file server).
	DatabaseURL string `env:"DATABASE_URL"`

	// ListenAddr overrides the listen address. The legacy PORT env var is still
	// honored by main.go when this is empty.
	ListenAddr string `env:"LISTEN_ADDR"`
}

// Load parses the configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
