// Access to the free OpenStreetMap services (Nominatim geocoding, OSRM routing).
// Both are shared, donation-run servers with strict usage policies:
//   - Nominatim: at most 1 request per second, cache results.
//   - OSRM demo server: light use only, cache results.
// Every call goes through here so results are cached and Nominatim is throttled.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const MAX_CACHE_ENTRIES = 200;

export interface Place {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

export interface OsrmRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: { coordinates: [number, number][] }; // [lon, lat]
}

class BoundedCache<V> {
  private map = new Map<string, V>();
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Refresh recency
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > MAX_CACHE_ENTRIES) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
  clear(): void { this.map.clear(); }
}

const placeCache = new BoundedCache<Place[]>();
const routeCache = new BoundedCache<OsrmRoute[]>();
let nextNominatimSlot = 0;

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

/** Waits until Nominatim may be called again (max 1 request per second). */
async function waitForNominatimSlot(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextNominatimSlot);
  nextNominatimSlot = slot + NOMINATIM_MIN_INTERVAL_MS;
  if (slot > now) await sleep(slot - now, signal);
}

/** Searches places by text. Cached and throttled; throws on network/HTTP errors. */
export async function searchPlaces(query: string, options: { limit?: number; signal?: AbortSignal } = {}): Promise<Place[]> {
  const limit = options.limit ?? 5;
  const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) return [];
  const key = `${limit}:${normalized}`;
  const cached = placeCache.get(key);
  if (cached) return cached;

  await waitForNominatimSlot(options.signal);
  const url = `${NOMINATIM_URL}?format=json&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: options.signal });
  if (!res.ok) throw new Error(`Address search failed (${res.status})`);
  const data: unknown = await res.json();
  const places = Array.isArray(data) ? (data as Place[]) : [];
  placeCache.set(key, places);
  return places;
}

/** Resolves an address to coordinates using the first search result. */
export async function geocode(query: string): Promise<{ lat: number; lon: number; display_name: string }> {
  const [first] = await searchPlaces(query, { limit: 1 });
  if (!first) throw new Error(`We couldn't find "${query}". Try adding a city or state.`);
  return { lat: parseFloat(first.lat), lon: parseFloat(first.lon), display_name: first.display_name || query };
}

/** Fetches up to 3 driving routes between two points. Cached. */
export async function fetchDrivingRoutes(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): Promise<OsrmRoute[]> {
  const coords = `${from.lon.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}`;
  const cached = routeCache.get(coords);
  if (cached) return cached;

  const res = await fetch(`${OSRM_URL}/${coords}?overview=full&geometries=geojson&alternatives=true`);
  if (!res.ok) throw new Error('The routing service is busy. Please try again in a moment.');
  const data: unknown = await res.json();
  const routes = typeof data === 'object' && data !== null ? (data as { routes?: unknown }).routes : undefined;
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('No drivable route was found between these places.');
  }
  const result = (routes as OsrmRoute[]).slice(0, 3);
  routeCache.set(coords, result);
  return result;
}

/** Test helper. */
export function resetOpenDataForTests(): void {
  placeCache.clear();
  routeCache.clear();
  nextNominatimSlot = 0;
}
