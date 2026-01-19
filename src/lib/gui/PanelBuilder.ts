import type { UnifiedSearchItem, UsgsLidarState, DataSourceType } from '../core/types';
import { formatPointCount, getItemShortName, formatBbox, getUnifiedItemMetadata } from '../utils';
import {
  getClassificationName,
  COLORMAP_NAMES,
  COLORMAP_LABELS,
  getColormap,
} from 'maplibre-gl-lidar';
import type { ColormapName, ColorRangeConfig } from 'maplibre-gl-lidar';

/**
 * ASPRS Standard LiDAR Classification Colors (RGB)
 */
const CLASSIFICATION_COLORS: { [key: number]: [number, number, number] } = {
  0: [128, 128, 128], // Never Classified (gray)
  1: [128, 128, 128], // Unassigned (gray)
  2: [139, 90, 43], // Ground (brown)
  3: [34, 139, 34], // Low Vegetation (light green)
  4: [0, 128, 0], // Medium Vegetation (medium green)
  5: [0, 100, 0], // High Vegetation (dark green)
  6: [255, 165, 0], // Building (orange)
  7: [255, 0, 0], // Low Point (Noise) (red)
  8: [128, 128, 128], // Reserved (gray)
  9: [0, 0, 255], // Water (blue)
  10: [255, 255, 0], // Rail (yellow)
  11: [128, 128, 128], // Road Surface (gray)
  12: [128, 128, 128], // Reserved (gray)
  13: [255, 255, 0], // Wire - Guard (yellow)
  14: [255, 255, 0], // Wire - Conductor (yellow)
  15: [128, 0, 128], // Transmission Tower (purple)
  16: [255, 255, 0], // Wire - Connector (yellow)
  17: [192, 192, 192], // Bridge Deck (light gray)
  18: [255, 69, 0], // High Noise (orange-red)
  19: [160, 82, 45], // Overhead Structure (sienna)
  20: [173, 216, 230], // Ignored Ground (light blue)
  21: [245, 245, 220], // Snow (beige)
  22: [210, 180, 140], // Temporal Exclusion (tan)
};

/**
 * Callbacks for panel interactions
 */
export interface PanelCallbacks {
  onSearchByExtent: () => void;
  onStartDrawing: () => void;
  onStopDrawing: () => void;
  onSearchByDrawn: () => void;
  onClearDrawn: () => void;
  onItemSelect: (item: UnifiedSearchItem) => void;
  onItemLoad: (item: UnifiedSearchItem) => void;
  onLoadSelected: () => void;
  onCopySignedUrls: () => void;
  onDownloadSelected: () => void;
  onClearResults: () => void;
  onUnloadItem: (itemId: string) => void;
  onClearLoaded: () => void;
  onPointSizeChange: (size: number) => void;
  onOpacityChange: (opacity: number) => void;
  onColorSchemeChange: (scheme: string) => void;
  onZOffsetChange: (offset: number) => void;
  onPickableChange: (pickable: boolean) => void;
  onElevationRangeChange: (range: [number, number] | null) => void;
  onClassificationToggle: (classificationCode: number, visible: boolean) => void;
  onClassificationShowAll: () => void;
  onClassificationHideAll: () => void;
  onDataSourceChange: (source: DataSourceType) => void;
  onColormapChange: (colormap: ColormapName) => void;
  onColorRangeChange: (config: ColorRangeConfig) => void;
  onShowMetadata?: (itemId: string) => void;
  onCrossSectionPanel?: () => HTMLElement | null;
}

/**
 * Builds and manages the control panel UI.
 */
export class PanelBuilder {
  private _callbacks: PanelCallbacks;
  private _state: UsgsLidarState;
  private _container: HTMLElement | null = null;

  // Section references for updates
  private _searchSection: HTMLElement | null = null;
  private _resultsSection: HTMLElement | null = null;
  private _loadedSection: HTMLElement | null = null;
  private _vizSection: HTMLElement | null = null;
  private _crossSectionSection: HTMLElement | null = null;

  // New UI element references for point picking, elevation filter, and classification
  private _pickableCheckbox: HTMLInputElement | null = null;
  private _elevationCheckbox: HTMLInputElement | null = null;
  private _elevationSliderContainer: HTMLElement | null = null;
  private _elevationRangeValue: HTMLElement | null = null;
  private _elevationMinInput: HTMLInputElement | null = null;
  private _elevationMaxInput: HTMLInputElement | null = null;
  private _elevationTrackFill: HTMLElement | null = null;
  private _classificationLegendContainer: HTMLElement | null = null;
  private _classificationCheckboxes: Map<number, HTMLInputElement> = new Map();

  // Colormap and color range UI elements
  private _colormapContainer: HTMLElement | null = null;
  private _colormapSelect: HTMLSelectElement | null = null;
  private _colorbarCanvas: HTMLCanvasElement | null = null;
  private _colorbarMinLabel: HTMLElement | null = null;
  private _colorbarMaxLabel: HTMLElement | null = null;
  private _colorRangeModePercentile: HTMLInputElement | null = null;
  private _colorRangeModeAbsolute: HTMLInputElement | null = null;
  private _percentileLowSlider: HTMLInputElement | null = null;
  private _percentileHighSlider: HTMLInputElement | null = null;
  private _absoluteMinSlider: HTMLInputElement | null = null;
  private _absoluteMaxSlider: HTMLInputElement | null = null;
  private _percentileRangeValue: HTMLElement | null = null;
  private _absoluteRangeValue: HTMLElement | null = null;
  private _percentileTrackFill: HTMLElement | null = null;
  private _absoluteTrackFill: HTMLElement | null = null;
  private _percentileSliderContainer: HTMLElement | null = null;
  private _absoluteSliderContainer: HTMLElement | null = null;
  private _currentColormap: ColormapName = 'viridis';
  private _currentColorRangeConfig: ColorRangeConfig = {
    mode: 'percentile',
    percentileLow: 2,
    percentileHigh: 98,
  };
  private _dataBounds: { min: number; max: number } = { min: 0, max: 100 };
  private _computedBounds: { min: number; max: number } | null = null;

  constructor(callbacks: PanelCallbacks, state: UsgsLidarState) {
    this._callbacks = callbacks;
    this._state = state;
  }

  /**
   * Builds and returns the panel content element.
   */
  build(): HTMLElement {
    this._container = document.createElement('div');
    this._container.className = 'usgs-lidar-panel-content';

    // Search section
    this._searchSection = this._buildSearchSection();
    this._container.appendChild(this._searchSection);

    // Results section
    this._resultsSection = this._buildResultsSection();
    this._container.appendChild(this._resultsSection);

    // Loaded datasets section
    this._loadedSection = this._buildLoadedSection();
    this._container.appendChild(this._loadedSection);

    // Visualization section
    this._vizSection = this._buildVisualizationSection();
    this._container.appendChild(this._vizSection);

    // Cross-section section (embedded from LidarControl)
    this._crossSectionSection = this._buildCrossSectionSection();
    if (this._crossSectionSection) {
      this._container.appendChild(this._crossSectionSection);
    }

    return this._container;
  }

  /**
   * Updates the panel with new state.
   */
  updateState(state: UsgsLidarState): void {
    this._state = state;

    // Update search section
    if (this._searchSection) {
      this._updateSearchSection();
    }

    // Update results section
    if (this._resultsSection) {
      this._updateResultsSection();
    }

    // Update loaded section
    if (this._loadedSection) {
      this._updateLoadedSection();
    }

    // Update visualization section (sync sliders with lidar control state)
    if (this._vizSection) {
      this._updateVisualizationSection();
    }
  }

  private _buildSearchSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'usgs-lidar-section usgs-lidar-search-section';

    const header = document.createElement('div');
    header.className = 'usgs-lidar-section-header';
    header.textContent = 'Search';
    section.appendChild(header);

    const content = document.createElement('div');
    content.className = 'usgs-lidar-section-content';

    // Data source toggle
    const sourceRow = document.createElement('div');
    sourceRow.className = 'usgs-lidar-source-toggle';

    const copcLabel = document.createElement('label');
    copcLabel.className = 'usgs-lidar-source-option';
    const copcRadio = document.createElement('input');
    copcRadio.type = 'radio';
    copcRadio.name = 'usgs-lidar-source';
    copcRadio.value = 'copc';
    copcRadio.checked = this._state.dataSource === 'copc';
    copcRadio.id = 'usgs-lidar-source-copc';
    copcLabel.appendChild(copcRadio);
    copcLabel.appendChild(document.createTextNode(' COPC (Planetary Computer)'));

    const eptLabel = document.createElement('label');
    eptLabel.className = 'usgs-lidar-source-option';
    const eptRadio = document.createElement('input');
    eptRadio.type = 'radio';
    eptRadio.name = 'usgs-lidar-source';
    eptRadio.value = 'ept';
    eptRadio.checked = this._state.dataSource === 'ept';
    eptRadio.id = 'usgs-lidar-source-ept';
    eptLabel.appendChild(eptRadio);
    eptLabel.appendChild(document.createTextNode(' EPT (AWS Open Data)'));

    sourceRow.appendChild(copcLabel);
    sourceRow.appendChild(eptLabel);
    content.appendChild(sourceRow);

    // Event listeners for data source toggle
    copcRadio.addEventListener('change', () => {
      if (copcRadio.checked) {
        this._callbacks.onDataSourceChange('copc');
      }
    });
    eptRadio.addEventListener('change', () => {
      if (eptRadio.checked) {
        this._callbacks.onDataSourceChange('ept');
      }
    });

    // Search buttons row
    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'usgs-lidar-button-row';

    const extentBtn = document.createElement('button');
    extentBtn.className = 'usgs-lidar-btn usgs-lidar-btn-primary';
    extentBtn.textContent = 'Search Map Extent';
    extentBtn.addEventListener('click', () => this._callbacks.onSearchByExtent());
    buttonsRow.appendChild(extentBtn);

    const drawBtn = document.createElement('button');
    drawBtn.className = 'usgs-lidar-btn usgs-lidar-btn-secondary';
    drawBtn.id = 'usgs-lidar-draw-btn';
    drawBtn.textContent = 'Draw Rectangle';
    drawBtn.addEventListener('click', () => {
      if (this._state.isDrawing) {
        this._callbacks.onStopDrawing();
      } else {
        this._callbacks.onStartDrawing();
      }
    });
    buttonsRow.appendChild(drawBtn);

    content.appendChild(buttonsRow);

    // Drawn bbox info
    const bboxInfo = document.createElement('div');
    bboxInfo.className = 'usgs-lidar-bbox-info';
    bboxInfo.id = 'usgs-lidar-bbox-info';
    bboxInfo.style.display = 'none';
    content.appendChild(bboxInfo);

    // Drawn bbox actions
    const drawnActions = document.createElement('div');
    drawnActions.className = 'usgs-lidar-button-row';
    drawnActions.id = 'usgs-lidar-drawn-actions';
    drawnActions.style.display = 'none';

    const searchDrawnBtn = document.createElement('button');
    searchDrawnBtn.className = 'usgs-lidar-btn usgs-lidar-btn-primary';
    searchDrawnBtn.textContent = 'Search Drawn Area';
    searchDrawnBtn.addEventListener('click', () => this._callbacks.onSearchByDrawn());
    drawnActions.appendChild(searchDrawnBtn);

    const clearDrawnBtn = document.createElement('button');
    clearDrawnBtn.className = 'usgs-lidar-btn usgs-lidar-btn-danger';
    clearDrawnBtn.textContent = 'Clear';
    clearDrawnBtn.addEventListener('click', () => this._callbacks.onClearDrawn());
    drawnActions.appendChild(clearDrawnBtn);

    content.appendChild(drawnActions);

    // Loading indicator
    const loading = document.createElement('div');
    loading.className = 'usgs-lidar-loading';
    loading.id = 'usgs-lidar-search-loading';
    loading.style.display = 'none';
    loading.innerHTML = '<span class="usgs-lidar-spinner"></span> Searching...';
    content.appendChild(loading);

    // Error message
    const error = document.createElement('div');
    error.className = 'usgs-lidar-error';
    error.id = 'usgs-lidar-search-error';
    error.style.display = 'none';
    content.appendChild(error);

    section.appendChild(content);
    return section;
  }

  private _updateSearchSection(): void {
    // Update data source toggle
    const copcRadio = document.getElementById('usgs-lidar-source-copc') as HTMLInputElement;
    const eptRadio = document.getElementById('usgs-lidar-source-ept') as HTMLInputElement;
    if (copcRadio && eptRadio) {
      copcRadio.checked = this._state.dataSource === 'copc';
      eptRadio.checked = this._state.dataSource === 'ept';
    }

    // Update draw button
    const drawBtn = document.getElementById('usgs-lidar-draw-btn');
    if (drawBtn) {
      drawBtn.textContent = this._state.isDrawing ? 'Cancel Drawing' : 'Draw Rectangle';
      drawBtn.className = this._state.isDrawing
        ? 'usgs-lidar-btn usgs-lidar-btn-danger'
        : 'usgs-lidar-btn usgs-lidar-btn-secondary';
    }

    // Update bbox info
    const bboxInfo = document.getElementById('usgs-lidar-bbox-info');
    const drawnActions = document.getElementById('usgs-lidar-drawn-actions');
    if (bboxInfo && drawnActions) {
      if (this._state.drawnBbox) {
        bboxInfo.textContent = `Drawn area: ${formatBbox(this._state.drawnBbox)}`;
        bboxInfo.style.display = 'block';
        drawnActions.style.display = 'flex';
      } else {
        bboxInfo.style.display = 'none';
        drawnActions.style.display = 'none';
      }
    }

    // Update loading indicator
    const loading = document.getElementById('usgs-lidar-search-loading');
    if (loading) {
      loading.style.display = this._state.isSearching ? 'flex' : 'none';
    }

    // Update error message
    const error = document.getElementById('usgs-lidar-search-error');
    if (error) {
      if (this._state.searchError) {
        error.textContent = this._state.searchError;
        error.style.display = 'block';
      } else {
        error.style.display = 'none';
      }
    }
  }

  private _buildResultsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'usgs-lidar-section usgs-lidar-results-section';

    const header = document.createElement('div');
    header.className = 'usgs-lidar-section-header';
    header.innerHTML = 'Results <span id="usgs-lidar-results-count"></span>';
    section.appendChild(header);

    const content = document.createElement('div');
    content.className = 'usgs-lidar-section-content';

    // Results list
    const list = document.createElement('div');
    list.className = 'usgs-lidar-results-list';
    list.id = 'usgs-lidar-results-list';
    content.appendChild(list);

    // Actions row 1 - Load and Clear
    const actionsRow = document.createElement('div');
    actionsRow.className = 'usgs-lidar-button-row';
    actionsRow.id = 'usgs-lidar-results-actions';
    actionsRow.style.display = 'none';

    const loadSelectedBtn = document.createElement('button');
    loadSelectedBtn.className = 'usgs-lidar-btn usgs-lidar-btn-primary';
    loadSelectedBtn.id = 'usgs-lidar-load-selected-btn';
    loadSelectedBtn.textContent = 'Load Selected';
    loadSelectedBtn.addEventListener('click', () => this._callbacks.onLoadSelected());
    actionsRow.appendChild(loadSelectedBtn);

    const clearResultsBtn = document.createElement('button');
    clearResultsBtn.className = 'usgs-lidar-btn usgs-lidar-btn-secondary';
    clearResultsBtn.textContent = 'Clear';
    clearResultsBtn.addEventListener('click', () => this._callbacks.onClearResults());
    actionsRow.appendChild(clearResultsBtn);

    content.appendChild(actionsRow);

    // Actions row 2 - Copy URLs and Download
    const actionsRow2 = document.createElement('div');
    actionsRow2.className = 'usgs-lidar-button-row';
    actionsRow2.id = 'usgs-lidar-results-actions-2';
    actionsRow2.style.display = 'none';

    const copyUrlsBtn = document.createElement('button');
    copyUrlsBtn.className = 'usgs-lidar-btn usgs-lidar-btn-secondary';
    copyUrlsBtn.id = 'usgs-lidar-copy-urls-btn';
    copyUrlsBtn.textContent = 'Copy Signed URLs';
    copyUrlsBtn.title = 'Copy signed COPC URLs of selected items to clipboard';
    copyUrlsBtn.addEventListener('click', () => this._callbacks.onCopySignedUrls());
    actionsRow2.appendChild(copyUrlsBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'usgs-lidar-btn usgs-lidar-btn-secondary';
    downloadBtn.id = 'usgs-lidar-download-btn';
    downloadBtn.textContent = 'Download Selected';
    downloadBtn.title = 'Download selected COPC files';
    downloadBtn.addEventListener('click', () => this._callbacks.onDownloadSelected());
    actionsRow2.appendChild(downloadBtn);

    content.appendChild(actionsRow2);
    section.appendChild(content);

    return section;
  }

  private _updateResultsSection(): void {
    const countSpan = document.getElementById('usgs-lidar-results-count');
    const list = document.getElementById('usgs-lidar-results-list');
    const actions = document.getElementById('usgs-lidar-results-actions');
    const actions2 = document.getElementById('usgs-lidar-results-actions-2');
    const loadBtn = document.getElementById('usgs-lidar-load-selected-btn');
    const copyUrlsBtn = document.getElementById('usgs-lidar-copy-urls-btn');
    const downloadBtn = document.getElementById('usgs-lidar-download-btn');

    if (!list) return;

    // Update count
    if (countSpan) {
      if (this._state.searchResults.length > 0) {
        const total = this._state.totalMatched ?? this._state.searchResults.length;
        countSpan.textContent = `(${this._state.searchResults.length} of ${total})`;
      } else {
        countSpan.textContent = '';
      }
    }

    // Clear and rebuild list
    list.innerHTML = '';

    if (this._state.searchResults.length === 0) {
      if (actions) actions.style.display = 'none';
      if (actions2) actions2.style.display = 'none';
      return;
    }

    // Show actions
    if (actions) actions.style.display = 'flex';
    if (actions2) actions2.style.display = 'flex';

    // Update load button
    const selectedCount = this._state.selectedItems.size;
    if (loadBtn) {
      loadBtn.textContent = selectedCount > 0 ? `Load Selected (${selectedCount})` : 'Load Selected';
      (loadBtn as HTMLButtonElement).disabled = selectedCount === 0;
    }

    // Update copy URLs button
    if (copyUrlsBtn) {
      copyUrlsBtn.textContent = selectedCount > 0 ? `Copy Signed URLs (${selectedCount})` : 'Copy Signed URLs';
      (copyUrlsBtn as HTMLButtonElement).disabled = selectedCount === 0;
    }

    // Update download button
    if (downloadBtn) {
      downloadBtn.textContent = selectedCount > 0 ? `Download Selected (${selectedCount})` : 'Download Selected';
      (downloadBtn as HTMLButtonElement).disabled = selectedCount === 0;
    }

    // Build result items
    for (const item of this._state.searchResults) {
      const isSelected = this._state.selectedItems.has(item.id);
      const isLoaded = this._state.loadedItems.has(item.id);

      const itemEl = document.createElement('div');
      itemEl.className = `usgs-lidar-result-item${isSelected ? ' selected' : ''}${isLoaded ? ' loaded' : ''}`;

      // Checkbox
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isSelected;
      checkbox.disabled = isLoaded;
      checkbox.addEventListener('change', () => this._callbacks.onItemSelect(item));
      itemEl.appendChild(checkbox);

      // Item info
      const info = document.createElement('div');
      info.className = 'usgs-lidar-result-info';

      const name = document.createElement('div');
      name.className = 'usgs-lidar-result-name';
      name.textContent = getItemShortName(item.id);
      name.title = item.id;
      info.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'usgs-lidar-result-meta';
      meta.textContent = getUnifiedItemMetadata(item);
      info.appendChild(meta);

      itemEl.appendChild(info);

      // Load button
      if (!isLoaded) {
        const loadItemBtn = document.createElement('button');
        loadItemBtn.className = 'usgs-lidar-btn-icon';
        loadItemBtn.title = 'Load this dataset';
        loadItemBtn.innerHTML = '+';
        loadItemBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._callbacks.onItemLoad(item);
        });
        itemEl.appendChild(loadItemBtn);
      } else {
        const loadedBadge = document.createElement('span');
        loadedBadge.className = 'usgs-lidar-loaded-badge';
        loadedBadge.textContent = 'Loaded';
        itemEl.appendChild(loadedBadge);
      }

      list.appendChild(itemEl);
    }
  }

  private _buildLoadedSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'usgs-lidar-section usgs-lidar-loaded-section';
    section.id = 'usgs-lidar-loaded-section';
    section.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'usgs-lidar-section-header';
    header.innerHTML = 'Loaded <span id="usgs-lidar-loaded-count"></span>';
    section.appendChild(header);

    const content = document.createElement('div');
    content.className = 'usgs-lidar-section-content';

    // Loaded list
    const list = document.createElement('div');
    list.className = 'usgs-lidar-loaded-list';
    list.id = 'usgs-lidar-loaded-list';
    content.appendChild(list);

    // Clear all button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'usgs-lidar-btn usgs-lidar-btn-secondary usgs-lidar-btn-full';
    clearBtn.textContent = 'Clear All';
    clearBtn.addEventListener('click', () => this._callbacks.onClearLoaded());
    content.appendChild(clearBtn);

    section.appendChild(content);
    return section;
  }

  private _updateLoadedSection(): void {
    const section = document.getElementById('usgs-lidar-loaded-section');
    const countSpan = document.getElementById('usgs-lidar-loaded-count');
    const list = document.getElementById('usgs-lidar-loaded-list');

    if (!section || !list) return;

    const loadedCount = this._state.loadedItems.size;

    if (loadedCount === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    if (countSpan) {
      countSpan.textContent = `(${loadedCount})`;
    }

    // Rebuild list
    list.innerHTML = '';

    for (const [itemId, info] of this._state.loadedItems) {
      const itemEl = document.createElement('div');
      itemEl.className = 'usgs-lidar-loaded-item';

      const nameEl = document.createElement('div');
      nameEl.className = 'usgs-lidar-loaded-name';
      nameEl.textContent = getItemShortName(itemId);
      nameEl.title = itemId;
      itemEl.appendChild(nameEl);

      const pointsEl = document.createElement('div');
      pointsEl.className = 'usgs-lidar-loaded-points';
      pointsEl.textContent = formatPointCount(info.pointCount);
      itemEl.appendChild(pointsEl);

      // Info button for showing metadata (use internal point cloud ID, not USGS item ID)
      if (this._callbacks.onShowMetadata) {
        const infoBtn = document.createElement('button');
        infoBtn.className = 'usgs-lidar-btn-icon usgs-lidar-btn-info';
        infoBtn.title = 'Show metadata';
        infoBtn.innerHTML = 'ⓘ';
        infoBtn.addEventListener('click', () => this._callbacks.onShowMetadata!(info.id));
        itemEl.appendChild(infoBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'usgs-lidar-btn-icon usgs-lidar-btn-remove';
      removeBtn.title = 'Unload this dataset';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => this._callbacks.onUnloadItem(itemId));
      itemEl.appendChild(removeBtn);

      list.appendChild(itemEl);
    }
  }

  private _updateVisualizationSection(): void {
    const lidarState = this._state.lidarState;
    if (!lidarState) return;

    // Sync z-offset slider with lidar control state
    const zOffsetSlider = document.getElementById('usgs-lidar-zoffset-slider') as HTMLInputElement;
    const zOffsetValue = document.getElementById('usgs-lidar-zoffset-value');
    if (zOffsetSlider && lidarState.zOffset !== undefined) {
      // Only update if value differs to avoid triggering unnecessary events
      if (parseFloat(zOffsetSlider.value) !== lidarState.zOffset) {
        zOffsetSlider.value = String(lidarState.zOffset);
        if (zOffsetValue) {
          zOffsetValue.textContent = `${Math.round(lidarState.zOffset)}m`;
        }
      }
    }

    // Sync point size slider
    const sizeSlider = document.getElementById('usgs-lidar-size-slider') as HTMLInputElement;
    const sizeValue = document.getElementById('usgs-lidar-size-value');
    if (sizeSlider && lidarState.pointSize !== undefined) {
      if (parseFloat(sizeSlider.value) !== lidarState.pointSize) {
        sizeSlider.value = String(lidarState.pointSize);
        if (sizeValue) {
          sizeValue.textContent = String(lidarState.pointSize);
        }
      }
    }

    // Sync opacity slider
    const opacitySlider = document.getElementById('usgs-lidar-opacity-slider') as HTMLInputElement;
    const opacityValue = document.getElementById('usgs-lidar-opacity-value');
    if (opacitySlider && lidarState.opacity !== undefined) {
      if (parseFloat(opacitySlider.value) !== lidarState.opacity) {
        opacitySlider.value = String(lidarState.opacity);
        if (opacityValue) {
          opacityValue.textContent = String(lidarState.opacity);
        }
      }
    }

    // Sync computed bounds FIRST (actual values from percentile calculation)
    // This must happen before updating data bounds so slider values use correct computed bounds
    if (lidarState.computedColorBounds !== undefined) {
      this._computedBounds = lidarState.computedColorBounds;
    }

    // Sync color scheme dropdown
    const colorSelect = document.getElementById('usgs-lidar-color-select') as HTMLSelectElement;
    if (colorSelect && lidarState.colorScheme !== undefined) {
      // colorScheme can be a string or an object - only sync if it's a simple string type
      const scheme = typeof lidarState.colorScheme === 'string' ? lidarState.colorScheme : null;
      if (scheme) {
        if (colorSelect.value !== scheme) {
          colorSelect.value = scheme;
        }
        this._updateClassificationLegendVisibility(scheme);
        this._updateColormapVisibility(scheme);
        // Update data bounds when scheme changes (uses _computedBounds if available)
        this._updateDataBoundsForScheme(scheme);
      }
    }

    // Sync colormap dropdown
    if (lidarState.colormap !== undefined) {
      this.setColormap(lidarState.colormap);
    }

    // Sync color range config
    if (lidarState.colorRange !== undefined) {
      this.setColorRangeConfig(lidarState.colorRange);
    }

    // Update colorbar labels based on current config
    this._updateColorbarLabels();

    // Sync pickable checkbox
    if (this._pickableCheckbox && lidarState.pickable !== undefined) {
      if (this._pickableCheckbox.checked !== lidarState.pickable) {
        this._pickableCheckbox.checked = lidarState.pickable;
      }
    }

    // Sync elevation filter state
    if (this._elevationCheckbox && lidarState.elevationRange !== undefined) {
      const hasFilter = lidarState.elevationRange !== null;
      if (this._elevationCheckbox.checked !== hasFilter) {
        this._elevationCheckbox.checked = hasFilter;
        if (this._elevationSliderContainer) {
          this._elevationSliderContainer.style.display = hasFilter ? 'flex' : 'none';
        }
      }
      if (hasFilter && lidarState.elevationRange) {
        const [min, max] = lidarState.elevationRange;
        if (this._elevationMinInput) {
          this._elevationMinInput.value = String(min);
        }
        if (this._elevationMaxInput) {
          this._elevationMaxInput.value = String(max);
        }
        if (this._elevationRangeValue) {
          this._elevationRangeValue.textContent = `${Math.round(min)} - ${Math.round(max)}`;
        }
        this._updateElevationTrackFill();
      }
    }

    // Update classification legend if classifications changed
    if (lidarState.availableClassifications) {
      this.updateClassificationLegend();
    }
  }

  private _buildVisualizationSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'usgs-lidar-section usgs-lidar-viz-section';
    section.id = 'usgs-lidar-viz-section';
    section.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'usgs-lidar-section-header';
    header.textContent = 'Visualization';
    section.appendChild(header);

    const content = document.createElement('div');
    content.className = 'usgs-lidar-section-content';

    // Color scheme dropdown
    const colorRow = document.createElement('div');
    colorRow.className = 'usgs-lidar-control-row';

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color By';
    colorRow.appendChild(colorLabel);

    const colorSelect = document.createElement('select');
    colorSelect.className = 'usgs-lidar-select';
    colorSelect.id = 'usgs-lidar-color-select';
    ['elevation', 'intensity', 'classification', 'rgb'].forEach((scheme) => {
      const option = document.createElement('option');
      option.value = scheme;
      option.textContent = scheme === 'rgb' ? 'RGB' : scheme.charAt(0).toUpperCase() + scheme.slice(1);
      colorSelect.appendChild(option);
    });
    colorSelect.addEventListener('change', () => {
      this._callbacks.onColorSchemeChange(colorSelect.value);
      this._updateClassificationLegendVisibility(colorSelect.value);
      this._updateColormapVisibility(colorSelect.value);
      this._updateDataBoundsForScheme(colorSelect.value);
    });
    colorRow.appendChild(colorSelect);

    content.appendChild(colorRow);

    // Classification legend (shown only when classification color scheme is selected)
    content.appendChild(this._buildClassificationLegend());

    // Colormap section (shown only for elevation/intensity color schemes)
    content.appendChild(this._buildColormapSection());

    // Point size slider
    const sizeRow = document.createElement('div');
    sizeRow.className = 'usgs-lidar-control-row';

    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Point Size';
    sizeRow.appendChild(sizeLabel);

    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.className = 'usgs-lidar-slider';
    sizeSlider.id = 'usgs-lidar-size-slider';
    sizeSlider.min = '0.5';
    sizeSlider.max = '10';
    sizeSlider.step = '0.5';
    sizeSlider.value = '2';
    sizeSlider.addEventListener('input', () => {
      this._callbacks.onPointSizeChange(parseFloat(sizeSlider.value));
      sizeValue.textContent = sizeSlider.value;
    });
    sizeRow.appendChild(sizeSlider);

    const sizeValue = document.createElement('span');
    sizeValue.className = 'usgs-lidar-slider-value';
    sizeValue.id = 'usgs-lidar-size-value';
    sizeValue.textContent = '2';
    sizeRow.appendChild(sizeValue);

    content.appendChild(sizeRow);

    // Opacity slider
    const opacityRow = document.createElement('div');
    opacityRow.className = 'usgs-lidar-control-row';

    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Opacity';
    opacityRow.appendChild(opacityLabel);

    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.className = 'usgs-lidar-slider';
    opacitySlider.id = 'usgs-lidar-opacity-slider';
    opacitySlider.min = '0.1';
    opacitySlider.max = '1';
    opacitySlider.step = '0.1';
    opacitySlider.value = '1';
    opacitySlider.addEventListener('input', () => {
      this._callbacks.onOpacityChange(parseFloat(opacitySlider.value));
      opacityValue.textContent = opacitySlider.value;
    });
    opacityRow.appendChild(opacitySlider);

    const opacityValue = document.createElement('span');
    opacityValue.className = 'usgs-lidar-slider-value';
    opacityValue.id = 'usgs-lidar-opacity-value';
    opacityValue.textContent = '1';
    opacityRow.appendChild(opacityValue);

    content.appendChild(opacityRow);

    // Z Offset slider (to adjust for absolute elevation) - moved up, right after opacity
    const zOffsetRow = document.createElement('div');
    zOffsetRow.className = 'usgs-lidar-control-row';

    const zOffsetLabel = document.createElement('label');
    zOffsetLabel.textContent = 'Z Offset';
    zOffsetLabel.title = 'Vertical offset to adjust for absolute elevation (negative values bring points down)';
    zOffsetRow.appendChild(zOffsetLabel);

    const zOffsetSlider = document.createElement('input');
    zOffsetSlider.type = 'range';
    zOffsetSlider.className = 'usgs-lidar-slider';
    zOffsetSlider.id = 'usgs-lidar-zoffset-slider';
    zOffsetSlider.min = '-3000';
    zOffsetSlider.max = '0';
    zOffsetSlider.step = '50';
    zOffsetSlider.value = '0';
    zOffsetSlider.addEventListener('input', () => {
      const offset = parseFloat(zOffsetSlider.value);
      this._callbacks.onZOffsetChange(offset);
      zOffsetValue.textContent = `${Math.round(offset)}m`;
    });
    zOffsetRow.appendChild(zOffsetSlider);

    const zOffsetValue = document.createElement('span');
    zOffsetValue.className = 'usgs-lidar-slider-value usgs-lidar-slider-value-wide';
    zOffsetValue.id = 'usgs-lidar-zoffset-value';
    zOffsetValue.textContent = '0m';
    zOffsetRow.appendChild(zOffsetValue);

    content.appendChild(zOffsetRow);

    // Enable point picking checkbox
    content.appendChild(this._buildPickableCheckbox());

    // Elevation filter checkbox with dual range slider
    content.appendChild(this._buildElevationFilter());

    section.appendChild(content);
    return section;
  }

  /**
   * Shows/hides the visualization section.
   */
  showVisualizationSection(show: boolean): void {
    const section = document.getElementById('usgs-lidar-viz-section');
    if (section) {
      section.style.display = show ? 'block' : 'none';
    }

    // Show/hide the cross-section section
    // If showing and the section doesn't exist yet, try to create it now
    // (LidarControl should be initialized by now)
    if (show && !this._crossSectionSection && this._container) {
      this._crossSectionSection = this._buildCrossSectionSection();
      if (this._crossSectionSection) {
        this._container.appendChild(this._crossSectionSection);
      }
    }

    if (this._crossSectionSection) {
      this._crossSectionSection.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Builds the cross-section section that embeds the panel from LidarControl.
   * This may return null if the LidarControl hasn't been initialized yet.
   */
  private _buildCrossSectionSection(): HTMLElement | null {
    if (!this._callbacks.onCrossSectionPanel) return null;

    const panel = this._callbacks.onCrossSectionPanel();
    if (!panel) return null;

    const section = document.createElement('div');
    section.className = 'usgs-lidar-section usgs-lidar-crosssection-section';
    section.id = 'usgs-lidar-crosssection-section';
    section.style.display = 'none'; // Hidden until data is loaded

    // Collapsible header
    const header = document.createElement('div');
    header.className = 'usgs-lidar-section-header usgs-lidar-section-collapsible';
    header.innerHTML = '<span class="usgs-lidar-section-toggle">▶</span> Cross-Section';
    header.style.cursor = 'pointer';

    // Collapsible body
    const body = document.createElement('div');
    body.className = 'usgs-lidar-section-body';
    body.style.display = 'none';
    body.appendChild(panel);

    // Toggle handler
    header.addEventListener('click', () => {
      const toggle = header.querySelector('.usgs-lidar-section-toggle');
      if (body.style.display === 'none') {
        body.style.display = 'block';
        if (toggle) toggle.textContent = '▼';
      } else {
        body.style.display = 'none';
        if (toggle) toggle.textContent = '▶';
      }
    });

    section.appendChild(header);
    section.appendChild(body);

    return section;
  }

  /**
   * Builds the point picking checkbox.
   */
  private _buildPickableCheckbox(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'usgs-lidar-checkbox-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'usgs-lidar-pickable-checkbox';
    checkbox.checked = this._state.lidarState?.pickable ?? false;
    this._pickableCheckbox = checkbox;

    const label = document.createElement('label');
    label.htmlFor = 'usgs-lidar-pickable-checkbox';
    label.textContent = 'Enable point picking';

    checkbox.addEventListener('change', () => {
      this._callbacks.onPickableChange(checkbox.checked);
    });

    group.appendChild(checkbox);
    group.appendChild(label);

    return group;
  }

  /**
   * Builds the elevation filter controls with checkbox and dual-thumb range slider.
   */
  private _buildElevationFilter(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'usgs-lidar-checkbox-group';

    // Checkbox row
    const checkboxRow = document.createElement('div');
    checkboxRow.className = 'usgs-lidar-checkbox-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'usgs-lidar-elevation-checkbox';
    checkbox.checked = false;
    this._elevationCheckbox = checkbox;

    const label = document.createElement('label');
    label.htmlFor = 'usgs-lidar-elevation-checkbox';
    label.textContent = 'Elevation Filter';

    checkboxRow.appendChild(checkbox);
    checkboxRow.appendChild(label);
    group.appendChild(checkboxRow);

    // Dual range slider container (hidden by default)
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'usgs-lidar-dual-range-row';
    sliderContainer.style.display = 'none';
    this._elevationSliderContainer = sliderContainer;

    // Get elevation bounds from loaded point clouds
    const bounds = this._getElevationBounds();

    // Label
    const rangeLabel = document.createElement('label');
    rangeLabel.textContent = 'Range (m)';
    sliderContainer.appendChild(rangeLabel);

    // Dual range slider wrapper
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'usgs-lidar-dual-range-slider';

    // Track background
    const track = document.createElement('div');
    track.className = 'usgs-lidar-dual-range-track';
    sliderWrapper.appendChild(track);

    // Track fill (colored portion between thumbs)
    const trackFill = document.createElement('div');
    trackFill.className = 'usgs-lidar-dual-range-fill';
    this._elevationTrackFill = trackFill;
    sliderWrapper.appendChild(trackFill);

    // Min slider (lower thumb)
    const minInput = document.createElement('input');
    minInput.type = 'range';
    minInput.className = 'usgs-lidar-dual-range-input usgs-lidar-dual-range-min';
    minInput.min = String(bounds.min);
    minInput.max = String(bounds.max);
    minInput.step = '1';
    minInput.value = String(bounds.min);
    this._elevationMinInput = minInput;
    sliderWrapper.appendChild(minInput);

    // Max slider (upper thumb)
    const maxInput = document.createElement('input');
    maxInput.type = 'range';
    maxInput.className = 'usgs-lidar-dual-range-input usgs-lidar-dual-range-max';
    maxInput.min = String(bounds.min);
    maxInput.max = String(bounds.max);
    maxInput.step = '1';
    maxInput.value = String(bounds.max);
    this._elevationMaxInput = maxInput;
    sliderWrapper.appendChild(maxInput);

    sliderContainer.appendChild(sliderWrapper);

    // Range value display
    const rangeValue = document.createElement('span');
    rangeValue.className = 'usgs-lidar-dual-range-value';
    rangeValue.textContent = `${bounds.min} - ${bounds.max}`;
    this._elevationRangeValue = rangeValue;
    sliderContainer.appendChild(rangeValue);

    group.appendChild(sliderContainer);

    // Event handlers
    const updateElevationRange = () => {
      if (checkbox.checked) {
        const min = parseFloat(minInput.value);
        const max = parseFloat(maxInput.value);
        this._callbacks.onElevationRangeChange([min, max]);
      }
    };

    const updateDisplay = () => {
      const min = parseFloat(minInput.value);
      const max = parseFloat(maxInput.value);
      rangeValue.textContent = `${Math.round(min)} - ${Math.round(max)}`;
      this._updateElevationTrackFill();
    };

    minInput.addEventListener('input', () => {
      const minVal = parseFloat(minInput.value);
      const maxVal = parseFloat(maxInput.value);
      // Ensure min doesn't exceed max
      if (minVal > maxVal) {
        minInput.value = maxInput.value;
      }
      updateDisplay();
      updateElevationRange();
    });

    maxInput.addEventListener('input', () => {
      const minVal = parseFloat(minInput.value);
      const maxVal = parseFloat(maxInput.value);
      // Ensure max doesn't go below min
      if (maxVal < minVal) {
        maxInput.value = minInput.value;
      }
      updateDisplay();
      updateElevationRange();
    });

    checkbox.addEventListener('change', () => {
      sliderContainer.style.display = checkbox.checked ? 'flex' : 'none';
      if (checkbox.checked) {
        // Update bounds when enabling filter
        const newBounds = this._getElevationBounds();
        minInput.min = String(newBounds.min);
        minInput.max = String(newBounds.max);
        minInput.value = String(newBounds.min);
        maxInput.min = String(newBounds.min);
        maxInput.max = String(newBounds.max);
        maxInput.value = String(newBounds.max);
        updateDisplay();
        // Apply current range
        updateElevationRange();
      } else {
        this._callbacks.onElevationRangeChange(null);
      }
    });

    // Initialize track fill position
    this._updateElevationTrackFill();

    return group;
  }

  /**
   * Updates the elevation range slider track fill position.
   */
  private _updateElevationTrackFill(): void {
    if (!this._elevationMinInput || !this._elevationMaxInput || !this._elevationTrackFill) return;

    const min = parseFloat(this._elevationMinInput.min);
    const max = parseFloat(this._elevationMinInput.max);
    const minVal = parseFloat(this._elevationMinInput.value);
    const maxVal = parseFloat(this._elevationMaxInput.value);

    const range = max - min;
    if (range <= 0) return;

    const leftPercent = ((minVal - min) / range) * 100;
    const rightPercent = ((max - maxVal) / range) * 100;

    this._elevationTrackFill.style.left = `${leftPercent}%`;
    this._elevationTrackFill.style.right = `${rightPercent}%`;
  }

  /**
   * Gets elevation bounds from loaded point clouds.
   */
  private _getElevationBounds(): { min: number; max: number } {
    if (!this._state.lidarState?.pointClouds || this._state.lidarState.pointClouds.length === 0) {
      return { min: 0, max: 100 };
    }

    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const pc of this._state.lidarState.pointClouds) {
      if (pc.bounds) {
        minZ = Math.min(minZ, pc.bounds.minZ);
        maxZ = Math.max(maxZ, pc.bounds.maxZ);
      }
    }

    // Round to nice values
    minZ = Math.floor(minZ);
    maxZ = Math.ceil(maxZ);

    // Return reasonable defaults if no valid bounds found
    if (!isFinite(minZ) || !isFinite(maxZ)) {
      return { min: 0, max: 100 };
    }

    return { min: minZ, max: maxZ };
  }

  /**
   * Builds the classification legend with toggleable visibility.
   */
  private _buildClassificationLegend(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'usgs-lidar-classification-legend';
    container.style.display = 'none'; // Hidden by default, shown when classification scheme is selected
    this._classificationLegendContainer = container;

    // Header with Show All / Hide All buttons
    const header = document.createElement('div');
    header.className = 'usgs-lidar-classification-header';

    const showAllBtn = document.createElement('button');
    showAllBtn.type = 'button';
    showAllBtn.className = 'usgs-lidar-btn-small';
    showAllBtn.textContent = 'Show All';
    showAllBtn.addEventListener('click', () => this._callbacks.onClassificationShowAll());

    const hideAllBtn = document.createElement('button');
    hideAllBtn.type = 'button';
    hideAllBtn.className = 'usgs-lidar-btn-small';
    hideAllBtn.textContent = 'Hide All';
    hideAllBtn.addEventListener('click', () => this._callbacks.onClassificationHideAll());

    header.appendChild(showAllBtn);
    header.appendChild(hideAllBtn);
    container.appendChild(header);

    // Legend items list
    const list = document.createElement('div');
    list.className = 'usgs-lidar-classification-list';
    list.id = 'usgs-lidar-classification-list';

    // Build legend items from available classifications
    this._rebuildClassificationList(list);

    container.appendChild(list);
    return container;
  }

  /**
   * Rebuilds the classification list items.
   */
  private _rebuildClassificationList(listContainer: HTMLElement): void {
    listContainer.innerHTML = '';
    this._classificationCheckboxes.clear();

    const availableClassifications = this._state.lidarState?.availableClassifications;
    const hiddenClassifications = this._state.lidarState?.hiddenClassifications || new Set<number>();

    if (!availableClassifications || availableClassifications.size === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'usgs-lidar-classification-empty';
      placeholder.textContent = 'Loading classifications...';
      listContainer.appendChild(placeholder);
      return;
    }

    // Sort classifications by code
    const sortedCodes = Array.from(availableClassifications).sort((a, b) => a - b);

    for (const code of sortedCodes) {
      const item = document.createElement('div');
      item.className = 'usgs-lidar-classification-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `usgs-lidar-class-${code}`;
      checkbox.checked = !hiddenClassifications.has(code);
      checkbox.addEventListener('change', () => {
        this._callbacks.onClassificationToggle(code, checkbox.checked);
      });
      this._classificationCheckboxes.set(code, checkbox);

      const swatch = document.createElement('span');
      swatch.className = 'usgs-lidar-classification-swatch';
      const color = CLASSIFICATION_COLORS[code] || [128, 128, 128];
      swatch.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

      const label = document.createElement('label');
      label.htmlFor = `usgs-lidar-class-${code}`;
      label.className = 'usgs-lidar-classification-label';
      label.textContent = getClassificationName(code);

      item.appendChild(checkbox);
      item.appendChild(swatch);
      item.appendChild(label);
      listContainer.appendChild(item);
    }
  }

  /**
   * Updates visibility of the classification legend based on color scheme.
   */
  private _updateClassificationLegendVisibility(colorScheme: string): void {
    if (this._classificationLegendContainer) {
      this._classificationLegendContainer.style.display =
        colorScheme === 'classification' ? 'block' : 'none';
    }
  }

  /**
   * Updates the classification legend checkboxes.
   */
  updateClassificationLegend(): void {
    const list = document.getElementById('usgs-lidar-classification-list');
    if (list) {
      this._rebuildClassificationList(list);
    }
  }

  /**
   * Builds the colormap section with dropdown, colorbar, and color range controls.
   */
  private _buildColormapSection(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'usgs-lidar-colormap-section';
    container.style.display = 'none'; // Hidden by default
    this._colormapContainer = container;

    // Colormap dropdown row
    const colormapRow = document.createElement('div');
    colormapRow.className = 'usgs-lidar-control-row';

    const colormapLabel = document.createElement('label');
    colormapLabel.textContent = 'Colormap';
    colormapRow.appendChild(colormapLabel);

    const colormapSelect = document.createElement('select');
    colormapSelect.className = 'usgs-lidar-select';
    colormapSelect.id = 'usgs-lidar-colormap-select';

    // Add colormap options
    for (const name of COLORMAP_NAMES) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = COLORMAP_LABELS[name] || name;
      colormapSelect.appendChild(option);
    }
    colormapSelect.value = this._currentColormap;
    this._colormapSelect = colormapSelect;

    colormapSelect.addEventListener('change', () => {
      this._currentColormap = colormapSelect.value as ColormapName;
      this._updateColorbar();
      this._callbacks.onColormapChange(this._currentColormap);
    });
    colormapRow.appendChild(colormapSelect);

    container.appendChild(colormapRow);

    // Colorbar container with min/max labels
    const colorbarContainer = document.createElement('div');
    colorbarContainer.className = 'usgs-lidar-colorbar-container';

    // Min label
    const minLabel = document.createElement('span');
    minLabel.className = 'usgs-lidar-colorbar-label usgs-lidar-colorbar-min';
    minLabel.textContent = '0';
    this._colorbarMinLabel = minLabel;
    colorbarContainer.appendChild(minLabel);

    // Colorbar canvas
    const colorbarCanvas = document.createElement('canvas');
    colorbarCanvas.className = 'usgs-lidar-colorbar-canvas';
    colorbarCanvas.width = 200;
    colorbarCanvas.height = 16;
    this._colorbarCanvas = colorbarCanvas;
    colorbarContainer.appendChild(colorbarCanvas);

    // Max label
    const maxLabel = document.createElement('span');
    maxLabel.className = 'usgs-lidar-colorbar-label usgs-lidar-colorbar-max';
    maxLabel.textContent = '100';
    this._colorbarMaxLabel = maxLabel;
    colorbarContainer.appendChild(maxLabel);

    container.appendChild(colorbarContainer);

    // Color range controls
    container.appendChild(this._buildColorRangeControls());

    // Initialize colorbar
    this._updateColorbar();

    return container;
  }

  /**
   * Builds the color range controls with mode toggle and sliders.
   */
  private _buildColorRangeControls(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'usgs-lidar-color-range-section';

    // Header with label and reset button
    const header = document.createElement('div');
    header.className = 'usgs-lidar-color-range-header';

    const label = document.createElement('span');
    label.textContent = 'Color Range';
    header.appendChild(label);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'usgs-lidar-btn-small';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => this._resetColorRange());
    header.appendChild(resetBtn);

    container.appendChild(header);

    // Mode toggle (Percentile / Absolute)
    const modeRow = document.createElement('div');
    modeRow.className = 'usgs-lidar-color-range-mode';

    const percentileOption = document.createElement('label');
    percentileOption.className = 'usgs-lidar-radio-option';
    const percentileRadio = document.createElement('input');
    percentileRadio.type = 'radio';
    percentileRadio.name = 'usgs-lidar-color-range-mode';
    percentileRadio.value = 'percentile';
    percentileRadio.checked = true;
    percentileRadio.id = 'usgs-lidar-color-range-percentile';
    this._colorRangeModePercentile = percentileRadio;
    percentileOption.appendChild(percentileRadio);
    percentileOption.appendChild(document.createTextNode(' Percentile'));

    const absoluteOption = document.createElement('label');
    absoluteOption.className = 'usgs-lidar-radio-option';
    const absoluteRadio = document.createElement('input');
    absoluteRadio.type = 'radio';
    absoluteRadio.name = 'usgs-lidar-color-range-mode';
    absoluteRadio.value = 'absolute';
    absoluteRadio.id = 'usgs-lidar-color-range-absolute';
    this._colorRangeModeAbsolute = absoluteRadio;
    absoluteOption.appendChild(absoluteRadio);
    absoluteOption.appendChild(document.createTextNode(' Absolute'));

    modeRow.appendChild(percentileOption);
    modeRow.appendChild(absoluteOption);
    container.appendChild(modeRow);

    // Event listeners for mode change
    percentileRadio.addEventListener('change', () => this._onColorRangeModeChange());
    absoluteRadio.addEventListener('change', () => this._onColorRangeModeChange());

    // Percentile slider container
    container.appendChild(this._buildPercentileSliders());

    // Absolute slider container
    container.appendChild(this._buildAbsoluteSliders());

    return container;
  }

  /**
   * Builds the percentile range sliders.
   */
  private _buildPercentileSliders(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'usgs-lidar-dual-range-row';
    container.id = 'usgs-lidar-percentile-slider-container';
    this._percentileSliderContainer = container;

    const label = document.createElement('label');
    label.textContent = 'Range (%)';
    container.appendChild(label);

    // Dual range slider wrapper
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'usgs-lidar-dual-range-slider';

    // Track background
    const track = document.createElement('div');
    track.className = 'usgs-lidar-dual-range-track';
    sliderWrapper.appendChild(track);

    // Track fill
    const trackFill = document.createElement('div');
    trackFill.className = 'usgs-lidar-dual-range-fill';
    this._percentileTrackFill = trackFill;
    sliderWrapper.appendChild(trackFill);

    // Min slider
    const minInput = document.createElement('input');
    minInput.type = 'range';
    minInput.className = 'usgs-lidar-dual-range-input usgs-lidar-dual-range-min';
    minInput.min = '0';
    minInput.max = '100';
    minInput.step = '1';
    minInput.value = '2';
    this._percentileLowSlider = minInput;
    sliderWrapper.appendChild(minInput);

    // Max slider
    const maxInput = document.createElement('input');
    maxInput.type = 'range';
    maxInput.className = 'usgs-lidar-dual-range-input usgs-lidar-dual-range-max';
    maxInput.min = '0';
    maxInput.max = '100';
    maxInput.step = '1';
    maxInput.value = '98';
    this._percentileHighSlider = maxInput;
    sliderWrapper.appendChild(maxInput);

    container.appendChild(sliderWrapper);

    // Range value display
    const rangeValue = document.createElement('span');
    rangeValue.className = 'usgs-lidar-dual-range-value';
    rangeValue.textContent = '2% - 98%';
    this._percentileRangeValue = rangeValue;
    container.appendChild(rangeValue);

    // Event handlers
    minInput.addEventListener('input', () => this._onPercentileSliderChange());
    maxInput.addEventListener('input', () => this._onPercentileSliderChange());

    // Initialize track fill
    this._updatePercentileTrackFill();

    return container;
  }

  /**
   * Builds the absolute range sliders.
   */
  private _buildAbsoluteSliders(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'usgs-lidar-dual-range-row';
    container.id = 'usgs-lidar-absolute-slider-container';
    container.style.display = 'none'; // Hidden by default (percentile mode is default)
    this._absoluteSliderContainer = container;

    const label = document.createElement('label');
    label.textContent = 'Range';
    container.appendChild(label);

    // Dual range slider wrapper
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'usgs-lidar-dual-range-slider';

    // Track background
    const track = document.createElement('div');
    track.className = 'usgs-lidar-dual-range-track';
    sliderWrapper.appendChild(track);

    // Track fill
    const trackFill = document.createElement('div');
    trackFill.className = 'usgs-lidar-dual-range-fill';
    this._absoluteTrackFill = trackFill;
    sliderWrapper.appendChild(trackFill);

    // Min slider
    const minInput = document.createElement('input');
    minInput.type = 'range';
    minInput.className = 'usgs-lidar-dual-range-input usgs-lidar-dual-range-min';
    minInput.min = String(this._dataBounds.min);
    minInput.max = String(this._dataBounds.max);
    minInput.step = '0.01';
    minInput.value = String(this._dataBounds.min);
    this._absoluteMinSlider = minInput;
    sliderWrapper.appendChild(minInput);

    // Max slider
    const maxInput = document.createElement('input');
    maxInput.type = 'range';
    maxInput.className = 'usgs-lidar-dual-range-input usgs-lidar-dual-range-max';
    maxInput.min = String(this._dataBounds.min);
    maxInput.max = String(this._dataBounds.max);
    maxInput.step = '0.01';
    maxInput.value = String(this._dataBounds.max);
    this._absoluteMaxSlider = maxInput;
    sliderWrapper.appendChild(maxInput);

    container.appendChild(sliderWrapper);

    // Range value display (current selected values)
    const rangeValue = document.createElement('span');
    rangeValue.className = 'usgs-lidar-dual-range-value';
    rangeValue.textContent = `${this._formatValue(this._dataBounds.min)} - ${this._formatValue(this._dataBounds.max)}`;
    this._absoluteRangeValue = rangeValue;
    container.appendChild(rangeValue);

    // Event handlers
    minInput.addEventListener('input', () => this._onAbsoluteSliderChange());
    maxInput.addEventListener('input', () => this._onAbsoluteSliderChange());

    // Initialize track fill
    this._updateAbsoluteTrackFill();

    return container;
  }

  /**
   * Updates colormap section visibility based on color scheme.
   */
  private _updateColormapVisibility(colorScheme: string): void {
    if (this._colormapContainer) {
      const showColormap = colorScheme === 'elevation' || colorScheme === 'intensity';
      this._colormapContainer.style.display = showColormap ? 'block' : 'none';
    }
  }

  /**
   * Updates data bounds based on the current color scheme.
   */
  private _updateDataBoundsForScheme(scheme: string): void {
    let bounds: { min: number; max: number };

    if (scheme === 'elevation') {
      bounds = this._getElevationBounds();
    } else if (scheme === 'intensity') {
      bounds = this._getIntensityBounds();
    } else {
      bounds = { min: 0, max: 100 };
    }

    this._dataBounds = bounds;
    this._updateAbsoluteSliderBounds(bounds.min, bounds.max);
    this._updateColorbarLabels();
  }

  /**
   * Gets intensity bounds from loaded point clouds.
   * Intensity values are normalized to 0-1 range during loading in maplibre-gl-lidar.
   */
  private _getIntensityBounds(): { min: number; max: number } {
    // Intensity values are normalized to 0-1 range during loading
    // This matches the behavior in maplibre-gl-lidar
    return { min: 0, max: 1 };
  }

  /**
   * Updates the absolute slider bounds.
   * This sets the min/max range of the sliders and initializes values based on computed bounds or percentile.
   */
  private _updateAbsoluteSliderBounds(min: number, max: number): void {
    // Calculate appropriate step based on range
    const range = max - min;
    let step = 1;
    if (range <= 1) {
      step = 0.01;
    } else if (range <= 10) {
      step = 0.1;
    } else if (range <= 100) {
      step = 1;
    } else if (range <= 1000) {
      step = 10;
    } else {
      step = 100;
    }

    // Use computed bounds if available, otherwise compute from percentile
    let initialMin: number;
    let initialMax: number;

    if (this._computedBounds) {
      initialMin = this._computedBounds.min;
      initialMax = this._computedBounds.max;
    } else {
      initialMin = min + (range * this._currentColorRangeConfig.percentileLow) / 100;
      initialMax = min + (range * this._currentColorRangeConfig.percentileHigh) / 100;
    }

    if (this._absoluteMinSlider) {
      this._absoluteMinSlider.min = String(min);
      this._absoluteMinSlider.max = String(max);
      this._absoluteMinSlider.step = String(step);
      this._absoluteMinSlider.value = String(initialMin);
    }
    if (this._absoluteMaxSlider) {
      this._absoluteMaxSlider.min = String(min);
      this._absoluteMaxSlider.max = String(max);
      this._absoluteMaxSlider.step = String(step);
      this._absoluteMaxSlider.value = String(initialMax);
    }
    if (this._absoluteRangeValue) {
      this._absoluteRangeValue.textContent = `${this._formatValue(initialMin)} - ${this._formatValue(initialMax)}`;
    }

    this._updateAbsoluteTrackFill();

    // Update config with computed values
    this._currentColorRangeConfig.absoluteMin = initialMin;
    this._currentColorRangeConfig.absoluteMax = initialMax;
  }

  /**
   * Updates the absolute slider range label based on current slider values.
   */
  private _updateAbsoluteRangeLabel(): void {
    if (!this._absoluteRangeValue) return;

    const minVal = this._currentColorRangeConfig.absoluteMin ?? this._dataBounds.min;
    const maxVal = this._currentColorRangeConfig.absoluteMax ?? this._dataBounds.max;
    this._absoluteRangeValue.textContent = `${this._formatValue(minVal)} - ${this._formatValue(maxVal)}`;
  }

  /**
   * Updates the colorbar min/max labels based on current config.
   */
  private _updateColorbarLabels(): void {
    let minVal: number;
    let maxVal: number;

    if (this._currentColorRangeConfig.mode === 'percentile') {
      // In percentile mode, use computed bounds if available, otherwise approximate
      if (this._computedBounds) {
        minVal = this._computedBounds.min;
        maxVal = this._computedBounds.max;
      } else {
        const range = this._dataBounds.max - this._dataBounds.min;
        minVal = this._dataBounds.min + (range * this._currentColorRangeConfig.percentileLow) / 100;
        maxVal = this._dataBounds.min + (range * this._currentColorRangeConfig.percentileHigh) / 100;
      }
    } else {
      // In absolute mode, use the slider values
      minVal = this._currentColorRangeConfig.absoluteMin ?? this._dataBounds.min;
      maxVal = this._currentColorRangeConfig.absoluteMax ?? this._dataBounds.max;
    }

    if (this._colorbarMinLabel) {
      this._colorbarMinLabel.textContent = this._formatValue(minVal);
    }
    if (this._colorbarMaxLabel) {
      this._colorbarMaxLabel.textContent = this._formatValue(maxVal);
    }
  }

  /**
   * Formats a value for display based on the data range (not the value itself).
   * This matches the maplibre-gl-lidar behavior.
   */
  private _formatValue(value: number): string {
    const range = this._dataBounds.max - this._dataBounds.min;
    if (range <= 1) {
      return value.toFixed(2); // For intensity (0-1), show 2 decimal places
    } else if (range <= 10) {
      return value.toFixed(1);
    } else if (range <= 100) {
      return value.toFixed(1);
    } else {
      return value.toFixed(0);
    }
  }

  /**
   * Updates the colorbar canvas with the current colormap gradient.
   */
  private _updateColorbar(): void {
    if (!this._colorbarCanvas) return;

    const ctx = this._colorbarCanvas.getContext('2d');
    if (!ctx) return;

    const width = this._colorbarCanvas.width;
    const height = this._colorbarCanvas.height;

    // Get colormap (array of RGB colors)
    const colorRamp = getColormap(this._currentColormap);

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0);

    // Add color stops from the color ramp
    const numColors = colorRamp.length;
    for (let i = 0; i < numColors; i++) {
      const t = i / (numColors - 1);
      const color = colorRamp[i];
      gradient.addColorStop(t, `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
    }

    // Draw gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Handles color range mode change (percentile/absolute toggle).
   */
  private _onColorRangeModeChange(): void {
    const isPercentile = this._colorRangeModePercentile?.checked ?? true;

    // Show/hide appropriate slider container
    if (this._percentileSliderContainer) {
      this._percentileSliderContainer.style.display = isPercentile ? 'flex' : 'none';
    }
    if (this._absoluteSliderContainer) {
      this._absoluteSliderContainer.style.display = isPercentile ? 'none' : 'flex';
    }

    // Sync values when switching modes
    if (!isPercentile) {
      // Switching from percentile to absolute
      let computedMin: number;
      let computedMax: number;

      // Use actual computed bounds if available (from the library's percentile calculation)
      if (this._computedBounds) {
        computedMin = this._computedBounds.min;
        computedMax = this._computedBounds.max;
      } else {
        // Fall back to linear interpolation
        const range = this._dataBounds.max - this._dataBounds.min;
        computedMin =
          this._dataBounds.min + (range * this._currentColorRangeConfig.percentileLow) / 100;
        computedMax =
          this._dataBounds.min + (range * this._currentColorRangeConfig.percentileHigh) / 100;
      }

      // Update absolute slider values
      if (this._absoluteMinSlider) {
        this._absoluteMinSlider.value = String(computedMin);
      }
      if (this._absoluteMaxSlider) {
        this._absoluteMaxSlider.value = String(computedMax);
      }
      this._updateAbsoluteTrackFill();

      // Update config with computed values
      this._currentColorRangeConfig.absoluteMin = computedMin;
      this._currentColorRangeConfig.absoluteMax = computedMax;

      // Update the slider range label
      this._updateAbsoluteRangeLabel();
    }
    // When switching from absolute to percentile, keep the existing percentile values
    // (don't recompute from absolute - just restore the previous percentile settings)

    // Update config mode
    this._currentColorRangeConfig.mode = isPercentile ? 'percentile' : 'absolute';

    // Update colorbar labels
    this._updateColorbarLabels();

    this._emitColorRangeChange();
  }

  /**
   * Handles percentile slider input changes.
   */
  private _onPercentileSliderChange(): void {
    if (!this._percentileLowSlider || !this._percentileHighSlider) return;

    let low = parseFloat(this._percentileLowSlider.value);
    let high = parseFloat(this._percentileHighSlider.value);

    // Ensure min doesn't exceed max
    if (low > high) {
      low = high;
      this._percentileLowSlider.value = String(low);
    }
    // Ensure max doesn't go below min
    if (high < low) {
      high = low;
      this._percentileHighSlider.value = String(high);
    }

    // Update display
    if (this._percentileRangeValue) {
      this._percentileRangeValue.textContent = `${Math.round(low)}% - ${Math.round(high)}%`;
    }

    this._updatePercentileTrackFill();

    // Update config
    this._currentColorRangeConfig.percentileLow = low;
    this._currentColorRangeConfig.percentileHigh = high;

    // Update colorbar labels
    this._updateColorbarLabels();

    this._emitColorRangeChange();
  }

  /**
   * Handles absolute slider input changes.
   */
  private _onAbsoluteSliderChange(): void {
    if (!this._absoluteMinSlider || !this._absoluteMaxSlider) return;

    let min = parseFloat(this._absoluteMinSlider.value);
    let max = parseFloat(this._absoluteMaxSlider.value);

    // Ensure min doesn't exceed max
    if (min > max) {
      min = max;
      this._absoluteMinSlider.value = String(min);
    }
    // Ensure max doesn't go below min
    if (max < min) {
      max = min;
      this._absoluteMaxSlider.value = String(max);
    }

    // Update display
    if (this._absoluteRangeValue) {
      this._absoluteRangeValue.textContent = `${this._formatValue(min)} - ${this._formatValue(max)}`;
    }

    this._updateAbsoluteTrackFill();

    // Update config
    this._currentColorRangeConfig.absoluteMin = min;
    this._currentColorRangeConfig.absoluteMax = max;

    // Update colorbar labels
    this._updateColorbarLabels();

    this._emitColorRangeChange();
  }

  /**
   * Updates the percentile slider track fill position.
   */
  private _updatePercentileTrackFill(): void {
    if (!this._percentileLowSlider || !this._percentileHighSlider || !this._percentileTrackFill)
      return;

    const min = 0;
    const max = 100;
    const low = parseFloat(this._percentileLowSlider.value);
    const high = parseFloat(this._percentileHighSlider.value);

    const leftPercent = ((low - min) / (max - min)) * 100;
    const rightPercent = ((max - high) / (max - min)) * 100;

    this._percentileTrackFill.style.left = `${leftPercent}%`;
    this._percentileTrackFill.style.right = `${rightPercent}%`;
  }

  /**
   * Updates the absolute slider track fill position.
   */
  private _updateAbsoluteTrackFill(): void {
    if (!this._absoluteMinSlider || !this._absoluteMaxSlider || !this._absoluteTrackFill) return;

    const min = parseFloat(this._absoluteMinSlider.min);
    const max = parseFloat(this._absoluteMinSlider.max);
    const lowVal = parseFloat(this._absoluteMinSlider.value);
    const highVal = parseFloat(this._absoluteMaxSlider.value);

    const range = max - min;
    if (range <= 0) return;

    const leftPercent = ((lowVal - min) / range) * 100;
    const rightPercent = ((max - highVal) / range) * 100;

    this._absoluteTrackFill.style.left = `${leftPercent}%`;
    this._absoluteTrackFill.style.right = `${rightPercent}%`;
  }

  /**
   * Emits the current color range configuration.
   */
  private _emitColorRangeChange(): void {
    this._callbacks.onColorRangeChange({ ...this._currentColorRangeConfig });
  }

  /**
   * Resets color range to default percentile 2-98%.
   */
  private _resetColorRange(): void {
    // Reset to percentile mode
    if (this._colorRangeModePercentile) {
      this._colorRangeModePercentile.checked = true;
    }
    if (this._colorRangeModeAbsolute) {
      this._colorRangeModeAbsolute.checked = false;
    }

    // Show percentile slider, hide absolute
    if (this._percentileSliderContainer) {
      this._percentileSliderContainer.style.display = 'flex';
    }
    if (this._absoluteSliderContainer) {
      this._absoluteSliderContainer.style.display = 'none';
    }

    // Reset percentile values
    if (this._percentileLowSlider) {
      this._percentileLowSlider.value = '2';
    }
    if (this._percentileHighSlider) {
      this._percentileHighSlider.value = '98';
    }
    if (this._percentileRangeValue) {
      this._percentileRangeValue.textContent = '2% - 98%';
    }

    // Update track fill
    this._updatePercentileTrackFill();

    // Reset config
    this._currentColorRangeConfig = {
      mode: 'percentile',
      percentileLow: 2,
      percentileHigh: 98,
    };

    this._emitColorRangeChange();
  }

  /**
   * Sets the colormap dropdown value.
   *
   * @param colormap - Colormap name
   */
  setColormap(colormap: ColormapName): void {
    this._currentColormap = colormap;
    if (this._colormapSelect) {
      this._colormapSelect.value = colormap;
    }
    this._updateColorbar();
  }

  /**
   * Sets the color range configuration.
   *
   * @param config - Color range config
   */
  setColorRangeConfig(config: ColorRangeConfig): void {
    this._currentColorRangeConfig = { ...config };

    // Update mode toggle
    if (this._colorRangeModePercentile) {
      this._colorRangeModePercentile.checked = config.mode === 'percentile';
    }
    if (this._colorRangeModeAbsolute) {
      this._colorRangeModeAbsolute.checked = config.mode === 'absolute';
    }

    // Show/hide slider containers
    if (this._percentileSliderContainer) {
      this._percentileSliderContainer.style.display = config.mode === 'percentile' ? 'flex' : 'none';
    }
    if (this._absoluteSliderContainer) {
      this._absoluteSliderContainer.style.display = config.mode === 'absolute' ? 'flex' : 'none';
    }

    // Update percentile sliders
    if (this._percentileLowSlider) {
      this._percentileLowSlider.value = String(config.percentileLow);
    }
    if (this._percentileHighSlider) {
      this._percentileHighSlider.value = String(config.percentileHigh);
    }
    if (this._percentileRangeValue) {
      this._percentileRangeValue.textContent = `${Math.round(config.percentileLow)}% - ${Math.round(config.percentileHigh)}%`;
    }
    this._updatePercentileTrackFill();

    // Update absolute sliders if values are provided
    if (config.absoluteMin !== undefined && config.absoluteMax !== undefined) {
      if (this._absoluteMinSlider) {
        this._absoluteMinSlider.value = String(config.absoluteMin);
      }
      if (this._absoluteMaxSlider) {
        this._absoluteMaxSlider.value = String(config.absoluteMax);
      }
      this._updateAbsoluteTrackFill();
      this._updateAbsoluteRangeLabel();
    }
  }
}
