// MapLibre 6 uses named exports. Older plugins still expect a default namespace.
import * as maplibregl from 'maplibre-gl/dist/maplibre-gl.mjs';

export * from 'maplibre-gl/dist/maplibre-gl.mjs';
export default maplibregl;
