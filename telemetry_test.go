// SPDX-FileCopyrightText: 2026 Latere AI
// SPDX-License-Identifier: MIT

package main

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"latere.ai/x/pkg/otel"
)

// syncBuffer is a bytes.Buffer safe for the exporters' background goroutines
// to write while the test reads it.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// TestTelemetryStartsExporting boots telemetry the way run does, against a
// local OTLP endpoint, and fails when export is disabled at start. pkg/otel
// names the service resource with one semantic-conventions schema and the
// OpenTelemetry SDK merges it with its own; when the two differ the merge
// fails with "conflicting Schema URL", Bootstrap disables export, and the
// service keeps running without sending anything.
func TestTelemetryStartsExporting(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", srv.URL)
	t.Setenv("OTEL_SDK_DISABLED", "")

	// Bootstrap replaces the slog default; the providers it installs are shut
	// down below and stay inert for the rest of the package's tests.
	prevLogger := slog.Default()
	t.Cleanup(func() { slog.SetDefault(prevLogger) })

	var out syncBuffer
	_, shutdown, err := otel.Bootstrap(context.Background(), otel.Config{
		ServiceName: "aaai",
		Stdout:      slog.NewJSONHandler(&out, nil),
	})
	if err != nil {
		t.Fatalf("telemetry did not start: %v", err)
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("telemetry shutdown: %v", err)
	}

	logs := out.String()
	if strings.Contains(logs, "export disabled") {
		t.Fatalf("telemetry export disabled at start:\n%s", logs)
	}
	if !strings.Contains(logs, "telemetry: exporting") {
		t.Fatalf("telemetry did not report exporting:\n%s", logs)
	}
}
