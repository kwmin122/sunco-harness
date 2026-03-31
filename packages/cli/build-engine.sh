#!/usr/bin/env bash
# build-engine.sh
# After `tsup` produces dist/, this script is no longer needed —
# the installer reads from dist/ directly (bundled as-is in the npm package).
#
# The `files` array in package.json includes "dist/" so npm publish
# will bundle the built artifacts. The installer copies from:
#   path.join(__dirname, '..', 'dist')  →  {target}/sunco/bin/
#
# Usage (manual):
#   npm run build && bash packages/cli/build-engine.sh
#
# This script is a no-op placeholder kept for documentation purposes.
echo "Engine is served from dist/ — no separate copy needed."
echo "Run 'npm run build' in packages/cli to regenerate dist/."
