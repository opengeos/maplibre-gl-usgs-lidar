import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl, { Map } from 'maplibre-gl';
import { UsgsLidarControlReact, useUsgsLidarState } from '../../src/react';
import { LayerControl } from 'maplibre-gl-layer-control';
import type { StacItem } from '../../src/index';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-lidar/style.css';
import 'maplibre-gl-layer-control/style.css';

/**
 * Main App component demonstrating the React integration
 */
function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const { state, toggle } = useUsgsLidarState({ collapsed: false });
  const [searchResults, setSearchResults] = useState<StacItem[]>([]);

  // Initialize the map
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-104.9847, 39.7392],
      zoom: 14,
      maxPitch: 85,
    });

    // Add navigation controls
    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstance.addControl(new maplibregl.FullscreenControl(), 'top-right');
    mapInstance.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    mapInstance.on('load', () => {
      // Find the first symbol layer to insert layers below labels
      const layers = mapInstance.getStyle().layers;
      let firstSymbolId: string | undefined;
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }

      // Add Google Satellite basemap
      mapInstance.addSource('google-satellite', {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
        tileSize: 256,
        attribution: '&copy; Google',
      });

      mapInstance.addLayer(
        {
          id: 'google-satellite-layer',
          type: 'raster',
          source: 'google-satellite',
          paint: {
            'raster-opacity': 1,
          },
          layout: {
            visibility: 'none', // Hidden by default
          },
        },
        firstSymbolId // Insert before first symbol layer
      );

      // Add 3DEP Elevation Index WMS layer (Lidar Point Cloud coverage)
      mapInstance.addSource('3dep-index', {
        type: 'raster',
        tiles: [
          'https://index.nationalmap.gov/arcgis/services/3DEPElevationIndex/MapServer/WMSServer?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=23&SRS=EPSG:3857&STYLES=&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
        ],
        tileSize: 256,
        attribution: 'USGS 3DEP',
      });

      mapInstance.addLayer(
        {
          id: '3dep-index-layer',
          type: 'raster',
          source: '3dep-index',
          maxzoom: 10, // Hide when zoom > 10
          paint: {
            'raster-opacity': 0.7,
          },
          layout: {
            visibility: 'none', // Hidden by default
          },
        },
        firstSymbolId // Insert before first symbol layer (above satellite)
      );

      // Add layer control for basemap layers
      const layerControl = new LayerControl({
        collapsed: true,
        layers: ['google-satellite-layer', '3dep-index-layer'],
        layerStates: {
          'google-satellite-layer': {
            visible: false,
            opacity: 1,
            name: 'Google Satellite',
          },
          '3dep-index-layer': {
            visible: false,
            opacity: 0.7,
            name: '3DEP LiDAR Index',
          },
        },
      });
      mapInstance.addControl(layerControl, 'top-right');

      setMap(mapInstance);
    });

    return () => {
      mapInstance.remove();
    };
  }, []);

  const handleSearchComplete = (items: StacItem[]) => {
    setSearchResults(items);
    console.log(`Found ${items.length} LiDAR datasets`);
  };

  const handleError = (error: Error) => {
    console.error('Error:', error.message);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* External toggle button */}
      <button
        onClick={toggle}
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1,
          padding: '8px 16px',
          background: '#4a90d9',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 500,
          fontSize: 13,
        }}
      >
        {state.collapsed ? 'Expand' : 'Collapse'} Panel
      </button>

      {/* Results count */}
      {searchResults.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 140,
            zIndex: 1,
            padding: '8px 12px',
            background: 'white',
            borderRadius: 6,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            fontSize: 13,
          }}
        >
          Found: {searchResults.length} datasets
        </div>
      )}

      {/* Info panel */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          background: 'white',
          padding: '12px 16px',
          borderRadius: 8,
          boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
          fontSize: 13,
          maxWidth: 300,
          zIndex: 1,
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: 14 }}>USGS 3DEP LiDAR Viewer (React)</h3>
        <p style={{ margin: 0, color: '#666', lineHeight: 1.4 }}>
          Click the LiDAR control button to search for and visualize USGS 3DEP LiDAR data.
        </p>
      </div>

      {/* USGS LiDAR control */}
      {map && (
        <UsgsLidarControlReact
          map={map}
          title="USGS 3DEP LiDAR"
          collapsed={state.collapsed}
          maxResults={50}
          showFootprints={true}
          autoZoomToResults={true}
          onSearchComplete={handleSearchComplete}
          onError={handleError}
          lidarControlOptions={{
            pointSize: 2,
            colorScheme: 'elevation',
            copcLoadingMode: 'dynamic',
          }}
        />
      )}
    </div>
  );
}

// Mount the app
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
