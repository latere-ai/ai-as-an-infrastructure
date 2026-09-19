// Package config loads runtime configuration from the environment.
package config

import "github.com/caarlos0/env/v11"

// Config holds the book server's runtime configuration. Every field is
// optional: with an empty DatabaseURL the comments feature is disabled and the
// server behaves exactly like the static-only book it was before. The OIDC
// fields are read by pkg/oidc's own loader; they are mirrored here only so the
// server can decide whether posting is available (read stays public regardless).
type Config struct {
	// DatabaseURL is the Postgres DSN on the direct endpoint. It carries
	// migrations, which hold a session-scoped advisory lock across statements
	// that a transaction-mode pooler cannot keep on one backend. Empty
	// disables comments entirely (server stays a pure static file server).
	DatabaseURL string `env:"DATABASE_URL"`

	// DatabasePoolURL is the DSN on the pooler's endpoint, which serving
	// traffic opens so the pool size and not the replica count is this
	// service's claim on the cluster. Empty falls back to DatabaseURL.
	DatabasePoolURL string `env:"DATABASE_POOL_URL"`

	// ListenAddr overrides the listen address. The legacy PORT env var is still
	// honored by main.go when this is empty.
	ListenAddr string `env:"LISTEN_ADDR"`
}

// ServingURL is the DSN the connection pool opens: the pooler's endpoint when
// one is configured, the direct endpoint otherwise. The fallback keeps a
// deployment that has not yet been given the pooled key working unchanged.
func (c *Config) ServingURL() string {
	if c.DatabasePoolURL != "" {
		return c.DatabasePoolURL
	}
	return c.DatabaseURL
}

// Load parses the configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
