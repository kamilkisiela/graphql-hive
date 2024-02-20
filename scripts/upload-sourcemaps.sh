#!/bin/bash

for dir in packages/services/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  echo $name
  pnpm sentry-cli releases files $SENTRY_RELEASE upload-sourcemaps $dir --no-rewrite --ignore node_modules --no-sourcemap-reference --url-prefix /usr/src/app/\@hive/$name \;
done

for dir in packages/web/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  echo $name
  pnpm sentry-cli releases files $SENTRY_RELEASE upload-sourcemaps $dir --no-rewrite --ignore node_modules --no-sourcemap-reference --url-prefix /usr/src/app/\@hive/$name \;
done
