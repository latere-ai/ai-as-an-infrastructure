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

// injectedByOperator are the variables the Dash0 operator supplies. It points
// workloads at the collector on their own node and must be the only writer of
// these two: it skips any container that already sets either one, emitting only
// a Warning event. A manifest that sets them therefore reads as configured
// while its telemetry goes to whatever the value names, which after the Dash0
// migration is nothing.
var injectedByOperator = []string{
	"OTEL_EXPORTER_OTLP_ENDPOINT",
	"OTEL_EXPORTER_OTLP_PROTOCOL",
}

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

func TestDeploymentLeavesTelemetryToTheOperator(t *testing.T) {
	d := loadDeployment(t)
	containers := d.Spec.Template.Spec.Containers
	if len(containers) == 0 {
		t.Fatal("deployment declares no containers")
	}
	for _, c := range containers {
		for _, e := range c.Env {
			for _, name := range injectedByOperator {
				if e.Name == name {
					t.Errorf("container %q sets %s=%q; the Dash0 operator skips containers that set it, so this container would export to the named address instead of the node-local collector. Remove it and let the operator inject.", c.Name, name, e.Value)
				}
			}
		}
	}
}
