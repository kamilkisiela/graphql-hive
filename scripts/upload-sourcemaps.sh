#!/bin/bash

for dir in packages/services/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  echo $name
  pnpm sentry-cli sourcemaps inject $dir
  pnpm sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $dir --no-sourcemap-reference --url-prefix --dist $name /usr/src/app/\@hive/$name \;
done

for dir in packages/web/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  echo $name
  pnpm sentry-cli sourcemaps inject $dir
  pnpm sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $dir --no-sourcemap-reference --url-prefix --dist $name /usr/src/app/\@hive/$name \;
done
