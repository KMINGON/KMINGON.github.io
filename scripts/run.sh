#!/usr/bin/env bash
# 도구와 캐시 경로는 이 명령의 자식 프로세스에만 적용한다. 보안 샌드박스가 아니다.
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_CACHE="$PROJECT_ROOT/.cache"
TOOLCHAIN="$PROJECT_CACHE/toolchain"

if [ "$#" -eq 0 ]; then
  echo "Usage: bash scripts/run.sh <command> [arguments...]" >&2
  exit 2
fi
for executable in go/bin/go bin/hugo dart-sass/sass; do
  if [ ! -x "$TOOLCHAIN/$executable" ]; then
    echo "도구가 없습니다. 먼저 bash scripts/setup.sh를 실행하세요." >&2
    exit 1
  fi
done

export PATH="$TOOLCHAIN/go/bin:$TOOLCHAIN/bin:$TOOLCHAIN/dart-sass:$PATH"
export GOROOT="$TOOLCHAIN/go"
export GOPATH="$PROJECT_CACHE/go"
export GOMODCACHE="$GOPATH/pkg/mod"
export GOCACHE="$PROJECT_CACHE/go-build"
export GOTOOLCHAIN=local
export GOENV=off
export HUGO_CACHEDIR="$PROJECT_CACHE/hugo"
mkdir -p "$GOMODCACHE" "$GOCACHE" "$HUGO_CACHEDIR"
cd "$PROJECT_ROOT"
exec "$@"
