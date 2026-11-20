import { describe, expect, it } from 'vitest';
import { clusterStations } from './clustering';

const st = (id: number, latitude: number, longitude: number) => ({ id, title: `S${id}`, latitude, longitude });

describe('clusterStations', () => {
  const stations = [st(1, 37.0, -122.0), st(2, 37.01, -122.01), st(3, 38.0, -121.0)];

  it('shows every station when zoomed in', () => {
    const items = clusterStations(stations, 14);
    expect(items).toHaveLength(3);
    expect(items.every(i => i.type === 'single')).toBe(true);
  });

  it('groups nearby stations when zoomed out', () => {
    const items = clusterStations(stations, 10);
    const cluster = items.find(i => i.type === 'cluster');
    expect(items).toHaveLength(2);
    expect(cluster && cluster.type === 'cluster' && cluster.stations.map(s => s.id)).toEqual([1, 2]);
    expect(cluster?.lat).toBeCloseTo(37.005);
  });

  it('handles no stations', () => {
    expect(clusterStations([], 8)).toEqual([]);
  });
});
