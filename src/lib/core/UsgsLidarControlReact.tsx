import { useEffect, useRef } from 'react';
import type { UsgsLidarControlReactProps } from './types';
import { UsgsLidarControl } from './UsgsLidarControl';

/**
 * React wrapper component for UsgsLidarControl.
 *
 * @example
 * ```tsx
 * function MyMap() {
 *   const [map, setMap] = useState<Map | null>(null);
 *
 *   return (
 *     <div>
 *       <Map onLoad={setMap} />
 *       {map && (
 *         <UsgsLidarControlReact
 *           map={map}
 *           title="USGS LiDAR"
 *           onSearchComplete={(items) => console.log('Found:', items.length)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function UsgsLidarControlReact({
  map,
  onStateChange,
  onSearchComplete,
  onItemLoad,
  onError,
  onControlReady,
  ...options
}: UsgsLidarControlReactProps): null {
  const controlRef = useRef<UsgsLidarControl | null>(null);
  const addedRef = useRef(false);

  useEffect(() => {
    if (!map || addedRef.current) return;

    // Create and add control
    const control = new UsgsLidarControl(options);
    controlRef.current = control;

    // Set up event listeners
    if (onStateChange) {
      control.on('statechange', (event) => {
        onStateChange(event.state);
      });
    }

    if (onSearchComplete) {
      control.on('searchcomplete', (event) => {
        if (event.items) {
          onSearchComplete(event.items);
        }
      });
    }

    if (onItemLoad) {
      control.on('loadcomplete', (event) => {
        if (event.pointCloud) {
          onItemLoad(event.pointCloud);
        }
      });
    }

    if (onError) {
      control.on('searcherror', (event) => {
        if (event.error) {
          onError(event.error);
        }
      });
      control.on('loaderror', (event) => {
        if (event.error) {
          onError(event.error);
        }
      });
    }

    // Add control to map
    map.addControl(control, options.position ?? 'top-right');
    addedRef.current = true;

    // Notify when ready
    if (onControlReady) {
      onControlReady(control);
    }

    return () => {
      if (controlRef.current && map) {
        try {
          map.removeControl(controlRef.current);
        } catch {
          // Control may already be removed
        }
      }
      controlRef.current = null;
      addedRef.current = false;
    };
  }, [map]);

  // Handle option changes
  useEffect(() => {
    if (controlRef.current && options.collapsed !== undefined) {
      if (options.collapsed) {
        controlRef.current.collapse();
      } else {
        controlRef.current.expand();
      }
    }
  }, [options.collapsed]);

  // This component renders nothing - it's just a controller
  return null;
}
