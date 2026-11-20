import { describe, expect, it, vi } from 'vitest';
import { analyzeElevationWindImpact, analyzePredictions, analyzeTrip, calculateTripMetrics, optimizeSOCCharging } from './ai';

const ev = {
  manufacturer: 'Tesla', model_name: 'Model 3', battery_capacity_kwh: 60,
  efficiency_kwh_per_mile: 0.22, range_miles: 272,
};

function mockFetch(status: number, body: unknown = {}) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('calculateTripMetrics', () => {
  it('computes CO2 and cost savings from distance', () => {
    const m = calculateTripMetrics({ distance: 100, duration: 120, energyEfficiency: 0.22 }, ev);
    expect(m.co2Saved).toBe(40.4);
    expect(m.equivalentTrees).toBe(2);
    expect(m.fuelCostSaved).toBeCloseTo(100 * 0.14 - 100 * 0.22 * 0.15, 2);
    expect(m.efficiencyScore).toBe(100); // 50 mph average, no highway penalty
    expect(m.realWorldRange).toBe(272);
  });

  it('penalises high average speed', () => {
    const m = calculateTripMetrics({ distance: 100, duration: 75, energyEfficiency: 0.22 }, ev); // 80 mph
    expect(m.realWorldRange).toBeLessThan(272);
    expect(m.efficiencyScore).toBeLessThan(100);
    expect(m.efficiencyScore).toBeGreaterThanOrEqual(40);
  });
});

describe('analyzeTrip', () => {
  const input = {
    origin: 'A', destination: 'B', startingBattery: 50, evModel: ev,
    routes: [
      { id: 'fast', name: 'Fastest', distance: 200, duration: 180, energyEfficiency: 0.3, batteryUsage: 70, chargingStops: 1 },
      { id: 'eco', name: 'Eco', distance: 190, duration: 190, energyEfficiency: 0.25 },
    ],
  };

  it('falls back to local heuristics when the AI proxy is unavailable', async () => {
    const fetchMock = mockFetch(503, { error: 'AI is not configured' });
    const rec = await analyzeTrip(input);
    expect(fetchMock).toHaveBeenCalledWith('/api/gemini', expect.objectContaining({ method: 'POST' }));
    expect(rec.recommendedRouteId).toBe('eco'); // only 10 min slower, more efficient
    expect(rec.confidence).toBe(80);
  });

  it('uses the AI answer when available', async () => {
    const answer = { summary: 'Take fast', recommendedRouteId: 'fast', confidence: 91, reasons: ['quick'], chargingPlan: [], risks: [] };
    mockFetch(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] });
    const rec = await analyzeTrip(input);
    expect(rec.recommendedRouteId).toBe('fast');
    expect(rec.confidence).toBe(91);
  });
});

describe('analyzePredictions fallback', () => {
  it('flags cold weather range loss', async () => {
    mockFetch(503);
    const p = await analyzePredictions({
      startingBattery: 95, evModel: ev, route: { distance: 100, duration: 100 },
      weather: [{ point: 'start', tempF: 30, condition: 'Snow' }],
    });
    expect(p.weatherImpact.rangeDeltaPercent).toBe(-15);
    expect(p.batteryDegradationRisk).toBe('medium');
    expect(p.weatherImpact.notes.length).toBe(2);
  });
});

describe('optimizeSOCCharging', () => {
  it('needs no stops when the battery covers the trip', async () => {
    const r = await optimizeSOCCharging({ distance: 50, startingBattery: 90, evModel: ev, chargingStations: [] });
    expect(r.chargingStops).toHaveLength(0);
  });
});

describe('analyzeElevationWindImpact', () => {
  it('reports a flat, calm route', async () => {
    const r = await analyzeElevationWindImpact({
      route: { distance: 10, originCoords: [0, 0], destinationCoords: [0, 1] },
      elevationPoints: [{ lat: 0, lng: 0, elevation: 100, distance: 0 }, { lat: 0, lng: 1, elevation: 120, distance: 10 }],
      windConditions: [{ speed: 0, direction: 0, gust: 0 }],
    });
    expect(r.elevationGain).toBe(20);
    expect(r.recommendations).toContain('Route is relatively flat - minimal elevation impact');
  });
});
