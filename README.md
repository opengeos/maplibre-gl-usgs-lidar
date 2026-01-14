# maplibre-gl-usgs-lidar

A MapLibre GL JS plugin for searching and visualizing USGS 3DEP LiDAR data from Microsoft Planetary Computer (COPC) and AWS Open Data (EPT).

[![npm version](https://img.shields.io/npm/v/maplibre-gl-usgs-lidar.svg)](https://www.npmjs.com/package/maplibre-gl-usgs-lidar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Search USGS 3DEP LiDAR data by map extent or custom bounding box
- Supports two data sources: COPC (Planetary Computer) and EPT (AWS Open Data)
- View search results with item footprints on the map
- Load and visualize COPC and EPT point cloud data
- Dynamic streaming for efficient handling of large datasets
- Customizable color schemes (elevation, intensity, classification, RGB)
- React components and hooks for easy integration
- TypeScript support with full type definitions

## Installation

```bash
npm install maplibre-gl-usgs-lidar maplibre-gl maplibre-gl-lidar
```

## Quick Start

### Vanilla JavaScript/TypeScript

```typescript
import maplibregl from 'maplibre-gl';
import { UsgsLidarControl } from 'maplibre-gl-usgs-lidar';

// Import styles
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-lidar/style.css';
import 'maplibre-gl-usgs-lidar/style.css';

// Create map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-105.27, 40.01],
  zoom: 10,
});

map.on('load', () => {
  // Add USGS LiDAR control
  const control = new UsgsLidarControl({
    title: 'USGS 3DEP LiDAR',
    collapsed: false,
    maxResults: 50,
  });

  map.addControl(control, 'top-right');

  // Listen for events
  control.on('searchcomplete', (event) => {
    console.log(`Found ${event.items?.length} datasets`);
  });

  control.on('loadcomplete', (event) => {
    console.log('Loaded:', event.pointCloud);
  });
});
```

### React

```tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { UsgsLidarControlReact, useUsgsLidarState } from 'maplibre-gl-usgs-lidar/react';

// Import styles
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl-lidar/style.css';
import 'maplibre-gl-usgs-lidar/style.css';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState(null);
  const { state, toggle } = useUsgsLidarState({ collapsed: false });

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-105.27, 40.01],
      zoom: 10,
    });

    mapInstance.on('load', () => {
      setMap(mapInstance);
    });

    return () => mapInstance.remove();
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {map && (
        <UsgsLidarControlReact
          map={map}
          title="USGS LiDAR"
          collapsed={state.collapsed}
          onSearchComplete={(items) => console.log('Found:', items.length)}
        />
      )}
    </div>
  );
}
```

## API

### UsgsLidarControl

Main control class implementing MapLibre's `IControl` interface.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `collapsed` | `boolean` | `true` | Start with panel collapsed |
| `position` | `string` | `'top-right'` | Control position |
| `title` | `string` | `'USGS 3DEP LiDAR'` | Panel title |
| `panelWidth` | `number` | `380` | Panel width in pixels |
| `panelMaxHeight` | `number` | `600` | Panel max height in pixels |
| `maxResults` | `number` | `50` | Maximum search results |
| `showFootprints` | `boolean` | `true` | Show item footprints on map |
| `autoZoomToResults` | `boolean` | `true` | Auto-zoom to results |
| `lidarControlOptions` | `object` | `{}` | Options for internal LidarControl |

#### Methods

| Method | Description |
|--------|-------------|
| `searchByExtent()` | Search by current map extent |
| `searchByBbox(bbox)` | Search by bounding box |
| `startDrawing()` | Start drawing mode |
| `stopDrawing()` | Stop drawing mode |
| `selectItem(item)` | Select an item |
| `deselectItem(item)` | Deselect an item |
| `loadItem(item)` | Load item's COPC data |
| `loadSelectedItems()` | Load all selected items |
| `unloadItem(itemId)` | Unload an item |
| `clearResults()` | Clear search results |
| `clearLoadedItems()` | Clear loaded items |
| `toggle()` | Toggle panel open/closed |
| `expand()` | Expand panel |
| `collapse()` | Collapse panel |

#### Events

| Event | Description |
|-------|-------------|
| `collapse` | Panel collapsed |
| `expand` | Panel expanded |
| `statechange` | State changed |
| `searchstart` | Search started |
| `searchcomplete` | Search completed |
| `searcherror` | Search error |
| `loadstart` | Loading started |
| `loadcomplete` | Loading completed |
| `loaderror` | Loading error |
| `drawstart` | Drawing started |
| `drawend` | Drawing ended |

### StacSearcher

STAC API client for searching Planetary Computer.

```typescript
import { StacSearcher } from 'maplibre-gl-usgs-lidar';

const searcher = new StacSearcher();
const results = await searcher.search({
  bbox: [-123, 44, -122, 45],
  limit: 25,
});
```

## Docker

The examples can be run using Docker. The image is automatically built and published to GitHub Container Registry.

### Pull and Run

```bash
# Pull the latest image
docker pull ghcr.io/opengeos/maplibre-gl-usgs-lidar:latest

# Run the container
docker run -p 8080:80 ghcr.io/opengeos/maplibre-gl-usgs-lidar:latest
```

Then open http://localhost:8080/maplibre-gl-usgs-lidar/ in your browser to view the examples.

### Build Locally

```bash
# Build the image
docker build -t maplibre-gl-usgs-lidar .

# Run the container
docker run -p 8080:80 maplibre-gl-usgs-lidar
```

### Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest release |
| `x.y.z` | Specific version (e.g., `1.0.0`) |
| `x.y` | Minor version (e.g., `1.0`) |

## Data Sources

This plugin supports two data sources for USGS 3DEP LiDAR data:

- **COPC (Cloud Optimized Point Cloud)**: [USGS 3DEP LiDAR COPC](https://planetarycomputer.microsoft.com/dataset/3dep-lidar-copc) from [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/)
- **EPT (Entwine Point Tiles)**: [USGS LiDAR](https://registry.opendata.aws/usgs-lidar/) from [AWS Open Data](https://aws.amazon.com/opendata/) via [hobuinc/usgs-lidar](https://github.com/hobuinc/usgs-lidar)

## Dependencies

- [maplibre-gl](https://maplibre.org/) - Map rendering
- [maplibre-gl-lidar](https://github.com/opengeos/maplibre-gl-lidar) - LiDAR visualization

## License

MIT
