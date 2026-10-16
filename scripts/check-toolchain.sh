#!/usr/bin/env bash
# 외부 PATH/Go 설정이 있어도 프로젝트 도구와 캐시를 선택하는지 검사한다.
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$PROJECT_ROOT/.cache"
CHECK_DIR="$(mktemp -d "$PROJECT_ROOT/.cache/toolchain-check.XXXXXX")"
trap 'rm -rf "$CHECK_DIR"' EXIT
mkdir "$CHECK_DIR/bin"
for name in go hugo sass; do
  printf '#!/bin/sh\nexit 99\n' > "$CHECK_DIR/bin/$name"
  chmod +x "$CHECK_DIR/bin/$name"
done

cd "$CHECK_DIR"
CALLER_PATH="$PATH"
PATH="$CHECK_DIR/bin:$PATH" \
  GOROOT=/missing GOPATH=/missing GOMODCACHE=/missing GOCACHE=/missing \
  GOTOOLCHAIN=auto GOENV=/missing HUGO_CACHEDIR=/missing \
  bash "$PROJECT_ROOT/scripts/run.sh" bash -euc '
    test "$(command -v go)" = "$PWD/.cache/toolchain/go/bin/go"
    test "$(command -v hugo)" = "$PWD/.cache/toolchain/bin/hugo"
    test "$(command -v sass)" = "$PWD/.cache/toolchain/dart-sass/sass"
    test "$(go env GOROOT)" = "$PWD/.cache/toolchain/go"
    test "$(go env GOPATH)" = "$PWD/.cache/go"
    test "$(go env GOMODCACHE)" = "$PWD/.cache/go/pkg/mod"
    test "$(go env GOCACHE)" = "$PWD/.cache/go-build"
    test "$(go env GOTOOLCHAIN)" = local
    test "$GOENV" = off
    test -z "$(go env GOENV)"
    test "$HUGO_CACHEDIR" = "$PWD/.cache/hugo"
    go version
    hugo version
    sass --version
  '
test "$PATH" = "$CALLER_PATH"
printf 'Project toolchain checks passed; caller PATH is unchanged.\n'
