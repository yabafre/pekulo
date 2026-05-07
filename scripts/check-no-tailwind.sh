#!/usr/bin/env bash
# scripts/check-no-tailwind.sh
# AC-1 audit — verify apps/web is @pekulo/ui-only (no Tailwind / shadcn /
# @base-ui leftovers).
#
# Exit codes:
#   0 = clean (apps/web is @pekulo/ui-only)
#   1 = leftover detected — story 0-10 AC-1 violated

set -euo pipefail

fail=0

# 1. apps/web/package.json must not declare any forbidden dep.
forbidden_deps=(
  "@base-ui/react"
  "shadcn"
  "tailwindcss"
  "@tailwindcss/postcss"
  "class-variance-authority"
  "clsx"
  "tailwind-merge"
  "tailwindcss-animate"
  "tw-animate-css"
)
for dep in "${forbidden_deps[@]}"; do
  if grep -q "\"$dep\"" apps/web/package.json; then
    echo "FAIL: $dep present in apps/web/package.json"
    fail=1
  fi
done

# 2. Forbidden files must be absent.
forbidden_files_strict=(
  "apps/web/src/app/globals.css"
  "apps/web/postcss.config.mjs"
  "apps/web/components.json"
  "apps/web/src/components/theme-provider.tsx"
  "apps/web/src/components/theme-toggle.tsx"
  "apps/web/src/components/nav.tsx"
  "apps/web/src/components/kpi-card.tsx"
  "apps/web/src/components/phases.tsx"
  "apps/web/src/components/detail-cards.tsx"
  "apps/web/src/components/annual-table.tsx"
  "apps/web/tamagui.config.ts"
  "apps/web/tamagui.build.ts"
  "apps/web/public/tamagui.generated.css"
)
for f in "${forbidden_files_strict[@]}"; do
  if [ -e "$f" ]; then
    echo "FAIL: $f still exists"
    fail=1
  fi
done

# 3. Forbidden directories must be absent.
forbidden_dirs=(
  "apps/web/src/components/ui"
  "apps/web/src/components/charts"
  "apps/web/src/app/(spike)"
  "apps/web/src/app/dashboard/mensuel"
  "apps/web/src/app/dashboard/parametres"
  "apps/web/src/app/dashboard/portefeuille"
  "apps/web/src/app/dashboard/transactions"
)
for d in "${forbidden_dirs[@]}"; do
  if [ -d "$d" ]; then
    echo "FAIL: $d still exists"
    fail=1
  fi
done

# 4. No `className=` anywhere in apps/web/src.
if grep -rE "className=" apps/web/src 2>/dev/null; then
  echo "FAIL: className= usage found in apps/web/src"
  fail=1
fi

# 5. AC-1(f) — only layout.tsx + providers.tsx may import styling-bootstrap
#    symbols (CSS resets / generated atomic CSS / the root provider). Other
#    files may still consume Pekulo* components and hooks; this guard pins
#    the styling boundary, not the component-consumer surface.
allowed_styling_importers=(
  "apps/web/src/app/layout.tsx"
  "apps/web/src/components/providers.tsx"
)
styling_imports=$(grep -rlE "@pekulo/ui/(reset|generated)\.css|from \"@pekulo/ui\"" apps/web/src 2>/dev/null | grep -E "@tamagui/core/reset\.css|@pekulo/ui/(reset|generated)\.css|PekuloRootProvider" -l 2>/dev/null || true)
# Simpler form: list every file importing the CSS bootstraps OR the provider barrel.
styling_importers=$(grep -rlE "(@pekulo/ui/reset\.css|@pekulo/ui/generated\.css|@tamagui/core/reset\.css|PekuloRootProvider)" apps/web/src 2>/dev/null | sort -u)
for f in $styling_importers; do
  ok=0
  for allowed in "${allowed_styling_importers[@]}"; do
    if [ "$f" = "$allowed" ]; then ok=1; break; fi
  done
  if [ "$ok" -eq 0 ]; then
    echo "FAIL: AC-1(f) — $f imports styling bootstrap (CSS reset / generated CSS / PekuloRootProvider) but is not one of: ${allowed_styling_importers[*]}"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "apps/web is @pekulo/ui-only ✓"
  exit 0
fi
exit 1
