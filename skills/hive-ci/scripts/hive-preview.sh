#!/bin/sh
# shellcheck shell=sh
#
# Hive preview targets: one schema registry target per pull request (flow D).
#
# Copy this file into the repository as scripts/hive-preview.sh. Set the variables below, then
# source it from the CI step that runs after `hive schema:check` has passed:
#
#   . scripts/hive-preview.sh
#   hive_preview_publish
#
# When the pull request is merged (or closed), in a job that runs one at a time per pull request:
#
#   . scripts/hive-preview.sh
#   if preview_target_exists; then delete_preview_target; fi
#
# Requires a POSIX shell, curl, and the Hive CLI (`hive`) on PATH.
#
# Variables, set before sourcing:
#   HIVE_TOKEN         Access token with target:create and, on all targets of the project,
#                      target:delete, schemaVersion:promote, schemaCheck:create and
#                      schemaVersion:publish. create_preview_cdn_token also needs
#                      cdnAccessToken:modify.
#   HIVE_ORGANIZATION  Organization slug.
#   HIVE_PROJECT       Project slug.
#   HIVE_TARGET        Base target whose latest version is promoted into the preview target.
#   PR_NUMBER          Pull request number. The preview target is named pr-<number>.
#   SCHEMA_PATH        Schema file, glob or URL, for hive_preview_publish.
#   COMMIT, AUTHOR     Commit SHA and author, for hive_preview_publish.
#   SERVICE_NAME       Federation and stitching only: the service name.
#   SERVICE_URL        Federation and stitching only: the service URL.
#   HIVE_REGISTRY      Self-hosted Hive only: the registry's GraphQL endpoint.

# Target slugs are at most 50 characters of lowercase letters, digits and dashes, so the slug is
# built from the pull request number, never from the branch name.
PREVIEW_TARGET="pr-$PR_NUMBER"
# Hive Cloud's API endpoint. Self-hosted Hive serves the API at its registry endpoint.
HIVE_API="${HIVE_REGISTRY:-https://api.graphql-hive.com/graphql}"

hive_api() {
  curl -sS "$HIVE_API" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $HIVE_TOKEN" \
    --data "$1"
}

preview_target_exists() {
  hive_api "$(printf '{"query":"query HiveCiPreviewTarget($target: TargetReferenceInput!) { target(reference: $target) { id } }","variables":{"target":{"bySelector":{"organizationSlug":"%s","projectSlug":"%s","targetSlug":"%s"}}}}' \
    "$HIVE_ORGANIZATION" "$HIVE_PROJECT" "$PREVIEW_TARGET")" | grep -q '"id"'
}

create_preview_target() {
  response=$(hive_api "$(printf '{"query":"mutation HiveCiCreatePreviewTarget($input: CreateTargetInput!) { createTarget(input: $input) { ok { createdTarget { id } } error { message } } }","variables":{"input":{"project":{"bySelector":{"organizationSlug":"%s","projectSlug":"%s"}},"slug":"%s"}}}' \
    "$HIVE_ORGANIZATION" "$HIVE_PROJECT" "$PREVIEW_TARGET")")
  echo "$response" | grep -q '"createdTarget"' || {
    echo "Could not create target $PREVIEW_TARGET: $response" >&2
    return 1
  }
}

delete_preview_target() {
  response=$(hive_api "$(printf '{"query":"mutation HiveCiDeletePreviewTarget($input: DeleteTargetInput!) { deleteTarget(input: $input) { ok { deletedTargetId } error { message } } }","variables":{"input":{"target":{"bySelector":{"organizationSlug":"%s","projectSlug":"%s","targetSlug":"%s"}}}}}' \
    "$HIVE_ORGANIZATION" "$HIVE_PROJECT" "$PREVIEW_TARGET")")
  echo "$response" | grep -q '"deletedTargetId"' || {
    echo "Could not delete target $PREVIEW_TARGET: $response" >&2
    return 1
  }
}

# Creates the target if it is missing, promotes the base target's latest version into it, then
# publishes the pull request's schema to it. Returns 1 on the first step that fails, so the caller
# does not need `set -e`.
hive_preview_publish() {
  preview_target_exists || create_preview_target || return 1
  hive schema:promote \
    --from "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
    --to "$HIVE_ORGANIZATION/$HIVE_PROJECT/$PREVIEW_TARGET" || return 1
  # --service and --url apply to Federation and stitching projects only.
  set -- --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$PREVIEW_TARGET" \
    --commit "$COMMIT" \
    --author "$AUTHOR" \
    --fail-on-composition-error
  if [ -n "$SERVICE_NAME" ]; then set -- "$@" --service "$SERVICE_NAME"; fi
  if [ -n "$SERVICE_URL" ]; then set -- "$@" --url "$SERVICE_URL"; fi
  hive schema:publish "$SCHEMA_PATH" "$@"
}

# Writes HIVE_CDN_ENDPOINT and HIVE_CDN_ACCESS_TOKEN (the names `hive artifact:fetch` reads) to the
# file given as $1, and never prints the secret.
create_preview_cdn_token() {
  response=$(hive_api "$(printf '{"query":"mutation HiveCiCreatePreviewCdnToken($input: CreateCdnAccessTokenInput!) { createCdnAccessToken(input: $input) { ok { secretAccessToken cdnUrl } error { message } } }","variables":{"input":{"target":{"bySelector":{"organizationSlug":"%s","projectSlug":"%s","targetSlug":"%s"}},"alias":"CI preview %s"}}}' \
    "$HIVE_ORGANIZATION" "$HIVE_PROJECT" "$PREVIEW_TARGET" "$PREVIEW_TARGET")")
  secret=$(echo "$response" | sed -n 's/.*"secretAccessToken":"\([^"]*\)".*/\1/p')
  cdn_url=$(echo "$response" | sed -n 's/.*"cdnUrl":"\([^"]*\)".*/\1/p')
  if [ -z "$secret" ] || [ -z "$cdn_url" ]; then
    echo "Could not create a CDN access token for $PREVIEW_TARGET: $(echo "$response" | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')" >&2
    return 1
  fi
  printf 'HIVE_CDN_ENDPOINT=%s\nHIVE_CDN_ACCESS_TOKEN=%s\n' "$cdn_url" "$secret" > "$1"
}
