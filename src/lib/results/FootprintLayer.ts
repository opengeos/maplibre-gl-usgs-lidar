import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { UnifiedSearchItem } from '../core/types';
import type { Feature, FeatureCollection } from 'geojson';

/**
 * Options for configuring the FootprintLayer
 */
export interface FootprintLayerOptions {
  /** Fill color for unselected footprints */
  fillColor?: string;
  /** Fill color for selected footprints */
  selectedFillColor?: string;
  /** Outline color */
  outlineColor?: string;
  /** Outline width in pixels */
  outlineWidth?: number;
}

const DEFAULT_OPTIONS: Required<FootprintLayerOptions> = {
  fillColor: 'rgba(0, 100, 200, 0.15)',
  selectedFillColor: 'rgba(0, 150, 255, 0.4)',
  outlineColor: 'rgba(0, 100, 200, 1)',
  outlineWidth: 2,
};

/**
 * Manages display of LiDAR item footprints on the map.
 * Shows item boundaries with selection highlighting.
 *
 * @example
 * ```typescript
 * const footprintLayer = new FootprintLayer(map);
 * footprintLayer.setItems(searchResults);
 * footprintLayer.setSelectedIds(new Set(['item-1', 'item-2']));
 * footprintLayer.zoomToFootprints();
 * ```
 */
export class FootprintLayer {
  private _map: MapLibreMap;
  private _options: Required<FootprintLayerOptions>;
  private _sourceId = 'usgs-lidar-footprints-source';
  private _fillLayerId = 'usgs-lidar-footprints-fill';
  private _outlineLayerId = 'usgs-lidar-footprints-outline';
  private _selectedLayerId = 'usgs-lidar-footprints-selected';
  private _items: UnifiedSearchItem[] = [];
  private _selectedIds: Set<string> = new Set();
  private _clickHandler?: (itemId: string) => void;
  private _layersInitialized: boolean = false;

  /**
   * Creates a new FootprintLayer instance.
   *
   * @param map - MapLibre GL map instance
   * @param options - Configuration options
   */
  constructor(map: MapLibreMap, options?: FootprintLayerOptions) {
    this._map = map;
    this._options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize layers when map style is ready
    // Try multiple approaches to handle timing issues
    const tryInit = () => {
      if (!this._layersInitialized) {
        this._initLayers();
        this._setupInteraction();
        // If items were set before init, update now
        if (this._items.length > 0) {
          this._updateLayer();
        }
      }
    };

    if (this._map.isStyleLoaded()) {
      tryInit();
    } else {
      this._map.once('style.load', tryInit);
    }

    // Fallback: also try on 'load' event if not yet initialized
    this._map.once('load', () => {
      if (!this._layersInitialized) {
        tryInit();
      }
    });

    // Handle style changes (e.g., when basemap is switched)
    // Re-initialize layers after style change to ensure they exist
    this._map.on('style.load', () => {
      // Reset flag since layers were removed during style change
      this._layersInitialized = false;
      this._initLayers();
      this._setupInteraction();
      // Re-render any existing items
      if (this._items.length > 0) {
        this._updateLayer();
      }
    });
  }

  /**
   * Sets the items to display as footprints.
   *
   * @param items - Unified search items to display
   */
  setItems(items: UnifiedSearchItem[]): void {
    this._items = items;

    // Check if style is loaded
    if (!this._map.isStyleLoaded()) {
      // Style not loaded yet, items will be rendered when style loads
      return;
    }

    // If layers not initialized yet, or source was removed (e.g., style change), re-initialize
    if (!this._layersInitialized || !this._map.getSource(this._sourceId)) {
      this._layersInitialized = false;
      this._initLayers();
      this._setupInteraction();
    }

    this._updateLayer();
  }

  /**
   * Gets the currently displayed items.
   */
  getItems(): UnifiedSearchItem[] {
    return [...this._items];
  }

  /**
   * Sets which items are selected (highlighted).
   *
   * @param ids - Set of selected item IDs
   */
  setSelectedIds(ids: Set<string>): void {
    this._selectedIds = ids;
    this._updateSelectedFilter();
  }

  /**
   * Gets the currently selected item IDs.
   */
  getSelectedIds(): Set<string> {
    return new Set(this._selectedIds);
  }

  /**
   * Registers a click handler for footprint clicks.
   *
   * @param handler - Function called with item ID when a footprint is clicked
   */
  onClick(handler: (itemId: string) => void): void {
    this._clickHandler = handler;
  }

  /**
   * Clears all footprints from the map.
   */
  clear(): void {
    this._items = [];
    this._selectedIds.clear();
    this._clearLayer();
  }

  /**
   * Zooms the map to fit all footprints.
   *
   * @param padding - Padding in pixels (default: 50)
   * @param duration - Animation duration in ms (default: 1000)
   */
  zoomToFootprints(padding: number = 50, duration: number = 1000): void {
    if (this._items.length === 0) return;

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    for (const item of this._items) {
      const [west, south, east, north] = item.bbox;
      minX = Math.min(minX, west);
      minY = Math.min(minY, south);
      maxX = Math.max(maxX, east);
      maxY = Math.max(maxY, north);
    }

    this._map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      {
        padding,
        duration,
      }
    );
  }

  /**
   * Zooms to a specific item.
   *
   * @param itemId - The item ID to zoom to
   * @param padding - Padding in pixels (default: 50)
   */
  zoomToItem(itemId: string, padding: number = 50): void {
    const item = this._items.find((i) => i.id === itemId);
    if (!item) return;

    const [west, south, east, north] = item.bbox;
    this._map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding,
        duration: 500,
      }
    );
  }

  /**
   * Shows/hides the footprint layers.
   *
   * @param visible - Whether layers should be visible
   */
  setVisibility(visible: boolean): void {
    const visibility = visible ? 'visible' : 'none';
    if (this._map.getLayer(this._fillLayerId)) {
      this._map.setLayoutProperty(this._fillLayerId, 'visibility', visibility);
    }
    if (this._map.getLayer(this._selectedLayerId)) {
      this._map.setLayoutProperty(this._selectedLayerId, 'visibility', visibility);
    }
    if (this._map.getLayer(this._outlineLayerId)) {
      this._map.setLayoutProperty(this._outlineLayerId, 'visibility', visibility);
    }
  }

  /**
   * Cleans up resources and removes layers from the map.
   */
  destroy(): void {
    this._removeLayers();
    this._clickHandler = undefined;
  }

  private _initLayers(): void {
    // Add source if it doesn't exist
    if (!this._map.getSource(this._sourceId)) {
      this._map.addSource(this._sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Add fill layer (unselected items) - show all by default
    if (!this._map.getLayer(this._fillLayerId)) {
      this._map.addLayer({
        id: this._fillLayerId,
        type: 'fill',
        source: this._sourceId,
        paint: {
          'fill-color': this._options.fillColor,
        },
      });
    }

    // Add selected fill layer - initially hidden (no features selected)
    if (!this._map.getLayer(this._selectedLayerId)) {
      this._map.addLayer({
        id: this._selectedLayerId,
        type: 'fill',
        source: this._sourceId,
        paint: {
          'fill-color': this._options.selectedFillColor,
        },
        filter: ['==', ['get', 'id'], ''],
      });
    }

    // Add outline layer
    if (!this._map.getLayer(this._outlineLayerId)) {
      this._map.addLayer({
        id: this._outlineLayerId,
        type: 'line',
        source: this._sourceId,
        paint: {
          'line-color': this._options.outlineColor,
          'line-width': this._options.outlineWidth,
        },
      });
    }

    this._layersInitialized = true;
  }

  private _setupInteraction(): void {
    // Hover effect
    this._map.on('mouseenter', this._fillLayerId, () => {
      this._map.getCanvas().style.cursor = 'pointer';
    });

    this._map.on('mouseleave', this._fillLayerId, () => {
      this._map.getCanvas().style.cursor = '';
    });

    this._map.on('mouseenter', this._selectedLayerId, () => {
      this._map.getCanvas().style.cursor = 'pointer';
    });

    this._map.on('mouseleave', this._selectedLayerId, () => {
      this._map.getCanvas().style.cursor = '';
    });

    // Click handling
    this._map.on('click', this._fillLayerId, (e) => {
      if (e.features && e.features.length > 0 && this._clickHandler) {
        const itemId = e.features[0].properties?.id;
        if (itemId) {
          this._clickHandler(itemId);
        }
      }
    });

    this._map.on('click', this._selectedLayerId, (e) => {
      if (e.features && e.features.length > 0 && this._clickHandler) {
        const itemId = e.features[0].properties?.id;
        if (itemId) {
          this._clickHandler(itemId);
        }
      }
    });
  }

  private _updateLayer(): void {
    // Wait for layers to be initialized
    if (!this._layersInitialized) {
      return;
    }

    // If source was removed (e.g., style change), re-initialize
    if (!this._map.getSource(this._sourceId)) {
      this._layersInitialized = false;
      this._initLayers();
      this._setupInteraction();
    }

    // Use bbox to create rectangular footprints
    const features: Feature[] = this._items.map((item) => {
      const [west, south, east, north] = item.bbox;
      return {
        type: 'Feature',
        properties: {
          id: item.id,
          datetime: item.properties.datetime,
          pointCount: item.properties.pointCount,
          sourceType: item.sourceType,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ]],
        },
      };
    });

    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    const source = this._map.getSource(this._sourceId) as GeoJSONSource;
    if (source) {
      source.setData(data);
    }

    // Update filters
    this._updateSelectedFilter();
  }

  private _updateSelectedFilter(): void {
    const selectedArray = Array.from(this._selectedIds);

    // Update fill layer - show items not in selectedArray
    if (this._map.getLayer(this._fillLayerId)) {
      if (selectedArray.length === 0) {
        // Show all features when nothing selected
        this._map.setFilter(this._fillLayerId, null);
      } else {
        this._map.setFilter(this._fillLayerId, [
          '!',
          ['in', ['get', 'id'], ['literal', selectedArray]],
        ]);
      }
    }

    // Update selected filter - show items in selectedArray
    if (this._map.getLayer(this._selectedLayerId)) {
      if (selectedArray.length === 0) {
        // Hide all when nothing selected
        this._map.setFilter(this._selectedLayerId, ['==', ['get', 'id'], '']);
      } else {
        this._map.setFilter(this._selectedLayerId, [
          'in',
          ['get', 'id'],
          ['literal', selectedArray],
        ]);
      }
    }
  }

  private _clearLayer(): void {
    const source = this._map.getSource(this._sourceId) as GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  private _removeLayers(): void {
    // Remove layers
    [this._outlineLayerId, this._selectedLayerId, this._fillLayerId].forEach((id) => {
      if (this._map.getLayer(id)) {
        this._map.removeLayer(id);
      }
    });

    // Remove source
    if (this._map.getSource(this._sourceId)) {
      this._map.removeSource(this._sourceId);
    }
  }
}
