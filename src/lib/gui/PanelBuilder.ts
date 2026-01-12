import type { StacItem, UsgsLidarState } from '../core/types';
import { formatPointCount, getItemShortName, formatBbox, getItemMetadata } from '../utils';

/**
 * Callbacks for panel interactions
 */
export interface PanelCallbacks {
  onSearchByExtent: () => void;
  onStartDrawing: () => void;
  onStopDrawing: () => void;
  onSearchByDrawn: () => void;
  onClearDrawn: () => void;
  onItemSelect: (item: StacItem) => void;
  onItemLoad: (item: StacItem) => void;
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
      meta.textContent = getItemMetadata(item);
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
          zOffsetValue.textContent = `${lidarState.zOffset}m`;
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

    // Sync color scheme dropdown
    const colorSelect = document.getElementById('usgs-lidar-color-select') as HTMLSelectElement;
    if (colorSelect && lidarState.colorScheme !== undefined) {
      // colorScheme can be a string or an object - only sync if it's a simple string type
      const scheme = typeof lidarState.colorScheme === 'string' ? lidarState.colorScheme : null;
      if (scheme && colorSelect.value !== scheme) {
        colorSelect.value = scheme;
      }
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
      option.textContent = scheme.charAt(0).toUpperCase() + scheme.slice(1);
      colorSelect.appendChild(option);
    });
    colorSelect.addEventListener('change', () => {
      this._callbacks.onColorSchemeChange(colorSelect.value);
    });
    colorRow.appendChild(colorSelect);

    content.appendChild(colorRow);

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

    // Z Offset slider (to adjust for absolute elevation)
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
      zOffsetValue.textContent = `${offset}m`;
    });
    zOffsetRow.appendChild(zOffsetSlider);

    const zOffsetValue = document.createElement('span');
    zOffsetValue.className = 'usgs-lidar-slider-value usgs-lidar-slider-value-wide';
    zOffsetValue.id = 'usgs-lidar-zoffset-value';
    zOffsetValue.textContent = '0m';
    zOffsetRow.appendChild(zOffsetValue);

    content.appendChild(zOffsetRow);

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
  }
}
