#!/usr/bin/env bash
#
# 새 로컬(WSL2 Ubuntu, x86_64)에서 이 블로그 개발 환경을 한 번에 갖춘다.
# CI(.github/workflows/deploy.yml) 및 go.mod과 동일한 버전을 ~/.local 에 설치한다.
# sudo 불필요. 이미 올바른 버전이면 건너뛰므로 여러 번 실행해도 안전하다.
#
# 사용법:
#   bash scripts/setup.sh
#   source ~/.bashrc      # 또는 새 터미널
#   hugo mod tidy && hugo server -D
#
set -euo pipefail

# ── 버전 (deploy.yml / go.mod 과 일치시킬 것) ─────────────────────────────
HUGO_VERSION=0.149.0
SASS_VERSION=1.91.0
GO_VERSION=1.24.6

LOCAL="$HOME/.local"
BIN="$LOCAL/bin"
mkdir -p "$BIN"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }

# ── 아키텍처 확인 ─────────────────────────────────────────────────────────
ARCH="$(uname -m)"
if [ "$ARCH" != "x86_64" ]; then
  echo "이 스크립트는 x86_64 (linux-amd64) 전용입니다. 감지된 아키텍처: $ARCH" >&2
  echo "다른 아키텍처는 스크립트 상단 다운로드 URL을 직접 수정하세요." >&2
  exit 1
fi

# ── Go ────────────────────────────────────────────────────────────────────
GO_BIN="$LOCAL/go/bin/go"
if [ -x "$GO_BIN" ] && "$GO_BIN" version 2>/dev/null | grep -q "go${GO_VERSION}"; then
  ok "Go ${GO_VERSION} already installed"
else
  info "Installing Go ${GO_VERSION}"
  curl -fSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -o "$TMP/go.tgz"
  rm -rf "$LOCAL/go"
  tar -C "$LOCAL" -xzf "$TMP/go.tgz"
  ok "Go installed to $LOCAL/go"
fi

# ── Hugo Extended ─────────────────────────────────────────────────────────
HUGO_BIN="$BIN/hugo"
if [ -x "$HUGO_BIN" ] && "$HUGO_BIN" version 2>/dev/null | grep -q "v${HUGO_VERSION}" \
   && "$HUGO_BIN" version 2>/dev/null | grep -qi "extended"; then
  ok "Hugo Extended ${HUGO_VERSION} already installed"
else
  info "Installing Hugo Extended ${HUGO_VERSION}"
  curl -fSL "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" -o "$TMP/hugo.tgz"
  tar -C "$BIN" -xzf "$TMP/hugo.tgz" hugo
  chmod +x "$HUGO_BIN"
  ok "Hugo installed to $HUGO_BIN"
fi

# ── Dart Sass ─────────────────────────────────────────────────────────────
SASS_BIN="$LOCAL/dart-sass/sass"
if [ -x "$SASS_BIN" ] && "$SASS_BIN" --version 2>/dev/null | grep -q "^${SASS_VERSION}"; then
  ok "Dart Sass ${SASS_VERSION} already installed"
else
  info "Installing Dart Sass ${SASS_VERSION}"
  curl -fSL "https://github.com/sass/dart-sass/releases/download/${SASS_VERSION}/dart-sass-${SASS_VERSION}-linux-x64.tar.gz" -o "$TMP/sass.tgz"
  rm -rf "$LOCAL/dart-sass"
  tar -C "$LOCAL" -xzf "$TMP/sass.tgz"   # -> $LOCAL/dart-sass/
  chmod +x "$SASS_BIN"
  ok "Dart Sass installed to $LOCAL/dart-sass"
fi

# ── PATH 등록 (~/.bashrc, 중복 방지) ──────────────────────────────────────
PATH_LINE='export PATH="$HOME/.local/go/bin:$HOME/.local/bin:$HOME/.local/dart-sass:$PATH"'
BASHRC="$HOME/.bashrc"
if ! grep -qF "$PATH_LINE" "$BASHRC" 2>/dev/null; then
  info "Adding PATH entries to $BASHRC"
  {
    echo ''
    echo '# Hugo blog toolchain (added by scripts/setup.sh)'
    echo "$PATH_LINE"
  } >> "$BASHRC"
  ok "PATH updated"
else
  ok "PATH already configured in $BASHRC"
fi

# 현재 셸에서도 즉시 사용 가능하도록
export PATH="$HOME/.local/go/bin:$HOME/.local/bin:$HOME/.local/dart-sass:$PATH"

# ── 검증 ──────────────────────────────────────────────────────────────────
echo
info "설치된 버전"
go version
hugo version
sass --version

echo
ok "완료! 새 셸이라면 아래를 먼저 실행하세요:"
echo "    source ~/.bashrc"
echo
echo "그다음 개발 서버 실행:"
echo "    hugo mod tidy && hugo server -D   # http://localhost:1313"
