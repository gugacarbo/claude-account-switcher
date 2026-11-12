export default {
  '*.{ts,tsx,js,json,css}': 'biome check --write --no-errors-on-unmatched',
  '*.go': 'gofmt -w',
};
