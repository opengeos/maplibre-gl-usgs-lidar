import maplibregl from 'maplibre-gl';
import { UsgsLidarControl } from '../../src/index';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-lidar/style.css';

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
