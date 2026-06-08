// Stub for optional converter dependencies (shpjs, @duckdb/duckdb-wasm) that
// maplibre-gl-components lazily imports. The examples never trigger those code
// paths, so this empty module satisfies dev-server import resolution without
// pulling in the heavy optional packages.
export default {};
