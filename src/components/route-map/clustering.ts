import type { ClusterItem, Station } from './types';

/**
 * Groups nearby stations into clusters when zoomed out, so the map isn't
 * covered in overlapping markers. Above zoom 13 every station is shown.
 */
export function clusterStations(stations: Station[], zoom: number): ClusterItem[] {
  if (zoom > 13) return stations.map(s => ({ type: 'single', station: s, lat: s.latitude, lng: s.longitude }));

  const result: ClusterItem[] = [];
  const usedIndices = new Set<number>();
  const distanceThreshold = 0.05 * (15 - zoom); // Rough degree-based threshold

  stations.forEach((s, i) => {
    if (usedIndices.has(i)) return;

    const cluster = [s];
    usedIndices.add(i);

    for (let j = i + 1; j < stations.length; j++) {
      if (usedIndices.has(j)) continue;
      const other = stations[j];
      const dist = Math.hypot(s.latitude - other.latitude, s.longitude - other.longitude);
      if (dist < distanceThreshold) {
        cluster.push(other);
        usedIndices.add(j);
      }
    }

    if (cluster.length > 1) {
      const avgLat = cluster.reduce((sum, c) => sum + c.latitude, 0) / cluster.length;
      const avgLng = cluster.reduce((sum, c) => sum + c.longitude, 0) / cluster.length;
      result.push({ type: 'cluster', stations: cluster, lat: avgLat, lng: avgLng });
    } else {
      result.push({ type: 'single', station: s, lat: s.latitude, lng: s.longitude });
    }
  });

  return result;
}
