#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=false

if [[ "${1:-}" == '--dry-run' ]]; then
  DRY_RUN=true
elif [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 2
fi

for command in aws cmp curl jq sha256sum; do
  if ! command -v "$command" > /dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

: "${AWS_S3_ENDPOINT:?AWS_S3_ENDPOINT must be set}"

BUCKET="${CLI_ARCHIVE_BUCKET:-graphql-hive-cli}"
PUBLIC_BASE_URL="${CLI_ARCHIVE_PUBLIC_BASE_URL:-https://cli.graphql-hive.com}"
CACHE_BUSTER="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
WORK_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

list_keys() {
  local output=$1

  aws s3api list-objects-v2 \
    --bucket "$BUCKET" \
    --prefix versions/ \
    --endpoint-url "$AWS_S3_ENDPOINT" \
    --output json \
    | jq -r '.Contents[]?.Key' \
    | LC_ALL=C sort -u > "$output"
}

inventory() {
  local keys=$1
  local archives=$2
  local manifests=$3

  : > "$archives"
  : > "$manifests"

  while IFS= read -r key; do
    if [[ "$key" =~ ^versions/([^/]+)/(.+\.tar\.gz)$ ]]; then
      local version=${BASH_REMATCH[1]}
      local relative_path=${BASH_REMATCH[2]}

      if
        [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]] \
          && [[ ! "$relative_path" =~ (^|/)\.{1,2}(/|$) ]]
      then
        printf '%s\t%s\t%s\n' "$version" "$key" "$relative_path" >> "$archives"
      fi
    elif [[ "$key" =~ ^versions/([^/]+)/SHA256SUMS$ ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}" >> "$manifests"
    fi
  done < "$keys"

  LC_ALL=C sort -u -o "$archives" "$archives"
  LC_ALL=C sort -u -o "$manifests" "$manifests"
}

list_keys "$WORK_DIR/keys"
inventory "$WORK_DIR/keys" "$WORK_DIR/archives" "$WORK_DIR/manifests"
cut -f1 "$WORK_DIR/archives" | LC_ALL=C sort -u > "$WORK_DIR/versions"
comm -23 "$WORK_DIR/versions" "$WORK_DIR/manifests" > "$WORK_DIR/missing"

if [[ ! -s "$WORK_DIR/versions" ]]; then
  echo 'No versioned standalone CLI archives were found.' >&2
  exit 1
fi

if [[ ! -s "$WORK_DIR/missing" ]]; then
  echo 'Every retained standalone CLI version already has a SHA256SUMS manifest.'
  exit 0
fi

echo 'Standalone CLI versions missing SHA256SUMS:'
sed 's/^/  - /' "$WORK_DIR/missing"

if [[ "$DRY_RUN" == true ]]; then
  echo 'Dry run complete; no objects were written.'
  exit 0
fi

while IFS= read -r version; do
  version_dir="$WORK_DIR/$version"
  mkdir "$version_dir"

  while IFS=$'\t' read -r _ key relative_path; do
    mkdir -p "$(dirname "$version_dir/$relative_path")"
    aws s3 cp \
      "s3://$BUCKET/$key" \
      "$version_dir/$relative_path" \
      --endpoint-url "$AWS_S3_ENDPOINT" \
      --only-show-errors
  done < <(awk -F '\t' -v version="$version" '$1 == version' "$WORK_DIR/archives")

  while IFS=$'\t' read -r _ _ relative_path; do
    (cd "$version_dir" && sha256sum "$relative_path")
  done < <(awk -F '\t' -v version="$version" '$1 == version' "$WORK_DIR/archives") \
    | LC_ALL=C sort -k2 > "$version_dir/SHA256SUMS"

  manifest_key="versions/$version/SHA256SUMS"
  aws s3api put-object \
    --bucket "$BUCKET" \
    --key "$manifest_key" \
    --body "$version_dir/SHA256SUMS" \
    --content-type text/plain \
    --if-none-match '*' \
    --endpoint-url "$AWS_S3_ENDPOINT" > /dev/null

  curl --fail --location --retry 5 --retry-all-errors \
    "$PUBLIC_BASE_URL/$manifest_key?backfill=$CACHE_BUSTER-$version" \
    --output "$version_dir/PUBLISHED_SHA256SUMS"
  cmp "$version_dir/SHA256SUMS" "$version_dir/PUBLISHED_SHA256SUMS"

  echo "Published and verified $manifest_key"
done < "$WORK_DIR/missing"

list_keys "$WORK_DIR/final-keys"
inventory "$WORK_DIR/final-keys" "$WORK_DIR/final-archives" "$WORK_DIR/final-manifests"
cut -f1 "$WORK_DIR/final-archives" | LC_ALL=C sort -u > "$WORK_DIR/final-versions"
comm -23 "$WORK_DIR/final-versions" "$WORK_DIR/final-manifests" > "$WORK_DIR/still-missing"

if [[ -s "$WORK_DIR/still-missing" ]]; then
  echo 'Checksum backfill is incomplete. These versions still lack SHA256SUMS:' >&2
  sed 's/^/  - /' "$WORK_DIR/still-missing" >&2
  exit 1
fi

echo 'Every retained standalone CLI version has a SHA256SUMS manifest.'
