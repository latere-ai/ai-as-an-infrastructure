package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The image builds the server from the files the Dockerfile copies, not from
// the checkout. A Go file of package main that no COPY names compiles in every
// local build and test run, then fails the image build with an undefined
// symbol, which is how route.go first shipped.
func TestDockerfileCopiesServerSources(t *testing.T) {
	raw, err := os.ReadFile("Dockerfile")
	if err != nil {
		t.Fatalf("read Dockerfile: %v", err)
	}
	var sources []string
	inServer := false
	for line := range strings.SplitSeq(string(raw), "\n") {
		f := strings.Fields(line)
		if len(f) == 0 {
			continue
		}
		switch strings.ToUpper(f[0]) {
		case "FROM":
			inServer = strings.EqualFold(f[len(f)-1], "server")
		case "COPY":
			// COPY [--flags] src... dest; only sources from the build context.
			if !inServer || strings.HasPrefix(line, "COPY --from") {
				continue
			}
			args := f[1:]
			for len(args) > 0 && strings.HasPrefix(args[0], "--") {
				args = args[1:]
			}
			if len(args) > 1 {
				sources = append(sources, args[:len(args)-1]...)
			}
		}
	}
	if len(sources) == 0 {
		t.Fatal("no COPY in the Dockerfile's server stage")
	}

	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		copied := false
		for _, src := range sources {
			if ok, err := filepath.Match(src, name); err == nil && ok {
				copied = true
				break
			}
		}
		if !copied {
			t.Errorf("%s is not copied into the server stage (sources: %v)", name, sources)
		}
	}
}
