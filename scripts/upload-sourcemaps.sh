#!/bin/bash

pnpm sentry-cli releases new $SENTRY_RELEASE

for dir in packages/services/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  echo $name

  pnpm sentry-cli sourcemaps inject $dir

  if [[ $name == *-worker ]]; then
    pnpm sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $dir --dist $name \;
  else
    pnpm sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $dir --dist $name --url-prefix /usr/src/app/\@hive/$name \;
  fi
done

pnpm sentry-cli sourcemaps inject packages/web/app/dist
pnpm sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $dir --dist webapp --url-prefix ~/ \;

pnpm sentry-cli releases finalize "$SENTRY_RELEASE"
