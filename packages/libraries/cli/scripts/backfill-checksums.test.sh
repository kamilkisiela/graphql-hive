#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEST_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

mkdir -p "$TEST_DIR/bin" "$TEST_DIR/objects" "$TEST_DIR/uploads"

cat > "$TEST_DIR/bin/aws" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "$1 $2" == 's3api list-objects-v2' ]]; then
  jq -Rn '[inputs | {Key: .}] | {Contents: .}' < "$MOCK_KEYS"
elif [[ "$1 $2" == 's3 cp' ]]; then
  source_key=${3#s3://*/}
  cp "$MOCK_OBJECTS/${source_key##*/}" "$4"
elif [[ "$1 $2" == 's3api put-object' ]]; then
  shift 2
  key=
  body=
  condition=
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --key)
        key=$2
        shift 2
        ;;
      --body)
        body=$2
        shift 2
        ;;
      --if-none-match)
        condition=$2
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  [[ "$condition" == '*' ]]
  ! grep -Fxq "$key" "$MOCK_KEYS"
  relative_key=${key#versions/}
  mkdir -p "$MOCK_UPLOADS/${relative_key%/*}"
  cp "$body" "$MOCK_UPLOADS/$relative_key"
  printf '%s\n' "$key" >> "$MOCK_KEYS"
  printf '%s\n' "$key" >> "$MOCK_PUT_LOG"
else
  echo "Unexpected aws invocation: $*" >&2
  exit 1
fi
EOF

cat > "$TEST_DIR/bin/curl" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

url=
output=
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      output=$2
      shift 2
      ;;
    --*)
      shift
      ;;
    *)
      url=$1
      shift
      ;;
  esac
done

version=${url#*/versions/}
version=${version%%/*}
cp "$MOCK_UPLOADS/$version/SHA256SUMS" "$output"
EOF

chmod +x "$TEST_DIR/bin/aws" "$TEST_DIR/bin/curl"

printf 'linux archive\n' > "$TEST_DIR/objects/hive-v1.0.0-linux-x64.tar.gz"
printf 'darwin archive\n' > "$TEST_DIR/objects/hive-v1.0.0-darwin-arm64.tar.gz"
printf 'legacy archive\n' > "$TEST_DIR/objects/hive-v0.8.0-abcdef-linux-x64.tar.gz"

cat > "$TEST_DIR/keys" << 'EOF'
channels/stable/hive-linux-x64.tar.gz
versions/0.8.0/abcdef/hive-v0.8.0-abcdef-linux-x64.tar.gz
versions/0.9.0/SHA256SUMS
versions/0.9.0/hive-v0.9.0-linux-x64.tar.gz
versions/1.0.0/hive-v1.0.0-darwin-arm64.tar.gz
versions/1.0.0/hive-v1.0.0-linux-x64.tar.gz
versions/legacy/commit/hive-legacy-linux-x64.tar.gz
EOF

export AWS_S3_ENDPOINT=https://example.invalid
export CLI_ARCHIVE_PUBLIC_BASE_URL=https://example.invalid
export MOCK_KEYS="$TEST_DIR/keys"
export MOCK_OBJECTS="$TEST_DIR/objects"
export MOCK_UPLOADS="$TEST_DIR/uploads"
export MOCK_PUT_LOG="$TEST_DIR/put.log"
export PATH="$TEST_DIR/bin:$PATH"

dry_run_output=$("$SCRIPT_DIR/backfill-checksums.sh" --dry-run)
grep -Fq '  - 0.8.0' <<< "$dry_run_output"
grep -Fq '  - 1.0.0' <<< "$dry_run_output"
grep -Fq 'Dry run complete; no objects were written.' <<< "$dry_run_output"
[[ ! -e "$MOCK_PUT_LOG" ]]

"$SCRIPT_DIR/backfill-checksums.sh"

cat > "$TEST_DIR/expected-put-log" << 'EOF'
versions/0.8.0/SHA256SUMS
versions/1.0.0/SHA256SUMS
EOF
cmp "$TEST_DIR/expected-put-log" "$MOCK_PUT_LOG"
[[ $(grep -Fc 'versions/0.9.0/SHA256SUMS' "$MOCK_KEYS") -eq 1 ]]

(
  cd "$TEST_DIR/objects"
  sha256sum hive-v0.8.0-abcdef-linux-x64.tar.gz \
    | sed 's#  #  abcdef/#' > "$TEST_DIR/expected-legacy"
)
cmp "$TEST_DIR/expected-legacy" "$TEST_DIR/uploads/0.8.0/SHA256SUMS"

(
  cd "$TEST_DIR/objects"
  sha256sum hive-v1.0.0-*.tar.gz | LC_ALL=C sort -k2 > "$TEST_DIR/expected"
)
cmp "$TEST_DIR/expected" "$TEST_DIR/uploads/1.0.0/SHA256SUMS"

sed -i.bak '/versions\/0.8.0\/SHA256SUMS/d' "$MOCK_KEYS"
sed -i.bak '/versions\/1.0.0\/SHA256SUMS/d' "$MOCK_KEYS"
rm -f "$MOCK_PUT_LOG" "$MOCK_OBJECTS/hive-v0.8.0-abcdef-linux-x64.tar.gz"

if "$SCRIPT_DIR/backfill-checksums.sh" > "$TEST_DIR/failure.log" 2>&1; then
  echo 'Expected a missing archive download to fail the backfill.' >&2
  exit 1
fi
[[ ! -e "$MOCK_PUT_LOG" ]]

echo 'CLI checksum backfill tests passed.'
