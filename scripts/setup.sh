#!/usr/bin/env bash
#
# 블로그 전용 도구를 저장소의 .cache/toolchain에 설치한다 (Linux x86_64).
# 사용자 홈, 공용 도구, 셸 설정은 수정하지 않는다.
#
# 사용법:
#   bash scripts/setup.sh
#   bash scripts/run.sh hugo server -D
#
set -euo pipefail

# CI도 이 스크립트를 사용한다. Go 버전은 go.mod과 맞춘다.
HUGO_VERSION=0.149.0
SASS_VERSION=1.91.0
GO_VERSION=1.24.6

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLCHAIN="$PROJECT_ROOT/.cache/toolchain"
BIN="$TOOLCHAIN/bin"
mkdir -p "$BIN"

SETUP_TMP="$(mktemp -d "$TOOLCHAIN/.setup.XXXXXX")"
trap 'rm -rf "$SETUP_TMP"' EXIT

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }

# ── 아키텍처 확인 ─────────────────────────────────────────────────────────
if [ "$(uname -s)" != "Linux" ] || [ "$(uname -m)" != "x86_64" ]; then
  echo "이 스크립트는 Linux x86_64 전용입니다." >&2
  exit 1
fi

# ── Go ────────────────────────────────────────────────────────────────────
GO_BIN="$TOOLCHAIN/go/bin/go"
if [ -x "$GO_BIN" ] && [[ "$(GOTOOLCHAIN=local "$GO_BIN" version)" == "go version go${GO_VERSION} "* ]]; then
  ok "Go ${GO_VERSION} already installed"
else
  info "Installing Go ${GO_VERSION}"
  curl -fSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -o "$SETUP_TMP/go.tgz"
  tar -C "$SETUP_TMP" -xzf "$SETUP_TMP/go.tgz"
  rm -rf "$TOOLCHAIN/go"
  mv "$SETUP_TMP/go" "$TOOLCHAIN/go"
  ok "Go installed to $TOOLCHAIN/go"
fi

# ── Hugo Extended ─────────────────────────────────────────────────────────
HUGO_BIN="$BIN/hugo"
if [ -x "$HUGO_BIN" ] && [[ "$("$HUGO_BIN" version)" == "hugo v${HUGO_VERSION}-"*"extended"* ]]; then
  ok "Hugo Extended ${HUGO_VERSION} already installed"
else
  info "Installing Hugo Extended ${HUGO_VERSION}"
  curl -fSL "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" -o "$SETUP_TMP/hugo.tgz"
  tar -C "$SETUP_TMP" -xzf "$SETUP_TMP/hugo.tgz" hugo
  mv "$SETUP_TMP/hugo" "$HUGO_BIN"
  chmod +x "$HUGO_BIN"
  ok "Hugo installed to $HUGO_BIN"
fi

# ── Dart Sass ─────────────────────────────────────────────────────────────
SASS_BIN="$TOOLCHAIN/dart-sass/sass"
if [ -x "$SASS_BIN" ] && [ "$("$SASS_BIN" --version)" = "$SASS_VERSION" ]; then
  ok "Dart Sass ${SASS_VERSION} already installed"
else
  info "Installing Dart Sass ${SASS_VERSION}"
  curl -fSL "https://github.com/sass/dart-sass/releases/download/${SASS_VERSION}/dart-sass-${SASS_VERSION}-linux-x64.tar.gz" -o "$SETUP_TMP/sass.tgz"
  tar -C "$SETUP_TMP" -xzf "$SETUP_TMP/sass.tgz"
  rm -rf "$TOOLCHAIN/dart-sass"
  mv "$SETUP_TMP/dart-sass" "$TOOLCHAIN/dart-sass"
  chmod +x "$SASS_BIN"
  ok "Dart Sass installed to $TOOLCHAIN/dart-sass"
fi

# ── 검증 ──────────────────────────────────────────────────────────────────
info "설치된 버전"
bash "$PROJECT_ROOT/scripts/run.sh" go version
bash "$PROJECT_ROOT/scripts/run.sh" hugo version
bash "$PROJECT_ROOT/scripts/run.sh" sass --version
ok "완료! 프로젝트 실행: bash scripts/run.sh hugo server -D"
