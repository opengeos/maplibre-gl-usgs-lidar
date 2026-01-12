import maplibregl from 'maplibre-gl';
import { UsgsLidarControl } from '../../src/index';
import { LayerControl } from 'maplibre-gl-layer-control';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-lidar/style.css';
import 'maplibre-gl-layer-control/style.css';

// Create map centered on Colorado (good LiDAR coverage area)
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-104.9847, 39.7392],
  zoom: 14,
  maxPitch: 85,
});

// Add navigation controls
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.FullscreenControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

// Add USGS LiDAR control when map loads
map.on('load', () => {
  // Find the first symbol layer to insert layers below labels
  const layers = map.getStyle().layers;
  let firstSymbolId: string | undefined;
  for (const layer of layers) {
    if (layer.type === 'symbol') {
      firstSymbolId = layer.id;
      break;
    }
  }

  // Add Google Satellite basemap
  map.addSource('google-satellite', {
    type: 'raster',
    tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
    tileSize: 256,
    attribution: '&copy; Google',
  });

  map.addLayer(
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
  map.addSource('3dep-index', {
    type: 'raster',
    tiles: [
      'https://index.nationalmap.gov/arcgis/services/3DEPElevationIndex/MapServer/WMSServer?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=23&SRS=EPSG:3857&STYLES=&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    ],
    tileSize: 256,
    attribution: 'USGS 3DEP',
  });

  map.addLayer(
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
  map.addControl(layerControl, 'top-right');

  // Create the USGS LiDAR control
  const usgsLidarControl = new UsgsLidarControl({
    title: 'USGS 3DEP LiDAR',
    collapsed: false,
    maxResults: 50,
    showFootprints: true,
    autoZoomToResults: true,
    lidarControlOptions: {
      pointSize: 2,
      colorScheme: 'elevation',
      copcLoadingMode: 'dynamic',
    },
  });

  // Add control to the map
  map.addControl(usgsLidarControl, 'top-right');



  // Listen for events
  usgsLidarControl.on('searchstart', () => {
    console.log('Search started...');
  });

  usgsLidarControl.on('searchcomplete', (event) => {
    console.log(`Found ${event.items?.length ?? 0} LiDAR datasets`);
  });

  usgsLidarControl.on('searcherror', (event) => {
    console.error('Search failed:', event.error);
  });

  usgsLidarControl.on('loadstart', () => {
    console.log('Loading LiDAR data...');
  });

  usgsLidarControl.on('loadcomplete', (event) => {
    console.log('LiDAR data loaded:', event.pointCloud);
  });

  usgsLidarControl.on('loaderror', (event) => {
    console.error('Load failed:', event.error);
  });

  console.log('USGS LiDAR control added to map');
});
