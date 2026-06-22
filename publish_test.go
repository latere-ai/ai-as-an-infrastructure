package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestPublishIgnoresConflictingRemoteTags(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	tmp := t.TempDir()
	remote := filepath.Join(tmp, "remote.git")
	source := filepath.Join(tmp, "source")
	project := filepath.Join(tmp, "project")

	runCmd(t, tmp, nil, "git", "init", "--bare", remote)
	runCmd(t, tmp, nil, "git", "init", "-b", "main", source)
	runCmd(t, source, nil, "git", "config", "user.email", "test@example.com")
	runCmd(t, source, nil, "git", "config", "user.name", "Test User")

	publishScript, err := os.ReadFile(filepath.Join("deploy", "publish.sh"))
	if err != nil {
		t.Fatalf("read publish script: %v", err)
	}

	writeTestFile(t, filepath.Join(source, "README.md"), "test project\n", 0o644)
	writeTestFile(t, filepath.Join(source, "deploy", "publish.sh"), string(publishScript), 0o644)
	writeTestFile(t, filepath.Join(source, "deploy", "smoke.sh"), "#!/bin/sh\nexit 0\n", 0o755)
	writeTestFile(t, filepath.Join(source, "deploy", "prod", ".keep"), "", 0o644)
	runCmd(t, source, nil, "git", "add", "README.md", "deploy")
	runCmd(t, source, nil, "git", "commit", "-m", "initial publish fixture")
	runCmd(t, source, nil, "git", "tag", "v0.0.1")
	runCmd(t, source, nil, "git", "remote", "add", "origin", remote)
	runCmd(t, source, nil, "git", "push", "-u", "origin", "main")
	runCmd(t, source, nil, "git", "push", "origin", "v0.0.1")
	runCmd(t, tmp, nil, "git", "--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main")

	runCmd(t, tmp, nil, "git", "clone", remote, project)

	writeTestFile(t, filepath.Join(source, "version.txt"), "second commit\n", 0o644)
	runCmd(t, source, nil, "git", "add", "version.txt")
	runCmd(t, source, nil, "git", "commit", "-m", "move branch tip")
	runCmd(t, source, nil, "git", "tag", "-f", "v0.0.1")
	runCmd(t, source, nil, "git", "push", "origin", "main")
	runCmd(t, source, nil, "git", "push", "--force", "origin", "v0.0.1")

	runCmd(t, project, nil, "git", "fetch", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main")
	runCmd(t, project, nil, "git", "merge", "--ff-only", "origin/main")

	fakeBin := filepath.Join(tmp, "bin")
	writeTestFile(t, filepath.Join(fakeBin, "gh"), "#!/bin/sh\nprintf '1\\tcompleted\\tsuccess\\thttps://example.test/run\\n'\n", 0o755)
	writeTestFile(t, filepath.Join(fakeBin, "kubectl"), "#!/bin/sh\nexit 0\n", 0o755)
	writeTestFile(t, filepath.Join(fakeBin, "curl"), "#!/bin/sh\nexit 0\n", 0o755)
	writeTestFile(t, filepath.Join(fakeBin, "docker"), "#!/bin/sh\nexit 0\n", 0o755)

	env := append(os.Environ(),
		"PATH="+fakeBin+string(os.PathListSeparator)+os.Getenv("PATH"),
		"BASE_URL=https://example.test",
		"PUBLISH_TIMEOUT=3",
		"PUBLISH_POLL_INTERVAL=1",
		"SMOKE_ATTEMPTS=1",
	)
	runCmd(t, project, env, "sh", "deploy/publish.sh")
}

func runCmd(t *testing.T, dir string, env []string, name string, args ...string) {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	if env != nil {
		cmd.Env = env
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("%s %v failed: %v\n%s", name, args, err, out)
	}
}

func writeTestFile(t *testing.T, path, body string, perm os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(body), perm); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
