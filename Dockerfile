# The deployable is a single self-contained Go binary with the whole compiled
# book embedded in it. Nothing is vendored in git and there is no separate web
# server: stage 1 compiles _book/ from source with Bun, stage 2 embeds it into
# the Go binary, and the final image is just that static binary. See main.go for
# the routing it serves and .github/workflows/docker.yml for the CI build.

# syntax=docker/dockerfile:1

# Stage 1: compile the reader's static output (_book/) from the .qmd sources.
FROM oven/bun:1 AS book
WORKDIR /src
# Install deps first (cached unless the lockfile changes).
COPY app/package.json app/bun.lock ./app/
RUN cd app && bun install --frozen-lockfile
# Then the sources, and build _book/{en,zh} (+ og cards copied from app/static/og).
COPY . .
RUN cd app && bun run build

# Stage 2: build the Go server with _book/ embedded (//go:embed all:_book).
FROM golang:1.26 AS server
WORKDIR /src
# Dependencies first (cached unless go.mod/go.sum change). go mod download
# fetches the private latere.ai/x/pkg the same way the sibling services do.
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
COPY internal/ ./internal/
COPY migrations/ ./migrations/
COPY --from=book /src/_book ./_book
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /aaai-web .

# Stage 3: nothing but the binary. Runs unprivileged (uid set by the pod
# securityContext); the embedded assets need no writable filesystem.
FROM scratch
COPY --from=server /aaai-web /aaai-web
EXPOSE 8080
ENTRYPOINT ["/aaai-web"]
