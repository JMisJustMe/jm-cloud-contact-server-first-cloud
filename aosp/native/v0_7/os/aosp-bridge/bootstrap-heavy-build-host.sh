#!/usr/bin/env bash
set -euo pipefail

# JM AOSP Heavy Build Host Bootstrap v0.6
#
# Prepares a Debian/Ubuntu-class 64-bit Linux carrier for the compile-only
# contact route. It does NOT claim a build Ding and it deliberately does not
# require Cuttlefish/KVM; boot is a separate returned-contact gate.

MODE="${1:-preflight}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "[JM AOSP] HOLD: Linux host required." >&2
  exit 78
fi

ARCH="$(uname -m)"
if [[ "$ARCH" != "x86_64" && "$ARCH" != "amd64" ]]; then
  echo "[JM AOSP] HOLD: x86_64 host required; got $ARCH." >&2
  exit 78
fi

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  echo "[JM AOSP] HOLD: root or sudo is required for host bootstrap." >&2
  exit 78
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[JM AOSP] HOLD: this bootstrap currently targets Debian/Ubuntu apt hosts." >&2
  exit 78
fi

export DEBIAN_FRONTEND=noninteractive

$SUDO apt-get update
$SUDO apt-get install -y \
  git-core \
  gnupg \
  flex \
  bison \
  build-essential \
  zip \
  curl \
  zlib1g-dev \
  libc6-dev-i386 \
  x11proto-core-dev \
  libx11-dev \
  lib32z1-dev \
  libgl1-mesa-dev \
  libxml2-utils \
  xsltproc \
  unzip \
  fontconfig \
  repo \
  nodejs

echo "[JM AOSP] git:  $(git --version)"
echo "[JM AOSP] repo: $(repo version | head -n 1)"
echo "[JM AOSP] node: $(node --version)"
echo "[JM AOSP] KVM presence is informational for compile-only contact:"
if [[ -e /dev/kvm ]]; then
  ls -l /dev/kvm
else
  echo "[JM AOSP] /dev/kvm absent — compile can still proceed; boot remains a separate carrier gate."
fi

case "$MODE" in
  preflight)
    exec node "$SCRIPT_DIR/run-jm-aosp-contact.mjs"
    ;;
  --execute-build|execute-build)
    exec node "$SCRIPT_DIR/run-jm-aosp-contact.mjs" --execute-build
    ;;
  *)
    echo "Usage: $0 [preflight|--execute-build]" >&2
    exit 64
    ;;
esac
