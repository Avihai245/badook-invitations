#!/usr/bin/env bash
# Re-assemble safely: assemble-index hoists approved frame videos OUT of the frame files (in place), so a
# second run would lose them. Worker output is kept pristine in .hyperframes/frame-src/ and copied back first.
set -e
cd "$(dirname "$0")/.."
mkdir -p .hyperframes/frame-src
for f in compositions/frames/*.html; do
  b=$(basename "$f")
  # a newer worker (re)write wins; a file the assembler already hoisted never does
  if ! grep -q "approved frame video hoisted by assemble-index" "$f" && [ "$f" -nt ".hyperframes/frame-src/$b" ]; then cp "$f" ".hyperframes/frame-src/$b"; fi
done
cp .hyperframes/frame-src/*.html compositions/frames/
node ../../.agents/skills/product-launch-video/scripts/assemble-index.mjs --storyboard ./STORYBOARD.md --hyperframes . | sed -n 1,9p
scripts/local-gsap.sh
