import { describe, expect, it, vi, beforeEach } from 'vitest';
import { chargingStationService, seededRandom } from './chargingStations';

function station(id: number, distance: number) {
  return {
    ID: id, UUID: `u${id}`,
    AddressInfo: { Title: `Station ${id}`, AddressLine1: '1 Main St', Town: 'Town', StateOrProvince: 'CA', Postcode: '90000', Latitude: 37, Longitude: -122, Distance: distance },
    Connections: [{ PowerKW: 150, Quantity: 4, ConnectionType: { Title: 'CCS' }, Level: { IsFastChargeCapable: true } }],
    StatusType: { IsOperational: true, Title: 'Operational' },
    OperatorInfo: { Title: 'Net' },
  };
}

function mockStations(data: unknown[]) {
  const fn = vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => chargingStationService.clearCache());

describe('seededRandom', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect(c()).not.toBe(seqA[0]);
    for (const v of seqA) expect(v >= 0 && v < 1).toBe(true);
  });
});

describe('getChargingStations', () => {
  it('calls the /api/ocm proxy without exposing a key and sorts by distance', async () => {
    const fetchMock = mockStations([station(1, 5), station(2, 1)]);
    const result = await chargingStationService.getChargingStations(37, -122, 5, 10);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/api/ocm');
    expect(url.searchParams.has('key')).toBe(false);
    expect(url.searchParams.get('latitude')).toBe('37');
    expect(result.map(s => s.id)).toEqual([2, 1]);
  });

  it('gives the same simulated details for a station every time', async () => {
    mockStations([station(7, 1)]);
    const first = (await chargingStationService.getChargingStations(37, -122))[0];
    chargingStationService.clearCache();
    const second = (await chargingStationService.getChargingStations(37, -122))[0];
    expect(second.pricing).toEqual(first.pricing);
    expect(second.amenities).toEqual(first.amenities);
    expect(second.availablePorts).toBe(first.availablePorts);
  });

  it('does not reuse cached results across different amenity filters', async () => {
    const fetchMock = mockStations([station(1, 1)]);
    await chargingStationService.getChargingStations(37, -122, 5, 10, []);
    await chargingStationService.getChargingStations(37, -122, 5, 10, ['wifi']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an empty list when the proxy fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    expect(await chargingStationService.getChargingStations(1, 1)).toEqual([]);
  });
});
