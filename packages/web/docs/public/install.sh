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

  # run inside sudo
  $SUDO sh << SCRIPT
      set -e
      
      OS=""
      ARCH=""

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
        elif [[ "\$ARCH" = aarch* ]]; then
          ARCH=arm
        else
         unsupported_arch "\$OS / \$ARCH"
        fi
      }

      download() {
        DOWNLOAD_DIR=$(mktemp -d)

        TARGET="\$OS-\$ARCH"
        URL="https://graphql-hive-cli.s3.us-east-2.amazonaws.com/channels/stable/hive-\$TARGET.tar.gz"
        echo "Downloading \$URL"

        if ! curl --progress-bar --fail -L "\$URL" -o "\$DOWNLOAD_DIR/hive.tar.gz"; then
          echo "Download failed."
          exit 1
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
      download

SCRIPT
LOCATION=$(command -v hive)
echo "GraphQL Hive CLI installed to $LOCATION"
hive --version
}