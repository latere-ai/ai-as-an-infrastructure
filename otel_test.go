package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

// installRecorder points the global tracer provider at an in-memory recorder
// for the duration of one test.
//
// It must be called before newHandler: otelhttp resolves its provider when the
// handler is constructed, so a provider installed afterwards is never seen and
// the test records nothing.
func installRecorder(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	rec := tracetest.NewSpanRecorder()
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithSpanProcessor(rec),
	)
	prev := otel.GetTracerProvider()
	t.Cleanup(func() { otel.SetTracerProvider(prev) })
	otel.SetTracerProvider(tp)
	return rec
}

// A served request must produce a real server span. Asserting the handler or
// transport type instead would pass with no tracer provider registered at all,
// which is how an uninstrumented build ships without anyone noticing.
//
// The apex redirect is the subject because it is pure routing: it needs no
// built book, so this test cannot silently turn into a skip.
func TestHandlerRecordsServerSpan(t *testing.T) {
	rec := installRecorder(t)
	h := newHandler()

	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

	if w.Code != http.StatusFound {
		t.Fatalf("GET /: got %d, want 302", w.Code)
	}
	spans := rec.Ended()
	if len(spans) != 1 {
		t.Fatalf("recorded %d spans, want 1", len(spans))
	}
	if kind := spans[0].SpanKind(); kind != trace.SpanKindServer {
		t.Errorf("span kind = %v, want server", kind)
	}
	// The trace ID reaches the client only if the span context was valid
	// inside the handler, which a discarded noop span never is.
	if w.Header().Get("X-Trace-Id") != spans[0].SpanContext().TraceID().String() {
		t.Errorf("X-Trace-Id = %q, want the recorded trace %q",
			w.Header().Get("X-Trace-Id"), spans[0].SpanContext().TraceID())
	}
}

// The probes Kubernetes polls must still be served and must record nothing.
func TestHandlerSkipsProbes(t *testing.T) {
	rec := installRecorder(t)
	h := newHandler()

	for _, path := range []string{"/healthz", "/readyz"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != http.StatusOK || w.Body.String() != "ok\n" {
			t.Errorf("GET %s: got %d %q, want 200 ok", path, w.Code, w.Body.String())
		}
		if w.Header().Get("X-Trace-Id") != "" {
			t.Errorf("GET %s: X-Trace-Id set on a skipped request", path)
		}
	}
	if n := len(rec.Ended()); n != 0 {
		t.Fatalf("probes recorded %d spans, want 0", n)
	}

	// Guard against a WithSkip predicate that matches everything: the same
	// provider must still record a span for a normal request.
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	if n := len(rec.Ended()); n != 1 {
		t.Fatalf("after a traced request: %d spans, want 1", n)
	}
}
