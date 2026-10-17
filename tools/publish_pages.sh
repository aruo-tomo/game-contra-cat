#!/bin/sh
# Publish the game/ folder to the gh-pages branch (served by GitHub Pages).
# Usage: sh tools/publish_pages.sh   (run from the repo root, with your changes committed)
set -e
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
TMP=$(mktemp -d)
git subtree split --prefix=game -b gh-pages-build >/dev/null
git worktree add -q "$TMP" gh-pages-build
cd "$TMP"
# claude.ai adds the document head itself; a plain web host needs it in the file
python3 - <<'PY'
s = open('index.html').read()
if not s.startswith('<!doctype'):
    s = s.replace('<meta charset="utf-8">', '<!doctype html>\n<html lang="zh-HK">\n<meta charset="utf-8">\n'
                  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                  '<style>:root{color-scheme:dark}body{margin:0}</style>', 1)
    open('index.html', 'w').write(s)
PY
touch .nojekyll
git add -A
git commit -q -m "Publish game for GitHub Pages"
git push -f origin gh-pages-build:gh-pages
cd "$ROOT"
git worktree remove --force "$TMP"
git branch -D gh-pages-build >/dev/null
echo "Published: https://aruo-tomo.github.io/game-contra-cat/"
