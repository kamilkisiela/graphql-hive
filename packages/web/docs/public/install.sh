#!/bin/sh
{
  set -e
  SUDO=''
  if [ "$(id -u)" != "0" ]; then
    SUDO='sudo'
    echo "This script requires superuser access."
    echo "You will be prompted for your password by sudo."
    # clear any previous sudo permission
    sudo -k
  fi

  # Supports these options of passing a version:
  # 1.
  #   curl -sSL https://cli.graphql-hive.com/install.sh | HIVE_CLI_VERSION=0.30.1 sh
  # 2.
  #   export HIVE_CLI_VERSION="0.30.1"
  #   curl -sSL https://cli.graphql-hive.com/install.sh | sh
  # 3.
  #   curl -sSL https://cli.graphql-hive.com/install.sh | sh -s 0.30.1
  VERSION_FROM_FIRST_ARG="$1"
  # if HIVE_CLI_VERSION and VERSION_FROM_FIRST_ARG are empty, ignore the HIVE_CLI_VERSION
  if [ -z "$VERSION_FROM_FIRST_ARG" ] && [ -z "$HIVE_CLI_VERSION" ]; then
    REQUESTED_VERSION=""
  else
    REQUESTED_VERSION="${HIVE_CLI_VERSION:-$VERSION_FROM_FIRST_ARG}"
  fi

  # run inside sudo
  $SUDO sh << SCRIPT
      set -e
      
      OS=""
      ARCH=""
      DOWNLOAD_PATH_BASE=""

      echoerr() { echo "\$@" 1>&2; }

      unsupported_arch() {
        echoerr "GraphQL Hive CLI does not support \$@ at this time."
        echo "If you think that's a bug - please file an issue to https://github.com/kamilkisiela/graphql-hive/issues"
        exit 1
      }

      unsupported_win() {
        echoerr "This installation script does not support Windows."
        echo "Go to https://docs.graphql-hive.com and look for Windows installer."
        exit 1
      }

      starts_with() { case \$2 in "\$1"*) true;; *) false;; esac; }

      set_download_path_base() {
        if [ -z "${REQUESTED_VERSION:-}" ]; then
          # no version set, install latest
          DOWNLOAD_PATH_BASE="https://cli.graphql-hive.com/channels/stable/hive-"
        else
          DOWNLOAD_PATH_BASE="https://cli.graphql-hive.com/versions/$REQUESTED_VERSION/hive-v$REQUESTED_VERSION-"
        fi
      }

      set_os_arch() {
        if [ "\$(uname)" = "Darwin" ]; then
          OS=darwin
        elif [ "\$(expr substr \$(uname -s) 1 5)" = "Linux" ]; then
          OS=linux
        else
          unsupported_win
        fi

        ARCH="\$(uname -m)"
        if [ "\$ARCH" = "x86_64" ]; then
          ARCH=x64
        elif [ "\$ARCH" = "amd64" ]; then
          ARCH=x64
        elif [ "\$ARCH" = "arm64" ]; then
          if [ "\$OS" = "darwin" ]; then
            ARCH=arm64
          else
            ARCH=arm
          fi
        elif starts_with "aarch" "\$ARCH"; then
          ARCH=arm
        else
         unsupported_arch "\$OS / \$ARCH"
        fi
      }

      has_cmd() {
        command -v "\$1" > /dev/null 2>&1
        return \$?
      }

      download() {
        DOWNLOAD_DIR=$(mktemp -d)

        TARGET="\$OS-\$ARCH"
        URL="\$DOWNLOAD_PATH_BASE\$TARGET.tar.gz"
        echo "Downloading \$URL"

        if has_cmd curl
        then curl --progress-bar --fail -L "\$URL" -o "\$DOWNLOAD_DIR/hive.tar.gz" || exit 1
        elif has_cmd wget
        then wget "\$URL" -O "\$DOWNLOAD_DIR/hive.tar.gz" || exit 1
        else echoerr "curl or wget is required" && exit 1
        fi

        echo "Downloaded to \$DOWNLOAD_DIR"

        rm -rf "/usr/local/lib/hive"
        tar xzf "\$DOWNLOAD_DIR/hive.tar.gz" -C /usr/local/lib
        rm -rf "\$DOWNLOAD_DIR"
        echo "Unpacked to /usr/local/lib/hive"

        echo "Installing to /usr/local/bin/hive"
        rm -f /usr/local/bin/hive
        ln -s /usr/local/lib/hive/bin/hive /usr/local/bin/hive
      }

      set_os_arch
      set_download_path_base
      download || exit 1

SCRIPT
  LOCATION=$(command -v hive)
  echo "GraphQL Hive CLI installed to $LOCATION"
  hive --version
}
