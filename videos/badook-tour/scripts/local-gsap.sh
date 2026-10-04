#!/usr/bin/env bash
# After assemble-index / captions build: load GSAP from the project's own copy (the CDN is unreachable
# from the render container). Idempotent.
cd "$(dirname "$0")/.." || exit 1
for f in index.html compositions/captions.html; do
  [ -f "$f" ] && sed -i -E 's#<script src="https://cdn\.jsdelivr\.net/npm/gsap@[^"]*"[^>]*></script>#<script src="assets/vendor/gsap.min.js"></script>#' "$f"
done
grep -l "cdn.jsdelivr" index.html compositions/*.html compositions/frames/*.html 2>/dev/null && echo "WARN: CDN refs remain" || echo "gsap: local"
