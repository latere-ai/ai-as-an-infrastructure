# _book is a vendored build: the pre-commit hook compiles it from app/ (the
# React + Bun reader) and commits it, so this stage stays thin: a static,
# unprivileged nginx serving the prebuilt HTML. See .github/workflows/docker.yml.
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY _book /usr/share/nginx/html

EXPOSE 8080
