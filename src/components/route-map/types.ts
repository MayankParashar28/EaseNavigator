

export type ClusterItem =
  | { type: 'single'; station: Station; lat: number; lng: number }
  | { type: 'cluster'; stations: Station[]; lat: number; lng: number };

export interface Station {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  address?: string;
  powerKW?: number;
  connectionType?: string;
  network?: string;
  isFastCharge?: boolean;
  isRecommended?: boolean;
  availableConnectors?: number;
  totalConnectors?: number;
  arrivalSOC?: number;
  chargeTime?: number;
}

export interface Incident {
  id: string;
  type: string;
  severity: string;
  description: string;
  location: { latitude: number; longitude: number };
  delayMinutes?: number;
  avoidanceMetrics?: {
    extraTime: number;
    costSaving: number;
    efficiencyGain: number;
  };
}

export interface RouteWithGeom {
  id: string;
  name: string;
  geometry?: [number, number][];
  distance: number;
  duration: number;
  batteryUsage?: number;
  chargingStops?: number;
  weatherConditions?: {
    start: { temp: number, condition: string, airQuality: string }
    midpoint: { temp: number, condition: string, airQuality: string }
    end: { temp: number, condition: string, airQuality: string }
  }
  energyEfficiency?: number;
  estimatedCost?: number;
  type?: 'fastest' | 'efficient';
  stopsCount?: number;
  costSaving?: number;
}

export interface RouteSegment {
  id: string;
  points: [number, number][];
  distance: number;
  duration: number;
  startLabel: string;
  endLabel: string;
  efficiency: number;
  weather: string;
  startSoC: number;
  endSoC: number;
  trafficLevel?: 'low' | 'moderate' | 'heavy';
  speedLimit?: number;
}
