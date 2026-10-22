#!/usr/bin/env zsh

dir=${1:-.}
total=0

while IFS= read -r -d '' file; do
  (( total += $(wc -l < "$file") ))
done < <(
  find "$dir" \
    -type d \( -name dist -o -name node_modules \) -prune -o \
    -type f \( -name '*.ts' -o -name '*.tsx' \) -print0
)

print "$total"