export default {
  '*.{ts,tsx,js,json,css}': 'biome check --write --no-errors-on-unmatched',
  '*.go': 'gofmt -w',
  'frontend/src/**/*.{ts,tsx}': 'bun run check:ui',
  '{scripts/check-ui.ts,scripts/ui-baseline.json}': 'bun run check:ui',
};
