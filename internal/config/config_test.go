package config_test

import (
	"testing"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/config"
)

// TestServingURLPrefersThePool pins which endpoint serving traffic opens. The
// pooled DSN is the claim on the cluster that does not move with the replica
// count, so it wins whenever it is set.
func TestServingURLPrefersThePool(t *testing.T) {
	cfg := &config.Config{
		DatabaseURL:     "postgres://direct:5432/aaai",
		DatabasePoolURL: "postgres://pooled:25061/aaai-pool",
	}
	if got, want := cfg.ServingURL(), "postgres://pooled:25061/aaai-pool"; got != want {
		t.Fatalf("ServingURL() = %q, want the pooled endpoint %q", got, want)
	}
}

// TestServingURLFallsBackToDirect pins the behaviour of a deployment whose
// Secret does not carry the pooled key yet: it serves on the direct endpoint
// exactly as it did before the pooler existed.
func TestServingURLFallsBackToDirect(t *testing.T) {
	cfg := &config.Config{DatabaseURL: "postgres://direct:5432/aaai"}
	if got, want := cfg.ServingURL(), "postgres://direct:5432/aaai"; got != want {
		t.Fatalf("ServingURL() = %q, want the direct endpoint %q", got, want)
	}
}

// TestServingURLIsEmptyWhenNoDatabaseIsConfigured keeps the comments-disabled
// path intact: main.go decides on DatabaseURL, and a pooled key on its own is
// not a configured database.
func TestServingURLIsEmptyWhenNoDatabaseIsConfigured(t *testing.T) {
	cfg := &config.Config{}
	if got := cfg.ServingURL(); got != "" {
		t.Fatalf("ServingURL() = %q, want empty", got)
	}
}
