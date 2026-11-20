import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDrivingRoutes, geocode, resetOpenDataForTests, searchPlaces } from './openData';

const place = { place_id: '1', display_name: 'San Francisco, CA', lat: '37.77', lon: '-122.42' };

function mockJson(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  resetOpenDataForTests();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('searchPlaces', () => {
  it('caches results for the same query (ignoring case/spacing)', async () => {
    const fetchMock = mockJson([place]);
    await searchPlaces('San Francisco');
    await searchPlaces('  san   francisco ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('spaces Nominatim requests at least 1 second apart', async () => {
    const fetchMock = mockJson([place]);
    const first = searchPlaces('a place');
    const second = searchPlaces('another place');
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can be cancelled while waiting for its slot', async () => {
    mockJson([place]);
    await searchPlaces('first');
    const controller = new AbortController();
    const pending = searchPlaces('second', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });
});

describe('geocode', () => {
  it('returns coordinates of the first match', async () => {
    mockJson([place]);
    await expect(geocode('SF')).resolves.toEqual({ lat: 37.77, lon: -122.42, display_name: 'San Francisco, CA' });
  });

  it('gives a helpful error when nothing matches', async () => {
    mockJson([]);
    await expect(geocode('zzzz')).rejects.toThrow(/couldn't find "zzzz"/);
  });
});

describe('fetchDrivingRoutes', () => {
  const route = { distance: 1000, duration: 60, geometry: { coordinates: [[0, 0], [1, 1]] } };

  it('caches routes and returns at most three', async () => {
    const fetchMock = mockJson({ routes: [route, route, route, route] });
    const a = await fetchDrivingRoutes({ lat: 1, lon: 2 }, { lat: 3, lon: 4 });
    await fetchDrivingRoutes({ lat: 1, lon: 2 }, { lat: 3, lon: 4 });
    expect(a).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('explains when no route exists', async () => {
    mockJson({ routes: [] });
    await expect(fetchDrivingRoutes({ lat: 1, lon: 2 }, { lat: 3, lon: 4 })).rejects.toThrow(/No drivable route/);
  });
});
