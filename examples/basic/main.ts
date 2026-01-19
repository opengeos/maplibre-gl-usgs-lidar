import maplibregl from 'maplibre-gl';
import { UsgsLidarControl, UsgsLidarLayerAdapter } from '../../src/index';
import { LayerControl } from 'maplibre-gl-layer-control';
import { Legend, TerrainControl } from 'maplibre-gl-components';

import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-lidar/style.css';
import 'maplibre-gl-layer-control/style.css';

// Create map centered on Colorado (good LiDAR coverage area)
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-96, 40],
  zoom: 3.8,
  maxPitch: 85,
});

// Add navigation controls
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.FullscreenControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

// Add terrain control
map.addControl(new TerrainControl(), 'top-right');

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
      id: 'google-satellite',
      type: 'raster',
      source: 'google-satellite',
      minzoom: 15,
      paint: {
        'raster-opacity': 1,
      },
      layout: {
        visibility: 'visible', // Hidden by default
      },
    },
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
      id: '3DEP Index',
      type: 'raster',
      source: '3dep-index',
      maxzoom: 10, // Hide when zoom > 10
      paint: {
        'raster-opacity': 0.7,
      },
      layout: {
        visibility: 'visible', // Hidden by default
      },
    },
    firstSymbolId // Insert before first symbol layer (above satellite)
  );

  // Create the USGS LiDAR control (created first for adapter, added to map after layer control)
  const usgsLidarControl = new UsgsLidarControl({
    title: 'USGS 3DEP LiDAR',
    collapsed: false,
    maxResults: 2500,
    showFootprints: true,
    autoZoomToResults: true,
    lidarControlOptions: {
      pointSize: 2,
      colorScheme: 'elevation',
      copcLoadingMode: 'dynamic',
    },
  });

  // Create the USGS LiDAR layer adapter for layer control integration
  const usgsLidarAdapter = new UsgsLidarLayerAdapter(usgsLidarControl);

  // Add layer control with the USGS LiDAR adapter
  const layerControl = new LayerControl({
    collapsed: true,
    basemapStyleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    customLayerAdapters: [usgsLidarAdapter],
    excludeDrawnLayers: true,
    excludeLayers: ["*Draw*"]
  });
  map.addControl(layerControl, 'top-right');

  // Add USGS LiDAR control to the map (after layer control)
  map.addControl(usgsLidarControl, 'top-right');

  // Add a legend with zoom visibility control
  const lidarLegend = new Legend({
    title: 'LiDAR Point Cloud',
    items: [
      { label: 'QL0 (Approx. <= 0.35m NPS)', color: '#003300', shape: 'square' },
      { label: 'QL1 (Approx. 0.35m NPS)', color: '#006600', shape: 'square' },
      { label: 'QL2 (Approx. 0.7m NPS)', color: '#00cc00', shape: 'square' },
      { label: 'QL3 (Approx. 1.4m NPS)', color: '#ccff00', shape: 'square' },
      { label: 'Other', color: '#99ccff', shape: 'square' },
    ],
    collapsible: true,
    width: 220,
    position: 'bottom-left',
    maxzoom: 10, // Always visible (default max is 24)
  });
  map.addControl(lidarLegend, 'top-left');

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
