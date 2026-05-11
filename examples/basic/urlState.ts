import type { Map as MapLibreMap } from 'maplibre-gl';
import type { UsgsLidarControl, DataSourceType, UnifiedSearchItem } from '../../src/index';

export interface HashState {
  lon?: number;
  lat?: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  source?: DataSourceType;
  id?: string;
  ptSize?: number;
  opacity?: number;
  color?: string;
  cmap?: string;
  zoff?: number;
}

const round = (n: number, dp: number): number => {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export function parseHash(hash: string): HashState {
  const state: HashState = {};
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmed) return state;

  for (const part of trimmed.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    if (!value) continue;

    switch (key) {
      case 'lon': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.lon = n;
        break;
      }
      case 'lat': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.lat = n;
        break;
      }
      case 'zoom': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.zoom = n;
        break;
      }
      case 'pitch': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.pitch = n;
        break;
      }
      case 'bearing': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.bearing = n;
        break;
      }
      case 'source':
        if (value === 'copc' || value === 'ept') state.source = value;
        break;
      case 'id':
        state.id = value;
        break;
      case 'ptSize': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.ptSize = n;
        break;
      }
      case 'opacity': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.opacity = n;
        break;
      }
      case 'color':
        state.color = value;
        break;
      case 'cmap':
        state.cmap = value;
        break;
      case 'zoff': {
        const n = parseFloat(value);
        if (isFiniteNumber(n)) state.zoff = n;
        break;
      }
    }
  }
  return state;
}

export function buildHash(
  map: MapLibreMap,
  control: UsgsLidarControl,
  lastLoadedId: string | null
): string {
  const center = map.getCenter();
  const parts: string[] = [
    `lon=${round(center.lng, 6)}`,
    `lat=${round(center.lat, 6)}`,
    `zoom=${round(map.getZoom(), 2)}`,
    `pitch=${round(map.getPitch(), 1)}`,
    `bearing=${round(map.getBearing(), 1)}`,
    `source=${control.getDataSource()}`,
  ];

  if (lastLoadedId) {
    parts.push(`id=${encodeURIComponent(lastLoadedId)}`);
  }

  const lidarState = control.getState().lidarState as
    | {
        pointSize?: number;
        opacity?: number;
        colorScheme?: unknown;
        colormap?: string;
        zOffset?: number;
      }
    | null;

  if (lidarState) {
    if (isFiniteNumber(lidarState.pointSize)) {
      parts.push(`ptSize=${round(lidarState.pointSize, 1)}`);
    }
    if (isFiniteNumber(lidarState.opacity)) {
      parts.push(`opacity=${round(lidarState.opacity, 2)}`);
    }
    if (typeof lidarState.colorScheme === 'string') {
      parts.push(`color=${encodeURIComponent(lidarState.colorScheme)}`);
    }
    if (typeof lidarState.colormap === 'string') {
      parts.push(`cmap=${encodeURIComponent(lidarState.colormap)}`);
    }
    if (isFiniteNumber(lidarState.zOffset)) {
      parts.push(`zoff=${round(lidarState.zOffset, 1)}`);
    }
  }

  return '#' + parts.join('&');
}

export function buildShareUrl(
  map: MapLibreMap,
  control: UsgsLidarControl,
  lastLoadedId: string | null
): string {
  return window.location.origin + window.location.pathname + buildHash(map, control, lastLoadedId);
}

/**
 * Applies a parsed hash state on page load: jumps the camera, sets the data
 * source, runs a search, auto-loads the item matching `id`, and applies viz
 * params. Logs warnings on missing or invalid pieces; never throws.
 */
export async function applyHashState(
  map: MapLibreMap,
  control: UsgsLidarControl,
  state: HashState
): Promise<void> {
  // Camera
  const hasLon = isFiniteNumber(state.lon);
  const hasLat = isFiniteNumber(state.lat);
  if (hasLon && hasLat) {
    map.jumpTo({
      center: [state.lon as number, state.lat as number],
      zoom: isFiniteNumber(state.zoom) ? state.zoom : map.getZoom(),
      pitch: isFiniteNumber(state.pitch) ? state.pitch : map.getPitch(),
      bearing: isFiniteNumber(state.bearing) ? state.bearing : map.getBearing(),
    });
  }

  // Data source
  if (state.source) {
    control.setDataSource(state.source);
  }

  // Auto-load by id
  if (state.id) {
    await new Promise<void>((resolve) => {
      const ready = () => map.once('idle', () => resolve());
      if (map.loaded()) ready();
      else map.once('load', ready);
    });

    try {
      const results: UnifiedSearchItem[] = await control.searchByExtent();
      const match = results.find((item) => item.id === state.id);
      if (!match) {
        console.warn(
          `[share-url] No dataset with id="${state.id}" in the current search results.`
        );
      } else {
        await control.loadItem(match);
      }
    } catch (err) {
      console.warn('[share-url] Search/load failed while restoring state:', err);
    }
  }

  // Viz params (apply after load so the underlying lidar control has a point cloud)
  if (isFiniteNumber(state.ptSize)) control.setPointSize(state.ptSize);
  if (isFiniteNumber(state.opacity)) control.setOpacity(state.opacity);
  if (state.color) {
    // ColorScheme is typed broadly upstream; cast at the boundary.
    control.setColorScheme(state.color as Parameters<UsgsLidarControl['setColorScheme']>[0]);
  }
  if (state.cmap) {
    control.setColormap(state.cmap as Parameters<UsgsLidarControl['setColormap']>[0]);
  }
  if (isFiniteNumber(state.zoff)) control.setZOffset(state.zoff);
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

/**
 * Adds a "Share URL" button to the bottom of the control's panel.
 *
 * Clicking the button builds a share URL from the current map and control
 * state and copies it to the clipboard. A short confirmation message is
 * shown next to the button.
 */
export function addShareButton(
  control: UsgsLidarControl,
  map: MapLibreMap,
  getLastLoadedId: () => string | null
): void {
  const panel = control.getPanelElement();
  if (!panel) {
    console.warn('[share-url] Panel element not available; share button skipped.');
    return;
  }

  // Avoid duplicate injection
  if (panel.querySelector('.usgs-lidar-share-row')) return;

  const row = document.createElement('div');
  row.className = 'usgs-lidar-section usgs-lidar-share-row';
  row.style.padding = '8px 12px';
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';

  const btn = document.createElement('button');
  btn.className = 'usgs-lidar-btn usgs-lidar-btn-primary';
  btn.type = 'button';
  btn.id = 'usgs-lidar-share-btn';
  btn.textContent = 'Share URL';
  btn.title = 'Copy a shareable URL with the current map view and dataset';

  const status = document.createElement('span');
  status.className = 'usgs-lidar-share-status';
  status.style.fontSize = '12px';
  status.style.color = '#16a34a';
  status.style.opacity = '0';
  status.style.transition = 'opacity 0.2s ease';
  status.setAttribute('aria-live', 'polite');

  let resetTimer: number | null = null;
  const showStatus = (text: string, isError = false) => {
    status.textContent = text;
    status.style.color = isError ? '#dc2626' : '#16a34a';
    status.style.opacity = '1';
    if (resetTimer !== null) window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      status.style.opacity = '0';
    }, 2500);
  };

  btn.addEventListener('click', async () => {
    const url = buildShareUrl(map, control, getLastLoadedId());
    // Reflect in the address bar so the user can also copy from there if they want.
    history.replaceState(null, '', url);
    try {
      await copyToClipboard(url);
      showStatus('Copied!');
    } catch (err) {
      console.error('[share-url] Clipboard copy failed:', err);
      showStatus('Copy failed', true);
    }
  });

  row.appendChild(btn);
  row.appendChild(status);
  panel.appendChild(row);
}
