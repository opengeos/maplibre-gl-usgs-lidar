import type { CustomLayerAdapter, LayerState } from 'maplibre-gl-layer-control';
import type { UsgsLidarControl } from '../core/UsgsLidarControl';

/**
 * Adapter for integrating USGS LiDAR point cloud layers with maplibre-gl-layer-control.
 *
 * This adapter allows USGS LiDAR point clouds to appear in the layer control panel,
 * enabling visibility toggles and opacity sliders for each loaded point cloud.
 *
 * @example
 * ```typescript
 * import { UsgsLidarControl, UsgsLidarLayerAdapter } from 'maplibre-gl-usgs-lidar';
 * import { LayerControl } from 'maplibre-gl-layer-control';
 *
 * const usgsControl = new UsgsLidarControl({ ... });
 * map.addControl(usgsControl, 'top-right');
 *
 * // Create adapter after adding USGS control
 * const usgsAdapter = new UsgsLidarLayerAdapter(usgsControl);
 *
 * // Add layer control with the adapter
 * const layerControl = new LayerControl({
 *   customLayerAdapters: [usgsAdapter],
 * });
 * map.addControl(layerControl, 'top-left');
 * ```
 */
export class UsgsLidarLayerAdapter implements CustomLayerAdapter {
  readonly type = 'usgs-lidar';

  private _usgsControl: UsgsLidarControl;
  private _changeCallbacks: Array<(event: 'add' | 'remove', layerId: string) => void> = [];
  private _unsubscribe?: () => void;

  /**
   * Creates a new UsgsLidarLayerAdapter.
   *
   * @param usgsControl - The UsgsLidarControl instance to adapt
   */
  constructor(usgsControl: UsgsLidarControl) {
    this._usgsControl = usgsControl;
    this._setupEventListeners();
  }

  /**
   * Sets up event listeners on the UsgsLidarControl to detect layer changes.
   */
  private _setupEventListeners(): void {
    // Listen for load and unload events
    const handleLoad = (event: { pointCloud?: { id: string } }) => {
      if (event.pointCloud?.id) {
        // Find the item ID from the loaded items map
        const state = this._usgsControl.getState();
        for (const [itemId, info] of state.loadedItems.entries()) {
          if (info.id === event.pointCloud.id) {
            this._notifyLayerAdded(itemId);
            break;
          }
        }
      }
    };

    const handleUnload = (event: { itemId?: string }) => {
      if (event.itemId) {
        this._notifyLayerRemoved(event.itemId);
      }
    };

    this._usgsControl.on('loadcomplete', handleLoad as any);
    this._usgsControl.on('unload', handleUnload as any);

    this._unsubscribe = () => {
      this._usgsControl.off('loadcomplete', handleLoad as any);
      this._usgsControl.off('unload', handleUnload as any);
    };
  }

  /**
   * Gets all layer IDs managed by this adapter.
   *
   * @returns Array of item IDs for loaded point clouds
   */
  getLayerIds(): string[] {
    const state = this._usgsControl.getState();
    return Array.from(state.loadedItems.keys());
  }

  /**
   * Gets the current state of a layer.
   *
   * @param layerId - Item ID
   * @returns LayerState or null if not found
   */
  getLayerState(layerId: string): LayerState | null {
    const state = this._usgsControl.getState();
    const info = state.loadedItems.get(layerId);
    if (!info) return null;

    // Access the LiDAR control's point cloud manager through internal state
    const lidarControl = this._usgsControl.getLidarControl();
    const manager = (lidarControl as any)?._pointCloudManager;

    const visible = manager?.getPointCloudVisibility(info.id) ?? true;
    const opacity = manager?.getPointCloudOpacity(info.id) ?? (state.lidarState?.opacity ?? 1);

    return {
      visible,
      opacity,
      name: this.getName(layerId),
      isCustomLayer: true,
      customLayerType: 'usgs-lidar',
    };
  }

  /**
   * Sets layer visibility.
   *
   * @param layerId - Item ID
   * @param visible - Whether the layer should be visible
   */
  setVisibility(layerId: string, visible: boolean): void {
    const state = this._usgsControl.getState();
    const info = state.loadedItems.get(layerId);
    if (!info) return;

    const lidarControl = this._usgsControl.getLidarControl();
    const manager = (lidarControl as any)?._pointCloudManager;
    manager?.setPointCloudVisibility(info.id, visible);
  }

  /**
   * Sets layer opacity.
   *
   * @param layerId - Item ID
   * @param opacity - Opacity value (0-1)
   */
  setOpacity(layerId: string, opacity: number): void {
    const state = this._usgsControl.getState();
    const info = state.loadedItems.get(layerId);
    if (!info) return;

    const lidarControl = this._usgsControl.getLidarControl();
    const manager = (lidarControl as any)?._pointCloudManager;
    manager?.setPointCloudOpacity(info.id, opacity);
  }

  /**
   * Gets display name for a layer.
   *
   * @param layerId - Item ID
   * @returns Display name for the layer
   */
  getName(layerId: string): string {
    const state = this._usgsControl.getState();
    const info = state.loadedItems.get(layerId);
    if (info) {
      return info.name;
    }
    // Generate friendly name from ID
    return layerId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Gets layer symbol type for UI display.
   *
   * @param _layerId - Item ID (unused)
   * @returns Symbol type string
   */
  getSymbolType(_layerId: string): string {
    // Use 'circle' symbol for point clouds
    return 'circle';
  }

  /**
   * Subscribes to layer changes (add/remove).
   *
   * @param callback - Function to call when layers are added or removed
   * @returns Unsubscribe function
   */
  onLayerChange(callback: (event: 'add' | 'remove', layerId: string) => void): () => void {
    this._changeCallbacks.push(callback);
    return () => {
      const idx = this._changeCallbacks.indexOf(callback);
      if (idx >= 0) this._changeCallbacks.splice(idx, 1);
    };
  }

  /**
   * Notifies subscribers that a layer was added.
   *
   * @param layerId - ID of the added layer
   */
  private _notifyLayerAdded(layerId: string): void {
    this._changeCallbacks.forEach((cb) => cb('add', layerId));
  }

  /**
   * Notifies subscribers that a layer was removed.
   *
   * @param layerId - ID of the removed layer
   */
  private _notifyLayerRemoved(layerId: string): void {
    this._changeCallbacks.forEach((cb) => cb('remove', layerId));
  }

  /**
   * Cleans up event listeners.
   */
  destroy(): void {
    this._unsubscribe?.();
    this._changeCallbacks = [];
  }
}
