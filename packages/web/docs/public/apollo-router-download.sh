#!/bin/bash

set -u

COMMIT="latest"
OS="$(uname -s)"

# Parse Flags
parse_args() {
  while [[ $# -gt 0 ]]; do
    key="$1"

    case $key in
      -c | --commit)
        COMMIT="$2"
        shift # past commit argument
        shift # past commit value
        ;;
      *)
        echo "Unrecognized argument $key"
        exit 1
        ;;
    esac
  done
}

set_target() {
  case "$OS" in
    Linux)
      TARGET="linux"
      EXT=""
      ;;

    Darwin)
      TARGET=macos
      EXT=""
      ;;

    MINGW* | MSYS* | CYGWIN*)
      TARGET=win
      EXT=".exe"
      ;;

    *)
      echo "OS $OS is not supported."
      echo "If you think that's a bug - please file an issue to https://github.com/kamilkisiela/graphql-hive/issues"
      exit 1
      ;;
  esac
}

download() {
  DOWNLOAD_DIR=$(mktemp -d)

  URL="https://apollo-router.theguild.workers.dev/$TARGET/$COMMIT"
  echo "Downloading $URL"

  if ! curl --progress-bar --fail -L "$URL" -o "$DOWNLOAD_DIR/router.tar.gz"; then
    echo "Download failed."
    exit 1
  fi

  tar xzf "$DOWNLOAD_DIR/router.tar.gz"
}

parse_args "$@"
set_target
download
