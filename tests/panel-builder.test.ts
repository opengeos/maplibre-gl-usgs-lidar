import { describe, it, expect, beforeEach } from 'vitest';
import { PanelBuilder, type PanelCallbacks } from '../src/lib/gui/PanelBuilder';
import type { UsgsLidarState } from '../src/lib/core/types';

// Every callback is a no-op for these DOM tests; a Proxy returns a fresh
// function for any property so we don't have to enumerate PanelCallbacks.
const noopCallbacks = new Proxy({}, { get: () => () => {} }) as unknown as PanelCallbacks;

const baseState = (overrides: Partial<UsgsLidarState> = {}): UsgsLidarState => ({
  collapsed: false,
  panelWidth: 380,
  maxHeight: 500,
  dataSource: 'ept',
  searchMode: 'none',
  isDrawing: false,
  drawnBbox: null,
  searchResults: [],
  selectedItems: new Set(),
  isSearching: false,
  searchError: null,
  totalMatched: null,
  loadedItems: new Map(),
  lidarState: null,
  ...overrides,
});

describe('PanelBuilder labels and Search Map Extent state', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses distinct, scope-specific labels for the three reset actions', () => {
    const panel = new PanelBuilder(noopCallbacks, baseState());
    // Build the relevant sections in isolation (the visualization section uses
    // a <canvas>, which jsdom does not implement) and mount them so the
    // document-scoped lookups below resolve.
    const search = (panel as unknown as { _buildSearchSection(): HTMLElement })._buildSearchSection();
    const results = (panel as unknown as { _buildResultsSection(): HTMLElement })._buildResultsSection();
    const loaded = (panel as unknown as { _buildLoadedSection(): HTMLElement })._buildLoadedSection();
    document.body.append(search, results, loaded);

    // Drawn-area reset (danger button in the drawn-area actions row).
    expect(search.querySelector('.usgs-lidar-btn-danger')?.textContent).toBe('Clear Drawn Area');
    // Results selection reset.
    const resultsClear = results.querySelector('#usgs-lidar-results-actions .usgs-lidar-btn-secondary');
    expect(resultsClear?.textContent).toBe('Clear Selection');
    // Loaded-layers global reset.
    expect(loaded.querySelector('.usgs-lidar-btn-full')?.textContent).toBe('Remove All Loaded Layers');
    // The three labels must all differ.
    const labels = ['Clear Drawn Area', 'Clear Selection', 'Remove All Loaded Layers'];
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('disables Search Map Extent only while a drawn bounding box is active', () => {
    const panel = new PanelBuilder(noopCallbacks, baseState());
    const internals = panel as unknown as {
      _buildSearchSection(): HTMLElement;
      _searchSection: HTMLElement;
    };
    const search = internals._buildSearchSection();
    // build() normally assigns this; set it so updateState() runs the search
    // section update path.
    internals._searchSection = search;
    document.body.appendChild(search);

    const extentBtn = document.getElementById('usgs-lidar-extent-btn') as HTMLButtonElement;
    expect(extentBtn).not.toBeNull();
    expect(extentBtn.textContent).toBe('Search Map Extent');
    // No drawn area initially: enabled.
    expect(extentBtn.disabled).toBe(false);

    // Drawing a box disables it (so the two search scopes can't both fire).
    panel.updateState(baseState({ drawnBbox: [-117.71, 37.37, -113.13, 46.61] }));
    expect(extentBtn.disabled).toBe(true);
    expect(extentBtn.title).toBe('Clear the drawn area to search by map extent');

    // Clearing the box re-enables it automatically.
    panel.updateState(baseState({ drawnBbox: null }));
    expect(extentBtn.disabled).toBe(false);
    expect(extentBtn.title).toBe('');
  });
});
