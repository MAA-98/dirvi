#!/usr/bin/env zsh

set -eu
setopt pipefail

usage() {
  cat <<'EOF'
Usage: formatted-context-files [CONTEXT_FILE]

Read the last JSON event from CONTEXT_FILE, extract its
"displayed-leaves-paths" paths, convert them to absolute paths relative
to the current working directory, and output each file as a Markdown
fenced code block.

Arguments:
  CONTEXT_FILE  JSON-lines file containing displayed-leaves-paths events.
                Defaults to ./context.json.
EOF
}

if (( $# > 1 )); then
  usage >&2
  exit 1
fi

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

SCRIPT_DIR="${0:A:h}"
FORMATTER="$SCRIPT_DIR/formatted-file.zsh"
CONTEXT_FILE="${1:-$PWD/context.json}"
CWD="${PWD:A}"
PATHS_FILE="${TMPDIR:-/tmp}/formatted-context-files.$$"

cleanup() {
  rm -f -- "$PATHS_FILE"
}

trap cleanup EXIT INT TERM

if [[ ! -f "$FORMATTER" ]]; then
  echo "Error: formatter script not found: $FORMATTER" >&2
  exit 1
fi

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "Error: context file not found: $CONTEXT_FILE" >&2
  exit 1
fi

# Select the last non-empty line from the JSON-lines context file.
LAST_EVENT="$(
  awk '
    /^[[:space:]]*$/ { next }
    { last = $0 }
    END {
      if (last == "") {
        exit 1
      }

      print last
    }
  ' "$CONTEXT_FILE"
)" || {
  echo "Error: context file is empty: $CONTEXT_FILE" >&2
  exit 1
}

# Validate the event and write one absolute path per line.
printf '%s\n' "$LAST_EVENT" |
  jq -e -r --arg cwd "$CWD" '
    if type != "object" then
      error("last line is not a JSON object")
    elif .type != "displayed-leaves-paths" then
      error("last event is not a displayed-leaves-paths event")
    elif (.paths | type) != "array" then
      error(".paths is not an array")
    elif any(
      .paths[];
      (type != "array") or any(.[]; type != "string")
    ) then
      error(".paths must be an array of arrays of strings")
    else
      .paths[]
      | ($cwd + "/" + join("/"))
    end
  ' > "$PATHS_FILE"

# Format each absolute path.
while IFS= read -r ABSOLUTE_PATH; do
  if [[ ! -f "$ABSOLUTE_PATH" ]]; then
    echo "Error: not a regular file: $ABSOLUTE_PATH" >&2
    exit 1
  fi

  zsh "$FORMATTER" -- "$ABSOLUTE_PATH"
  printf '\n'
done < "$PATHS_FILE"