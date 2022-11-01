#!/bin/bash

for dir in packages/services/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  pnpm sentry-cli releases files $SENTRY_RELEASE upload-sourcemaps $dir --no-rewrite --no-sourcemap-reference --url-prefix /app/node_modules/\@hive/$name \;
done

for dir in packages/web/*/dist; do
  name=$(echo $dir | awk -F / '{print $3}')
  pnpm sentry-cli releases files $SENTRY_RELEASE upload-sourcemaps $dir --no-rewrite --no-sourcemap-reference --url-prefix /app/node_modules/\@hive/$name \;
done
