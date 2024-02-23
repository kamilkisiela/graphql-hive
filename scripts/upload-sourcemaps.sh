#!/bin/bash

pnpm sentry-cli releases new $SENTRY_RELEASE

for dir in packages/services/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  echo $name
  pnpm sentry-cli sourcemaps inject $dir
  pnpm sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $dir --dist $name --url-prefix /usr/src/app/\@hive/$name \;
done

pnpm sentry-cli releases set-commits --auto $SENTRY_RELEASE
pnpm sentry-cli releases finalize "$SENTRY_RELEASE"

# for dir in packages/web/*/dist; do
#   name=$(echo $dir | awk -F / '{print $3}')
#   echo $name
#   pnpm sentry-cli sourcemaps inject $dir
#   pnpm sentry-cli sourcemaps upload --release=$SENTRY_RELEASE $dir --no-sourcemap-reference --url-prefix --dist $name /usr/src/app/\@hive/$name \;
# done
