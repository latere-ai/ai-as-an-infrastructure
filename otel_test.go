package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"go.opentelemetry.io/otel"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
	pkgotel "latere.ai/x/pkg/otel"

	"github.com/latere-ai/ai-as-an-infrastructure/internal/api"
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

// installMeterReader points the global meter provider at a manual reader for
// the duration of one test. Like installRecorder, it must run before
// newHandler, which is when otelhttp resolves its instruments.
func installMeterReader(t *testing.T) *sdkmetric.ManualReader {
	t.Helper()
	reader := sdkmetric.NewManualReader()
	prev := otel.GetMeterProvider()
	t.Cleanup(func() { otel.SetMeterProvider(prev) })
	otel.SetMeterProvider(sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader)))
	return reader
}

// durationRoutes returns the http.route values on the request-duration
// histogram, with the number of requests recorded under each.
func durationRoutes(t *testing.T, reader *sdkmetric.ManualReader) map[string]uint64 {
	t.Helper()
	var rm metricdata.ResourceMetrics
	if err := reader.Collect(context.Background(), &rm); err != nil {
		t.Fatalf("collect metrics: %v", err)
	}
	routes := map[string]uint64{}
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name != "http.server.request.duration" {
				continue
			}
			h, ok := m.Data.(metricdata.Histogram[float64])
			if !ok {
				t.Fatalf("http.server.request.duration is %T, want a float64 histogram", m.Data)
			}
			for _, dp := range h.DataPoints {
				v, _ := dp.Attributes.Value("http.route")
				routes[v.AsString()] += dp.Count
			}
		}
	}
	return routes
}

// Every request is named by its route on both signals: the span name and
// http.route for traces, and the http.route label on the request metrics,
// which are recorded for every request while spans are sampled. A raw path in
// either place is one new series per URL a client invents.
//
// The subjects route without a built book, and the API request goes through
// the real comments mux, so its matched pattern is what gets reported.
func TestHandlerNamesRoutes(t *testing.T) {
	rec := installRecorder(t)
	reader := installMeterReader(t)
	prev := commentsAPI
	t.Cleanup(func() { commentsAPI = prev })
	commentsAPI = api.New(nil, api.Anonymous{}, nil)
	h := newHandler()

	cases := []struct{ path, route string }{
		{"/", "/"},
		{"/en/p3-reasoning/15-inference-time-scaling", "/en/{legacy}"},
		{"/safety/safety/reasoning/foundations/practice/agents-and-sandboxes", unknownRoute},
		{"/api/me", "/api/me"},
	}
	for _, c := range cases {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, c.path, nil))
	}

	spans := rec.Ended()
	if len(spans) != len(cases) {
		t.Fatalf("recorded %d spans, want %d", len(spans), len(cases))
	}
	for i, c := range cases {
		if got, want := spans[i].Name(), "GET "+c.route; got != want {
			t.Errorf("%s: span name %q, want %q", c.path, got, want)
		}
		var route string
		for _, kv := range spans[i].Attributes() {
			if kv.Key == "http.route" {
				route = kv.Value.AsString()
			}
		}
		if route != c.route {
			t.Errorf("%s: span http.route %q, want %q", c.path, route, c.route)
		}
	}

	routes := durationRoutes(t, reader)
	for _, c := range cases {
		if routes[c.route] != 1 {
			t.Errorf("request metrics: %d requests under http.route %q, want 1 (all: %v)",
				routes[c.route], c.route, routes)
		}
	}
	if len(routes) != len(cases) {
		t.Errorf("request metrics carry %d routes, want %d: %v", len(routes), len(cases), routes)
	}
}

// The reader posts its spans to the relay, and the relay forwards them to the
// collector under the OTLP signal path, body untouched. The request is named
// by the fixed relay route, never by the client-chosen subpath.
func TestTelemetryRelay(t *testing.T) {
	type forwarded struct{ method, path, body string }
	got := make(chan forwarded, 1)
	collector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("collector read: %v", err)
		}
		got <- forwarded{r.Method, r.URL.Path, string(b)}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(collector.Close)
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", collector.URL)

	prev := telemetryRelay
	t.Cleanup(func() { telemetryRelay = prev })
	telemetryRelay = pkgotel.TelemetryProxy(telemetryPrefix)
	rec := installRecorder(t)
	h := newHandler()

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/telemetry/v1/traces", strings.NewReader("spans"))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("POST relay: status %d, want the collector's 200 (body %q)", w.Code, w.Body.String())
	}
	select {
	case f := <-got:
		if f != (forwarded{http.MethodPost, "/v1/traces", "spans"}) {
			t.Errorf("collector received %+v, want POST /v1/traces with the body", f)
		}
	default:
		t.Fatal("the relay forwarded nothing to the collector")
	}

	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/v1/telemetry/v1/traces", nil))
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET relay: status %d, want 405", w.Code)
	}

	for _, s := range rec.Ended() {
		if s.SpanKind() != trace.SpanKindServer {
			continue
		}
		if s.Name() != "POST /v1/telemetry/{signal}" && s.Name() != "GET /v1/telemetry/{signal}" {
			t.Errorf("relay span named %q, want the fixed relay route", s.Name())
		}
	}
}
