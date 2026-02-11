import { useState, useCallback } from 'react';
import type { UsgsLidarState, UnifiedSearchItem, DataSourceType } from '../core/types';

/**
 * Initial state for the USGS LiDAR control
 */
const createInitialState = (options?: Partial<UsgsLidarState>): UsgsLidarState => ({
  collapsed: true,
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
  ...options,
});

/**
 * Custom hook for managing USGS LiDAR control state in React applications.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     state,
 *     toggle,
 *     setSearchResults,
 *     selectItem,
 *     deselectItem,
 *   } = useUsgsLidarState({ collapsed: false });
 *
 *   return (
 *     <div>
 *       <button onClick={toggle}>
 *         {state.collapsed ? 'Expand' : 'Collapse'}
 *       </button>
 *       <p>Results: {state.searchResults.length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUsgsLidarState(initialOptions?: Partial<UsgsLidarState>) {
  const [state, setState] = useState<UsgsLidarState>(() =>
    createInitialState(initialOptions)
  );

  /**
   * Toggles the collapsed state
   */
  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  /**
   * Expands the panel
   */
  const expand = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: false }));
  }, []);

  /**
   * Collapses the panel
   */
  const collapse = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: true }));
  }, []);

  /**
   * Sets search results
   */
  const setSearchResults = useCallback((results: UnifiedSearchItem[], totalMatched?: number) => {
    setState((prev) => ({
      ...prev,
      searchResults: results,
      totalMatched: totalMatched ?? results.length,
      selectedItems: new Set(),
      isSearching: false,
    }));
  }, []);

  /**
   * Selects an item
   */
  const selectItem = useCallback((item: UnifiedSearchItem) => {
    setState((prev) => {
      const newSelected = new Set(prev.selectedItems);
      newSelected.add(item.id);
      return { ...prev, selectedItems: newSelected };
    });
  }, []);

  /**
   * Deselects an item
   */
  const deselectItem = useCallback((item: UnifiedSearchItem) => {
    setState((prev) => {
      const newSelected = new Set(prev.selectedItems);
      newSelected.delete(item.id);
      return { ...prev, selectedItems: newSelected };
    });
  }, []);

  /**
   * Toggles item selection
   */
  const toggleItemSelection = useCallback((item: UnifiedSearchItem) => {
    setState((prev) => {
      const newSelected = new Set(prev.selectedItems);
      if (newSelected.has(item.id)) {
        newSelected.delete(item.id);
      } else {
        newSelected.add(item.id);
      }
      return { ...prev, selectedItems: newSelected };
    });
  }, []);

  /**
   * Sets the data source
   */
  const setDataSource = useCallback((source: DataSourceType) => {
    setState((prev) => ({
      ...prev,
      dataSource: source,
      searchResults: [],
      selectedItems: new Set(),
      totalMatched: null,
    }));
  }, []);

  /**
   * Clears all selections
   */
  const clearSelection = useCallback(() => {
    setState((prev) => ({ ...prev, selectedItems: new Set() }));
  }, []);

  /**
   * Sets the drawn bounding box
   */
  const setDrawnBbox = useCallback((bbox: [number, number, number, number] | null) => {
    setState((prev) => ({ ...prev, drawnBbox: bbox }));
  }, []);

  /**
   * Sets the searching state
   */
  const setSearching = useCallback((isSearching: boolean) => {
    setState((prev) => ({ ...prev, isSearching }));
  }, []);

  /**
   * Sets a search error
   */
  const setSearchError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, searchError: error, isSearching: false }));
  }, []);

  /**
   * Clears search results
   */
  const clearResults = useCallback(() => {
    setState((prev) => ({
      ...prev,
      searchResults: [],
      selectedItems: new Set(),
      totalMatched: null,
    }));
  }, []);

  /**
   * Resets to initial state
   */
  const reset = useCallback(() => {
    setState(createInitialState(initialOptions));
  }, [initialOptions]);

  return {
    state,
    setState,
    toggle,
    expand,
    collapse,
    setSearchResults,
    selectItem,
    deselectItem,
    toggleItemSelection,
    clearSelection,
    setDrawnBbox,
    setSearching,
    setSearchError,
    clearResults,
    setDataSource,
    reset,
  };
}
