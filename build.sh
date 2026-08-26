#!/usr/bin/env bash
# Builds one store package per browser from the single source manifest.
#
# Chrome and Firefox disagree about MV3 background scripts: Chrome only runs a
# service worker, Firefox only runs an event page and has no service worker
# support (bugzil.la/1573659). Declaring both keys works in both browsers, but
# each one warns about the key it ignores, so each package ships only its own.
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')
OUT=dist

# Everything the extension actually needs at runtime. Listed file by file so
# that store assets and other loose files can never be swept into a package.
FILES=(
  index.html
  main.js
  service-worker.js
  style.css
  images/icon-16.png
  images/icon-32.png
  images/icon-48.png
  images/icon-128.png
  LICENSE
)

rm -rf "$OUT"
mkdir -p "$OUT"

package() {
  local target=$1 drop=$2
  local stage="$OUT/$target"

  mkdir -p "$stage/images"
  for f in "${FILES[@]}"; do
    cp "$f" "$stage/$f"
  done

  python3 - "$stage/manifest.json" "$drop" <<'PYEOF'
import json, sys
path, drop = sys.argv[1], sys.argv[2]
manifest = json.load(open("manifest.json"))
manifest["background"].pop(drop, None)
if not manifest["background"]:
    raise SystemExit(f"background would be empty after dropping {drop}")
json.dump(manifest, open(path, "w"), indent=2)
open(path, "a").write("\n")
PYEOF

  (cd "$stage" && zip -r -q "../tabsheet-$target-$VERSION.zip" .)
  rm -rf "$stage"
  echo "  $OUT/tabsheet-$target-$VERSION.zip"
}

echo "TabSheet $VERSION"
package chrome scripts
package firefox service_worker
