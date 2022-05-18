#!/bin/bash
{
    set -e
    bash <<SCRIPT
  set -e

  echoerr() { echo "\$@" 1>&2; }

  if [[ ! ":\$PATH:" == *":/usr/local/bin:"* ]]; then
    echoerr "Your path is missing /usr/local/bin, you need to add this to use this installer."
    exit 1
  fi

  if [ "\$(uname)" == "Darwin" ]; then
    OS=darwin
  elif [ "\$(expr substr \$(uname -s) 1 5)" == "Linux" ]; then
    OS=linux
  else
    echoerr "This installer is only supported on Linux and MacOS"
    exit 1
  fi

  ARCH="\$(uname -m)"
  if [ "\$ARCH" == "x86_64" ]; then
    ARCH=x64
  elif [[ "\$ARCH" == aarch* ]]; then
    ARCH=arm
  else
    echoerr "unsupported arch: \$ARCH"
    exit 1
  fi

  mkdir -p /usr/local/lib
  cd /usr/local/lib
  rm -rf hive
  rm -rf ~/.local/share/hive


  URL=https://graphql-hive-cli-test.s3.us-east-2.amazonaws.com/channels/stable/hive-\$OS-\$ARCH.tar.gz
  TAR_ARGS="xz"
  echo "Installing CLI from \$URL"

  if [ \$(command -v curl) ]; then
    curl "\$URL" | tar "\$TAR_ARGS"
  else
    wget -O- "\$URL" | tar "\$TAR_ARGS"
  fi
  
  # delete old hive bin if exists
  rm -f \$(command -v hive) || true
  rm -f /usr/local/bin/hive
  ln -s /usr/local/lib/hive/bin/hive /usr/local/bin/hive

SCRIPT
  LOCATION=$(command -v hive)
  echo "GraphQL Hive installed to $LOCATION"
  hive --version
}
