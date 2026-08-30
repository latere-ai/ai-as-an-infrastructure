// Package deploy tests the Kubernetes manifests. They are applied by the
// release pipeline against the live cluster, so a mistake here surfaces as a
// broken deployment rather than a failed build.
package deploy

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

// otlpEndpoint is the collector every latere service exports to. The shared
// telemetry library resolves its endpoint from the standard OTEL_ environment
// and stays a noop when it is unset, so an instrumented binary deployed
// without this variable is silent.
const otlpEndpoint = "http://otel-collector.observability.svc:4318"

type deployment struct {
	Kind string `yaml:"kind"`
	Spec struct {
		Template struct {
			Spec struct {
				Containers []struct {
					Name string `yaml:"name"`
					Env  []struct {
						Name  string `yaml:"name"`
						Value string `yaml:"value"`
					} `yaml:"env"`
				} `yaml:"containers"`
			} `yaml:"spec"`
		} `yaml:"template"`
	} `yaml:"spec"`
}

// loadDeployment returns the Deployment document from the base manifest. The
// file is decoded document by document rather than unmarshalled whole, so a
// manifest that later grows a second document does not break the test.
func loadDeployment(t *testing.T) deployment {
	t.Helper()
	f, err := os.Open(filepath.Join("base", "deployment.yaml"))
	if err != nil {
		t.Fatalf("open deployment.yaml: %v", err)
	}
	defer func() {
		if err := f.Close(); err != nil {
			t.Errorf("close deployment.yaml: %v", err)
		}
	}()

	dec := yaml.NewDecoder(f)
	for {
		var d deployment
		err := dec.Decode(&d)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatalf("parse deployment.yaml: %v", err)
		}
		if d.Kind == "Deployment" {
			return d
		}
	}
	t.Fatal("deployment.yaml contains no Deployment document")
	return deployment{}
}

func TestDeploymentExportsTelemetry(t *testing.T) {
	d := loadDeployment(t)
	containers := d.Spec.Template.Spec.Containers
	if len(containers) == 0 {
		t.Fatal("deployment declares no containers")
	}
	for _, c := range containers {
		var got string
		var found bool
		for _, e := range c.Env {
			if e.Name == "OTEL_EXPORTER_OTLP_ENDPOINT" {
				got, found = e.Value, true
			}
		}
		if !found {
			t.Errorf("container %q: OTEL_EXPORTER_OTLP_ENDPOINT is unset, so the service exports nothing", c.Name)
			continue
		}
		if got != otlpEndpoint {
			t.Errorf("container %q: OTEL_EXPORTER_OTLP_ENDPOINT = %q, want %q", c.Name, got, otlpEndpoint)
		}
	}
}
