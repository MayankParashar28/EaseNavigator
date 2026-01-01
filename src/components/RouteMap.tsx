import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  APIProvider,
  Map,
  useMapsLibrary,
  useMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  MapMouseEvent
} from '@vis.gl/react-google-maps';
import { Zap, Navigation, Layers, Mountain, Play, Pause, Sparkles, Loader2, AlertTriangle, Construction, MapPin, CloudSun, Wind, Activity, Car, CloudRain, ArrowRightLeft, Snowflake, Info, X } from 'lucide-react';
import { generateStopDescription } from '../lib/ai';
import ElevationProfile from './trip-results/ElevationProfile';
import { getRouteEnvData, RouteEnvData } from '../lib/envService';

interface CircleProps extends google.maps.CircleOptions {
  center: google.maps.LatLngLiteral;
  radius: number;
}

const Circle = (props: CircleProps) => {
  const map = useMap();
  const [circle, setCircle] = useState<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;
    const newCircle = new google.maps.Circle({
      ...props,
      map
    });
    setCircle(newCircle);

    return () => {
      newCircle.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (circle) {
      circle.setOptions(props);
    }
  }, [circle, props]);

  return null;
};

interface Station {
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

interface Incident {
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

interface RouteMapProps {
  route: RouteWithGeom;
  allRoutes?: RouteWithGeom[];
  origin: string;
  destination: string;
  originCoords?: [number, number];
  destinationCoords?: [number, number];
  stations?: Station[];
  incidents?: Incident[];
  onFindNearby?: () => void;
  onSelectRoute?: (route: RouteWithGeom) => void;
  hoveredSegmentIndex?: number | null;
  onHoverSegment?: (index: number | null) => void;
  focusedStation?: Station | null;
  onSelectStation?: (station: Station | null) => void;
}

// Map ID is required for Advanced Markers and Vector Maps (3D)
const MAP_ID = 'bf51a910020fa25a';

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1c1e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1c1e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#132b26" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
];

function Directions({
  origin,
  destination,
  onRouteChanged
}: {
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  onRouteChanged?: (res: google.maps.DirectionsResult) => void
}) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  // Initialize services
  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#10b981',
        strokeWeight: 4,
        strokeOpacity: 0.9,
      }
    }));
  }, [routesLibrary, map]);

  // Calculate Route
  useEffect(() => {
    if (!directionsService || !directionsRenderer || !origin || !destination) return;

    // cleanup previous route
    directionsRenderer.setMap(map);

    directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    }).then(response => {
      directionsRenderer.setDirections(response);
      if (onRouteChanged) onRouteChanged(response);
    }).catch(err => {
      console.error("Directions request failed", err);
    });

    return () => {
      // Optional: clear directions when unmounting or changing specific dependencies if needed.
      // directionsRenderer.setDirections({ routes: [] }); 
    }

  }, [directionsService, directionsRenderer, origin, destination, map]); // Added map to deps

  return null;
}

function SimulationHUD({
  metrics,
  origin,
  destination,
  stations
}: {
  metrics: { speed: number, efficiency: number, milesRemaining: number, currentSoC: number, progress: number },
  origin: string,
  destination: string,
  stations: Station[]
}) {
  const nextStation = stations.find((_, i) => (i / stations.length) > metrics.progress) || stations[stations.length - 1];

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Top Narrative Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
        <div className="glass-card bg-midnight/80 backdrop-blur-xl border-white/10 p-3 md:p-4 rounded-3xl shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Origin</span>
              <span className="text-xs font-bold text-white truncate max-w-[120px]">{origin.split(',')[0]}</span>
            </div>

            <div className="flex-1 h-1.5 bg-white/10 rounded-full relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-neon-blue shadow-[0_0_10px_rgba(0,210,255,1)] transition-all duration-300"
                style={{ width: `${metrics.progress * 100}%` }}
              />
              {/* Stops on timeline */}
              {stations.map((station, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-white/30 border border-white/10 -translate-y-1/4"
                  style={{ left: `${((i + 1) / (stations.length + 1)) * 100}%` }}
                  title={station.title}
                />
              ))}
            </div>

            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Destination</span>
              <span className="text-xs font-bold text-white truncate max-w-[120px]">{destination.split(',')[0]}</span>
            </div>
          </div>

          <div className="ml-8 pl-8 border-l border-white/10 flex items-center gap-4">
            <div className="text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Battery</div>
              <div className="text-sm font-bold text-neon-green">{Math.round(metrics.currentSoC)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stop Progress Overlay (Bottom Left) */}
      <div className="absolute bottom-32 left-8 w-64 animate-in slide-in-from-left duration-500">
        <div className="glass-card bg-midnight/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-20">
            <Zap className="w-12 h-12 text-neon-blue" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest">Next Stop</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                <span className="text-[9px] font-bold text-gray-400 uppercase">En Route</span>
              </div>
            </div>

            <h4 className="text-sm font-bold text-white mb-1 truncate">{nextStation?.title || 'Destination'}</h4>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-2xl font-black text-white italic">
                {Math.max(1, Math.round(metrics.milesRemaining * 0.4))}
              </span>
              <span className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase">Miles to Stop</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-bold">
                <span className="text-gray-400 uppercase">Distance Progress</span>
                <span className="text-neon-blue">{Math.round((metrics.progress % 0.3) / 0.3 * 100)}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-blue to-neon-purple shadow-[0_0_8px_rgba(0,210,255,0.4)] transition-all duration-1000"
                  style={{ width: `${(metrics.progress % 0.3) / 0.3 * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-neon-blue" />
                <span className="text-[10px] font-bold text-white">ETA: {Math.round(metrics.milesRemaining * 0.45)}m</span>
              </div>
              <div className="text-[9px] font-black text-neon-green uppercase italic">Optimal Speed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Telemetry Sidebar */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 space-y-4">
        <div className="glass-card bg-midnight/60 backdrop-blur-md border-white/5 p-3 md:p-4 rounded-2xl w-28 md:w-32 space-y-4 shadow-xl">
          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3 text-neon-blue" /> Speed
            </div>
            <div className="text-xl font-black text-white italic">
              {metrics.speed}<span className="text-[10px] font-normal ml-1 not-italic opacity-40">MPH</span>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> Efficiency
            </div>
            <div className="text-sm font-bold text-white">
              {metrics.efficiency.toFixed(2)}<span className="text-[8px] font-normal ml-1 opacity-40">kWh/mi</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Remaining</div>
            <div className="text-xs font-bold text-white">{Math.round(metrics.milesRemaining)} miles</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserLocationMarker() {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    // Mock user location for demo
    setPosition({ lat: 34.4208, lng: -119.6982 }); // Santa Barbara area
  }, []);

  if (!position) return null;

  return (
    <AdvancedMarker position={position} zIndex={100}>
      <div className="relative flex items-center justify-center">
        <div className="absolute w-8 h-8 bg-blue-500/20 rounded-full animate-ping" />
        <div className="w-4 h-4 bg-white rounded-full border-4 border-blue-500 shadow-xl" />
      </div>
    </AdvancedMarker>
  );
}



function MapTooltip({
  content,
  position
}: {
  content: string | React.ReactNode,
  position: { x: number, y: number } | null
}) {
  if (!position) return null;
  return (
    <div
      className="fixed pointer-events-none z-[100] px-3 py-2 bg-midnight/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl transition-opacity animate-in fade-in zoom-in duration-200"
      style={{
        left: position.x + 15,
        top: position.y - 15,
      }}
    >
      <div className="text-[11px] font-bold text-white whitespace-nowrap">
        {content}
      </div>
    </div>
  );
}

function MapLegend({ onClose }: { onClose: () => void }) {
  const legendItems = [
    { icon: <div className="w-3 h-3 rounded-full bg-green-500" />, label: 'Origin' },
    { icon: <div className="w-3 h-3 rounded-full bg-red-500" />, label: 'Destination' },
    { icon: <div className="w-3 h-3 rounded-full bg-yellow-500" />, label: 'Charging Stop' },
    { icon: <div className="w-8 h-1 bg-green-500 rounded-full" />, label: 'Active Route' },
    { icon: <div className="w-8 h-1 bg-gray-400 rounded-full" />, label: 'Alternative Route' },
    { icon: <div className="w-8 h-1 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] rounded-full" />, label: 'Heavy Traffic' },
  ];

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 glass-card bg-midnight/80 backdrop-blur-xl border-white/10 p-5 rounded-3xl shadow-2xl w-64 z-20 animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Info className="w-4 h-4 text-neon-blue" /> Map Legend
        </h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {legendItems.map((item, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-8 flex justify-center">
              {item.icon}
            </div>
            <span className="text-[11px] font-medium text-gray-300">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrafficLayer({ show }: { show: boolean }) {
  const map = useMap();
  const mapsLibrary = useMapsLibrary('maps');
  const [trafficLayer, setTrafficLayer] = useState<google.maps.TrafficLayer>();

  useEffect(() => {
    if (!mapsLibrary || !map) return;
    const layer = new mapsLibrary.TrafficLayer();
    setTrafficLayer(layer);

    return () => {
      layer.setMap(null);
    };
  }, [mapsLibrary, map]);

  useEffect(() => {
    if (trafficLayer) {
      trafficLayer.setMap(show ? map : null);
    }
  }, [trafficLayer, show, map]);

  return null;
}

function FlyoverController({
  routeGeometry,
  isPlaying,
  speedMultiplier = 1,
  onMetricsUpdate,
  onStop
}: {
  routeGeometry: [number, number][],
  isPlaying: boolean,
  speedMultiplier?: number,
  onMetricsUpdate?: (metrics: { speed: number, efficiency: number, milesRemaining: number, currentSoC: number, progress: number }) => void,
  onStop: () => void
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !isPlaying || !routeGeometry || routeGeometry.length < 2) return;

    let startTime: number | null = null;
    const baseDuration = 30000; // 30 seconds base for full route
    const duration = baseDuration / speedMultiplier;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / duration;

      if (progress >= 1) {
        onStop();
        return;
      }

      // Calculate current position index
      const totalPoints = routeGeometry.length;
      const currentIndex = Math.floor(progress * (totalPoints - 1));
      const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);

      const p1 = routeGeometry[currentIndex];
      const p2 = routeGeometry[nextIndex];

      const segmentProgress = (progress * (totalPoints - 1)) - currentIndex;
      const lat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
      const lng = p1[1] + (p2[1] - p1[1]) * segmentProgress;

      const dy = p2[0] - p1[0];
      const dx = Math.cos(Math.PI / 180 * p1[0]) * (p2[1] - p1[1]);
      const angle = Math.atan2(dy, dx);
      let heading = angle * 180 / Math.PI;
      heading = 90 - heading;

      map.moveCamera({
        center: { lat, lng },
        zoom: 17,
        tilt: 65,
        heading: heading
      });

      // Update Simulated Metrics
      if (onMetricsUpdate) {
        onMetricsUpdate({
          speed: Math.round(65 + Math.random() * 5),
          efficiency: 0.25 + Math.random() * 0.1,
          milesRemaining: Math.round((1 - progress) * 150), // Mock 150mi total
          currentSoC: Math.max(15, 80 - progress * 65), // Starts at 80, drops to 15
          progress
        });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [map, isPlaying, routeGeometry, speedMultiplier, onStop]);

  return null;
}

function Map3DController({ tilt, heading }: { tilt: number, heading: number }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.moveCamera({ tilt, heading });
    }
  }, [map, tilt, heading]);
  return null;
}

interface RouteSegment {
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

function WeatherOverlay({
  geometry
}: {
  geometry: [number, number][]
}) {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  const [envData, setEnvData] = useState<RouteEnvData | null>(null);

  useEffect(() => {
    if (geometry.length > 0) {
      setEnvData(getRouteEnvData(geometry));
    }
  }, [geometry]);

  useEffect(() => {
    if (!map || !maps || !envData) return;

    // 1. Temperature Gradient Polylines
    // Break geometry into small chunks for gradient effect
    const polylines: google.maps.Polyline[] = [];
    const chunkSize = 5;

    for (let i = 0; i < envData.points.length - 1; i += chunkSize) {
      const chunk = envData.points.slice(i, i + chunkSize + 1);
      const avgTemp = chunk.reduce((acc, p) => acc + p.temp, 0) / chunk.length;

      // Interpolate color: Blue (32F) -> Yellow (70F) -> Red (100F)
      let color = '#3b82f6'; // blue
      if (avgTemp > 80) color = '#ef4444'; // red
      else if (avgTemp > 65) color = '#eab308'; // yellow

      const polyline = new google.maps.Polyline({
        path: chunk.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: color,
        strokeOpacity: 0.6,
        strokeWeight: 6,
        map,
        zIndex: 1
      });
      polylines.push(polyline);
    }

    return () => {
      polylines.forEach(p => p.setMap(null));
    };
  }, [map, maps, envData]);

  if (!envData) return null;

  return (
    <>
      {/* 2. AQI Zones */}
      {envData.aqiZones.map((zone, i) => (
        <Circle
          key={`aqi-${i}`}
          center={{ lat: zone.lat, lng: zone.lng }}
          radius={zone.radius}
          fillColor={zone.aqi > 100 ? '#ef4444' : '#eab308'}
          fillOpacity={0.2}
          strokeColor={zone.aqi > 100 ? '#ef4444' : '#eab308'}
          strokeOpacity={0.5}
          strokeWeight={2}
        />
      ))}

      {/* 3. Precipitation & Weather Warnings */}
      {envData.weatherWarnings.map((warning, i) => (
        <AdvancedMarker
          key={`weather-warn-${i}`}
          position={{ lat: warning.lat, lng: warning.lng }}
          zIndex={20}
        >
          <div className="flex flex-col items-center">
            <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-blue-100 animate-bounce">
              {warning.type === 'rain' ?
                <CloudRain className="w-6 h-6 text-blue-500" /> :
                <Snowflake className="w-6 h-6 text-indigo-400" />
              }
            </div>
            <div className="mt-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              {warning.message}
            </div>
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}

function MultiRouteDisplay({
  routes,
  activeRouteId,
  onSelect,
  onHover
}: {
  routes: RouteWithGeom[],
  activeRouteId: string,
  onSelect?: (route: RouteWithGeom) => void,
  onHover?: (route: RouteWithGeom | null, event?: google.maps.MapMouseEvent) => void
}) {
  const map = useMap();
  const maps = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !maps || !routes) return;

    const polylines: google.maps.Polyline[] = [];

    routes.forEach((route) => {
      if (!route.geometry) return;

      const isActive = route.id === activeRouteId;
      const path = route.geometry.map(p => ({ lat: p[0], lng: p[1] }));

      // Determine semantic color
      let color = '#94a3b8'; // default grey
      if (route.type === 'fastest') color = '#10b981'; // green
      if (route.type === 'efficient') color = '#0ea5e9'; // blue

      const polyline = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: isActive ? 1.0 : 0.5,
        strokeWeight: isActive ? 5 : 3,
        map,
        zIndex: isActive ? 10 : 5,
        clickable: true
      });

      polyline.addListener('click', () => {
        if (onSelect) onSelect(route);
      });

      polyline.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
        if (!isActive) polyline.setOptions({ strokeOpacity: 0.8, strokeWeight: 4 });
        if (onHover) onHover(route, e);
      });

      polyline.addListener('mouseout', () => {
        if (!isActive) polyline.setOptions({ strokeOpacity: 0.5, strokeWeight: 3 });
        if (onHover) onHover(null);
      });

      polylines.push(polyline);
      // Removed inline info window markers logic
    });

    return () => {
      polylines.forEach(p => p.setMap(null));
    };
  }, [map, maps, routes, activeRouteId, onSelect, onHover]);

  return null;
}

function RouteSegments({
  segments,
  hoveredIndex,
  onHoverSegment,
  onSelectSegment
}: {
  segments: RouteSegment[],
  hoveredIndex?: number | null,
  onHoverSegment?: (index: number | null) => void,
  onSelectSegment?: (segment: RouteSegment) => void
}) {
  const map = useMap();
  const maps = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !maps || !segments || segments.length === 0) return;

    const polylines: google.maps.Polyline[] = [];

    segments.forEach((segment, i) => {
      const isHovered = hoveredIndex === i;

      // Traffic colors
      let strokeColor = '#10b981'; // default green (low)
      if (segment.trafficLevel === 'moderate') strokeColor = '#eab308'; // yellow
      if (segment.trafficLevel === 'heavy') strokeColor = '#ef4444'; // red

      const polyline = new google.maps.Polyline({
        path: segment.points.map(p => ({ lat: p[0], lng: p[1] })),
        strokeColor: isHovered ? '#00d2ff' : strokeColor,
        strokeOpacity: isHovered ? 1.0 : 0.8,
        strokeWeight: isHovered ? 12 : 8,
        map,
        zIndex: isHovered ? 10 : 5
      });

      polyline.addListener('mouseover', () => {
        polyline.setOptions({ strokeColor: '#00d2ff', strokeWeight: 12, strokeOpacity: 1 });
        if (onHoverSegment) onHoverSegment(i);
      });

      polyline.addListener('mouseout', () => {
        if (!isHovered) {
          polyline.setOptions({ strokeColor: '#10b981', strokeWeight: 8, strokeOpacity: 0.8 });
        }
        if (onHoverSegment) onHoverSegment(null);
      });

      polyline.addListener('click', () => {
        if (onSelectSegment) onSelectSegment(segment);
      });

      polylines.push(polyline);

      // Add Weather/Traffic Icon at Segment Midpoint if severe
      if (segment.trafficLevel === 'heavy' || segment.weather !== 'Clear') {
        const midPointIdx = Math.floor(segment.points.length / 2);
        const midPoint = segment.points[midPointIdx];

        const content = document.createElement('div');
        content.className = 'flex flex-col items-center animate-bounce-slow pointer-events-none';

        let iconHtml = '';
        if (segment.trafficLevel === 'heavy') iconHtml = '🚗';
        else if (segment.weather.includes('Rain')) iconHtml = '🌧️';
        else if (segment.weather.includes('Snow')) iconHtml = '❄️';
        else iconHtml = '🌤️';

        content.innerHTML = `<div class="bg-midnight/80 backdrop-blur-md p-1.5 rounded-full border border-white/20 shadow-xl text-xs">${iconHtml}</div>`;

        const infoWindow = new google.maps.InfoWindow({
          position: { lat: midPoint[0], lng: midPoint[1] },
          content: content,
          disableAutoPan: true,
          headerDisabled: true
        });

        infoWindow.open(map);
        segmentsWithIcons.push(infoWindow);
      }
    });

    return () => {
      polylines.forEach(s => s.setMap(null));
      segmentsWithIcons.forEach(iw => iw.close());
    };
  }, [map, maps, segments, hoveredIndex, onHoverSegment, onSelectSegment]);

  const segmentsWithIcons: google.maps.InfoWindow[] = [];

  return null;
}

export default function RouteMap({
  origin,
  destination,
  originCoords,
  destinationCoords,
  stations = [],
  incidents = [],
  route,
  allRoutes = [],
  onFindNearby,
  onSelectRoute,
  hoveredSegmentIndex,
  onHoverSegment,
  focusedStation,
  onSelectStation
}: RouteMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const map = useMap(); // Moved to top level

  const [showTraffic, setShowTraffic] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [isFlying, setIsFlying] = useState(false); // Playback state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<google.maps.LatLngLiteral[]>([]);
  const [measurementLine, setMeasurementLine] = useState<google.maps.Polyline | null>(null);
  const [tooltip, setTooltip] = useState<{ content: string | React.ReactNode, pos: { x: number, y: number } } | null>(null);
  const [flyoverSpeed, setFlyoverSpeed] = useState<1 | 2 | 4>(1);
  const [simulationMetrics, setSimulationMetrics] = useState({
    speed: 0,
    efficiency: 0,
    milesRemaining: 0,
    currentSoC: 80,
    progress: 0
  });

  const [internalSelectedStation, setInternalSelectedStation] = useState<Station | null>(null);
  const selectedStation = focusedStation !== undefined ? focusedStation : internalSelectedStation;
  const handleStationSelect = (s: Station | null) => {
    if (onSelectStation) onSelectStation(s);
    setInternalSelectedStation(s);
  };

  // Auto-pan when selected station changes
  useEffect(() => {
    if (map && selectedStation) {
      map.panTo({ lat: selectedStation.latitude, lng: selectedStation.longitude });
      map.setZoom(15);
      map.setTilt(45);
    }
  }, [map, selectedStation]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RouteSegment | null>(null);
  const [stopDescription, setStopDescription] = useState<string>('');
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [tilt, setTilt] = useState(45); // Start with a 3D tilt
  const [heading, setHeading] = useState(0);
  // Use string literal to avoid "google is not defined" error before API loads
  const [mapType, setMapType] = useState<string>('roadmap');

  const [zoom, setZoom] = useState(11);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!map) return;

      const PAN_STEP = 50;
      switch (e.key) {
        case 'ArrowUp': map.panBy(0, -PAN_STEP); break;
        case 'ArrowDown': map.panBy(0, PAN_STEP); break;
        case 'ArrowLeft': map.panBy(-PAN_STEP, 0); break;
        case 'ArrowRight': map.panBy(PAN_STEP, 0); break;
        case '+': case '=': map.setZoom((map.getZoom() || 11) + 1); break;
        case '-': case '_': map.setZoom((map.getZoom() || 11) - 1); break;
        case 'Escape':
          handleStationSelect(null);
          setSelectedIncident(null);
          setSelectedSegment(null);
          setShowLegend(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [map]);

  const handleStopFlying = useCallback(() => setIsFlying(false), []);

  const fitRouteBounds = useCallback(() => {
    if (!map || (!route.geometry && !originCoords && !destinationCoords)) return;

    const bounds = new google.maps.LatLngBounds();

    if (route.geometry) {
      route.geometry.forEach(p => bounds.extend({ lat: p[0], lng: p[1] }));
    } else {
      if (originCoords) bounds.extend({ lat: originCoords[0], lng: originCoords[1] });
      if (destinationCoords) bounds.extend({ lat: destinationCoords[0], lng: destinationCoords[1] });
    }

    // Also include stations in bounds if they exist
    stations.forEach(s => bounds.extend({ lat: s.latitude, lng: s.longitude }));

    map.fitBounds(bounds, {
      top: 100,
      right: 50,
      bottom: 150,
      left: 50
    });
  }, [map, route, originCoords, destinationCoords, stations]);

  const geometryLibrary = useMapsLibrary('geometry');

  // Initial fit when route or map loads
  useEffect(() => {
    if (map && (route.id || originCoords)) {
      fitRouteBounds();
      // Cache route for offline viewing
      if (route.id) {
        localStorage.setItem('last_planned_route', JSON.stringify({
          route,
          stations,
          incidents,
          timestamp: Date.now()
        }));
        setIsCached(true);
      }
    }
    if (map && stations && stations.length > 0) {
      // Auto select first station for demo
      // handleStationSelect(stations[0]); 
    }
  }, [map, stations, route.id, fitRouteBounds, incidents]);

  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!mapContainerRef.current) return;
    if (!isFullscreen) {
      if (mapContainerRef.current.requestFullscreen) {
        mapContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!isMeasuring || !e.detail.latLng) return;

    const newPoint = e.detail.latLng;
    const points = [...measurementPoints, newPoint];
    setMeasurementPoints(points);

    if (points.length >= 2 && map) {
      if (measurementLine) measurementLine.setMap(null);

      const line = new google.maps.Polyline({
        path: points,
        geodesic: true,
        strokeColor: '#00d2ff',
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map: map
      });
      setMeasurementLine(line);

      if (geometryLibrary && points.length >= 2) {
        let totalDist = 0;
        for (let i = 0; i < points.length - 1; i++) {
          totalDist += google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(points[i]),
            new google.maps.LatLng(points[i + 1])
          );
        }
        // Show as alert or tooltip
        const miles = (totalDist * 0.000621371).toFixed(1);
        setTooltip({
          content: `Measured: ${miles} miles`,
          pos: { x: window.innerWidth / 2, y: 100 }
        });
        setTimeout(() => setTooltip(null), 3000);
      }
    }
  }, [isMeasuring, measurementPoints, map, measurementLine, geometryLibrary]);

  // Cleanup measurement line
  useEffect(() => {
    if (!isMeasuring && measurementLine) {
      measurementLine.setMap(null);
      setMeasurementLine(null);
      setMeasurementPoints([]);
    }
  }, [isMeasuring]);

  const start = originCoords ? { lat: originCoords[0], lng: originCoords[1] } : { lat: 37.7749, lng: -122.4194 };
  const end = destinationCoords ? { lat: destinationCoords[0], lng: destinationCoords[1] } : { lat: 34.0522, lng: -118.2437 };
  const center = { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 };

  // Simple Clustering Logic
  const clusters = useMemo(() => {
    if (zoom > 13) return stations.map(s => ({ type: 'single', station: s, lat: s.latitude, lng: s.longitude }));

    const result: any[] = [];
    const usedIndices = new Set<number>();
    const distanceThreshold = 0.05 * (15 - zoom); // Rough degree-based threshold

    stations.forEach((s, i) => {
      if (usedIndices.has(i)) return;

      const cluster = [s];
      usedIndices.add(i);

      for (let j = i + 1; j < stations.length; j++) {
        if (usedIndices.has(j)) continue;
        const other = stations[j];
        const dist = Math.sqrt(Math.pow(s.latitude - other.latitude, 2) + Math.pow(s.longitude - other.longitude, 2));
        if (dist < distanceThreshold) {
          cluster.push(other);
          usedIndices.add(j);
        }
      }

      if (cluster.length > 1) {
        const avgLat = cluster.reduce((sum, s) => sum + s.latitude, 0) / cluster.length;
        const avgLng = cluster.reduce((sum, s) => sum + s.longitude, 0) / cluster.length;
        result.push({ type: 'cluster', stations: cluster, lat: avgLat, lng: avgLng });
      } else {
        result.push({ type: 'single', station: s, lat: s.latitude, lng: s.longitude });
      }
    });

    return result;
  }, [stations, zoom]);

  return (
    <div
      ref={mapContainerRef}
      className={`bg-white rounded-xl shadow-lg overflow-hidden flex flex-col relative group transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen rounded-none' : 'h-[450px] md:h-[600px]'
        }`}
    >
      {/* Header */}


      <div className="flex-1 relative">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={11}
            defaultHeading={0}
            defaultTilt={0}
            mapId={MAP_ID}
            mapTypeId={mapType}
            styles={DARK_MAP_STYLE}
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false} // Use our custom one
            zoomControl={true}
            scaleControl={true}
            className="w-full h-full"
            onHeadingChanged={(ev) => !isFlying && setHeading(ev.detail.heading)}
            onTiltChanged={(ev) => !isFlying && setTilt(ev.detail.tilt)}
            onZoomChanged={(ev) => setZoom(ev.detail.zoom)}
            onClick={handleMapClick}
          >
            {showLegend && <MapLegend onClose={() => setShowLegend(false)} />}
            <MapTooltip content={tooltip?.content || ''} position={tooltip?.pos || null} />

            <UserLocationMarker />

            {/* Controller for manual 3D toggle */}
            {!isFlying && <Map3DController tilt={tilt} heading={heading} />}

            {showWeather && (
              <WeatherOverlay geometry={route.geometry || []} />
            )}

            <MultiRouteDisplay
              routes={allRoutes}
              activeRouteId={route.id}
              onSelect={onSelectRoute}
              onHover={(r, e) => {
                if (r) {
                  const hours = Math.floor(r.duration / 3600);
                  const mins = Math.floor((r.duration % 3600) / 60);
                  if (e && e.domEvent) {
                    setTooltip({
                      content: `${hours}h ${mins}m journey · ${r.stopsCount || 1} stop${(r.stopsCount || 1) > 1 ? 's' : ''}`,
                      pos: { x: (e.domEvent as MouseEvent).clientX, y: (e.domEvent as MouseEvent).clientY }
                    });
                  }
                } else {
                  setTooltip(null);
                }
              }}
            />

            {/* Current Route */}
            {route.geometry && (
              <RouteSegments
                segments={(() => {
                  const segs: RouteSegment[] = [];
                  const numSegments = stations.length + 1;
                  const pointsPerSegment = Math.floor(route.geometry.length / numSegments);

                  for (let i = 0; i < numSegments; i++) {
                    const startIdx = i * pointsPerSegment;
                    const endIdx = (i === numSegments - 1) ? route.geometry.length : (i + 1) * pointsPerSegment + 1;
                    const segmentPoints = route.geometry.slice(startIdx, endIdx);

                    const trafficLevels: ('low' | 'moderate' | 'heavy')[] = ['low', 'moderate', 'heavy'];
                    const trafficLevel = trafficLevels[Math.floor(Math.random() * 3)];
                    const speedLimit = 65 - (i * 5 % 20);

                    segs.push({
                      id: `seg-${i}`,
                      points: segmentPoints,
                      distance: route.distance / numSegments,
                      duration: route.duration / numSegments,
                      startLabel: i === 0 ? origin : stations[i - 1].title,
                      endLabel: i === numSegments - 1 ? destination : stations[i].title,
                      efficiency: 0.28,
                      weather: 'Clear',
                      startSoC: 80 - i * 15,
                      endSoC: 80 - (i + 1) * 15,
                      trafficLevel,
                      speedLimit
                    });
                  }
                  return segs;
                })()}
                hoveredIndex={hoveredSegmentIndex}
                onHoverSegment={onHoverSegment}
                onSelectSegment={setSelectedSegment}
              />
            )}

            <Directions
              origin={start}
              destination={end}
            />

            <TrafficLayer show={showTraffic} />

            {isFlying && (
              <SimulationHUD
                metrics={simulationMetrics}
                origin={origin}
                destination={destination}
                stations={stations}
              />
            )}

            <FlyoverController
              routeGeometry={route?.geometry || []}
              isPlaying={isFlying}
              speedMultiplier={flyoverSpeed}
              onMetricsUpdate={setSimulationMetrics}
              onStop={handleStopFlying}
            />

            {/* Origin Marker */}
            <AdvancedMarker position={start} title={"Start: " + origin} zIndex={20}>
              <Pin background={'#10b981'} borderColor={'#064e3b'} glyphColor={'white'} scale={1.2} />
            </AdvancedMarker>

            {/* Destination Marker */}
            <AdvancedMarker position={end} title={"End: " + destination} zIndex={20}>
              <Pin background={'#ef4444'} borderColor={'#7f1d1d'} glyphColor={'white'} scale={1.2} />
            </AdvancedMarker>

            {/* Charging Stations & Clusters */}
            {clusters.map((c: any, i: number) => {
              if (c.type === 'cluster') {
                return (
                  <AdvancedMarker
                    key={`cluster-${i}`}
                    position={{ lat: c.lat, lng: c.lng }}
                    onClick={() => {
                      if (map) map.setOptions({ center: { lat: c.lat, lng: c.lng }, zoom: zoom + 2 });
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-neon-blue border-2 border-white flex items-center justify-center text-white font-black text-xs shadow-[0_0_15px_rgba(0,210,255,0.8)] animate-in zoom-in duration-300">
                      {c.stations.length}
                    </div>
                  </AdvancedMarker>
                );
              }

              const station = c.station;
              const power = station.powerKW || 0;
              const speedColor = power >= 150 ? 'bg-red-500' :
                power >= 50 ? 'bg-yellow-500' : 'bg-green-500';

              return (
                <AdvancedMarker
                  key={`station-${station.id}`}
                  position={{ lat: station.latitude, lng: station.longitude }}
                  onMouseEnter={(e: any) => {
                    const power = station.powerKW || 0;
                    if (e.domEvent && e.domEvent instanceof MouseEvent) {
                      setTooltip({
                        content: `${station.title} · ${power}kW · ${station.availableConnectors || 2}/5 free`,
                        pos: { x: (e.domEvent as MouseEvent).clientX, y: (e.domEvent as MouseEvent).clientY }
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={async (e: google.maps.MapMouseEvent) => {
                    e.stop();
                    handleStationSelect(station);
                    setSelectedIncident(null);
                    setStopDescription('');
                    setLoadingDesc(true);
                    const amenities = ['Coffee', 'Restroom', 'WiFi'];
                    if (station.isFastCharge || power >= 150) amenities.push('Dining', 'Lounge');
                    const desc = await generateStopDescription(station.title, amenities);
                    setStopDescription(desc);
                    setLoadingDesc(false);
                  }}
                  zIndex={station.isRecommended ? 10 : 5}
                >
                  <div className={`
                    p-1.5 rounded-full border-2 shadow-xl transition-all duration-500 cursor-pointer
                    ${speedColor}
                    ${station.isRecommended ? 'border-neon-blue !p-2 ring-4 ring-neon-blue/40 shadow-[0_0_20px_rgba(0,210,255,0.6)] animate-pulse-slow' : 'border-white'}
                    ${isFlying ? 'animate-pulse scale-110 shadow-[0_0_15px_rgba(255,255,255,0.5)]' : ''}
                    ${hoveredSegmentIndex === (stations.indexOf(station) + 1) ? 'scale-150 ring-4 ring-yellow-400 border-yellow-400 z-50' : ''}
                  `}>
                    <Zap className={`w-4 h-4 text-white ${station.isRecommended ? 'w-5 h-5' : ''}`} fill="currentColor" />
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Incident Markers */}
            {incidents.map((incident, i) => (
              <React.Fragment key={`incident-group-${i}`}>
                <AdvancedMarker
                  position={{ lat: incident.location.latitude, lng: incident.location.longitude }}
                  onMouseEnter={(e: any) => {
                    if (e.domEvent && e.domEvent instanceof MouseEvent) {
                      setTooltip({
                        content: `+${incident.delayMinutes || 15} min delay · ${incident.type.charAt(0).toUpperCase() + incident.type.slice(1)}`,
                        pos: { x: (e.domEvent as MouseEvent).clientX, y: (e.domEvent as MouseEvent).clientY }
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => {
                    setSelectedIncident(incident);
                    handleStationSelect(null);
                  }}
                  zIndex={15}
                >
                  <div className={`p-2 rounded-full border-2 border-white shadow-lg animate-pulse ${incident.severity === 'severe' ? 'bg-red-600' : 'bg-orange-500'
                    }`}>
                    {incident.type === 'construction' ? <Construction className="w-4 h-4 text-white" /> :
                      incident.type === 'accident' ? <Car className="w-4 h-4 text-white" /> :
                        incident.type === 'weather' ? <CloudRain className="w-4 h-4 text-white" /> :
                          <AlertTriangle className="w-4 h-4 text-white" />}
                  </div>
                </AdvancedMarker>

                {/* Inline Delay Label */}
                {incident.delayMinutes && (
                  <InfoWindow
                    position={{ lat: incident.location.latitude + 0.005, lng: incident.location.longitude }}
                    headerDisabled={true}
                  >
                    <div className="bg-white/90 backdrop-blur px-2 py-1 rounded-lg shadow-sm border border-red-100">
                      <span className="text-[10px] font-black text-red-600">+{incident.delayMinutes}m delay</span>
                    </div>
                  </InfoWindow>
                )}
              </React.Fragment>
            ))}

            {/* Station Infowindow */}
            {selectedStation && (
              <InfoWindow
                position={{ lat: selectedStation.latitude, lng: selectedStation.longitude }}
                onCloseClick={() => handleStationSelect(null)}
                headerDisabled={true}
              >
                <div className="p-4 min-w-[280px] glass-card !bg-white !shadow-none !border-none">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${selectedStation.powerKW && selectedStation.powerKW >= 150 ? 'bg-red-500' :
                        selectedStation.powerKW && selectedStation.powerKW >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                      <span className="font-bold text-midnight text-sm tracking-tight">{selectedStation.title}</span>
                    </div>
                    {selectedStation.isRecommended && (
                      <span className="bg-neon-blue/10 text-neon-blue px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-neon-blue/20">
                        Top Pick
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-500 mb-4 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
                    <span className="line-clamp-2">{selectedStation.address || 'Loading address details...'}</span>
                  </div>

                  {/* Dynamic Stats Row */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-midnight/[0.03] p-2 rounded-lg border border-black/5">
                      <div className="text-[9px] text-gray-400 font-bold uppercase mb-1">Status</div>
                      <div className="text-xs font-bold text-midnight">
                        {selectedStation.availableConnectors !== undefined ? (
                          <span className={selectedStation.availableConnectors > 0 ? 'text-green-600' : 'text-red-500'}>
                            {selectedStation.availableConnectors}/{selectedStation.totalConnectors} Available
                          </span>
                        ) : 'Live status: 3/5 available'}
                      </div>
                    </div>
                    <div className="bg-midnight/[0.03] p-2 rounded-lg border border-black/5">
                      <div className="text-[9px] text-gray-400 font-bold uppercase mb-1">Charge Time</div>
                      <div className="text-xs font-bold text-indigo-600">
                        {selectedStation.chargeTime || 30} mins recommended
                      </div>
                    </div>
                  </div>

                  {/* AI & Travel Info */}
                  <div className="mb-4 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                      <div className="space-y-1.5">
                        {selectedStation.arrivalSOC !== undefined && (
                          <div className="text-[10px] font-bold text-indigo-700">
                            Arrives with {selectedStation.arrivalSOC}% Battery
                          </div>
                        )}
                        {loadingDesc ? (
                          <div className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> generating summary...
                          </div>
                        ) : (
                          <p className="text-[11px] text-midnight leading-relaxed font-medium italic opacity-80">
                            "{stopDescription}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-5 opacity-80">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                      🍴 Food
                    </span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                      🚻 Restroom
                    </span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                      📶 WiFi
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="flex-1 bg-midnight text-white text-xs py-2.5 rounded-xl font-bold hover:bg-midnight/90 transition-all flex items-center justify-center gap-2"
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedStation.latitude},${selectedStation.longitude}`, '_blank')}
                    >
                      <Navigation className="w-3.5 h-3.5" /> Start
                    </button>
                    <button
                      className="px-4 bg-white border border-midnight/10 text-midnight text-xs py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-1"
                      onClick={() => alert('Station added to route optimization')}
                    >
                      Add Stop
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Incident Info Window */}
            {selectedIncident && (
              <InfoWindow
                position={{ lat: selectedIncident.location.latitude, lng: selectedIncident.location.longitude }}
                onCloseClick={() => setSelectedIncident(null)}
                headerDisabled={true}
              >
                <div className="p-4 min-w-[260px] glass-card !bg-white !shadow-none !border-none">
                  <div className="flex items-center gap-2 mb-3 text-orange-600">
                    {selectedIncident.type === 'construction' ? <Construction className="w-5 h-5" /> :
                      selectedIncident.type === 'accident' ? <Car className="w-5 h-5" /> :
                        selectedIncident.type === 'weather' ? <CloudRain className="w-5 h-5" /> :
                          <AlertTriangle className="w-5 h-5" />}
                    <span className="font-bold text-sm tracking-tight capitalize">{selectedIncident.type}</span>
                  </div>

                  <p className="text-xs text-midnight font-medium leading-relaxed mb-4">
                    {selectedIncident.description}
                  </p>

                  {selectedIncident.avoidanceMetrics && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-bold text-indigo-900 uppercase">Avoidance Strategy</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-[10px]">
                          <span className="text-gray-500">Alt Route:</span>
                          <span className="block font-bold text-red-600">+{selectedIncident.avoidanceMetrics.extraTime} mins</span>
                        </div>
                        <div className="text-[10px]">
                          <span className="text-gray-500">Savings:</span>
                          <span className="block font-bold text-green-600">${selectedIncident.avoidanceMetrics.costSaving.toFixed(2)}</span>
                        </div>
                      </div>
                      <button
                        className="w-full mt-3 bg-white border border-indigo-200 text-indigo-600 text-[10px] py-1.5 rounded-lg font-bold hover:bg-indigo-50 transition-colors"
                        onClick={() => alert('Recalculating route to avoid incident...')}
                      >
                        Recalculate to Avoid
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedIncident.severity === 'severe' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                      {selectedIncident.severity} Impact
                    </span>
                    {selectedIncident.delayMinutes && (
                      <span className="text-red-600 font-bold text-[10px]">-{selectedIncident.delayMinutes}m E.T.A</span>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Segment Info Window */}
            {selectedSegment && (
              <InfoWindow
                position={{
                  lat: selectedSegment.points[Math.floor(selectedSegment.points.length / 2)][0],
                  lng: selectedSegment.points[Math.floor(selectedSegment.points.length / 2)][1]
                }}
                onCloseClick={() => setSelectedSegment(null)}
                headerDisabled={true}
              >
                <div className="p-4 min-w-[300px] glass-card !bg-white !shadow-none !border-none">
                  <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                    <div className="bg-indigo-500/10 p-2 rounded-lg">
                      <Activity className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none mb-1">Trip Segment</div>
                      <div className="text-xs font-bold text-midnight truncate max-w-[180px]">
                        {selectedSegment.startLabel} <span className="text-gray-300 mx-1">→</span> {selectedSegment.endLabel}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-indigo-500" />
                        <div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">Avg Speed</div>
                          <div className="text-[11px] font-bold text-midnight">{selectedSegment.speedLimit || 65} mph</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Navigation className={`w-3.5 h-3.5 ${selectedSegment.trafficLevel === 'heavy' ? 'text-red-500' :
                          selectedSegment.trafficLevel === 'moderate' ? 'text-yellow-500' : 'text-green-500'
                          }`} />
                        <div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">Traffic</div>
                          <div className="text-[11px] font-bold text-midnight capitalize">{selectedSegment.trafficLevel || 'Low'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-orange-500" />
                        <div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">Efficiency</div>
                          <div className="text-[11px] font-bold text-midnight">{selectedSegment.efficiency} kWh/mi</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                        <div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">SoC Change</div>
                          <div className="text-[11px] font-bold text-midnight">{selectedSegment.startSoC}% → {selectedSegment.endSoC}%</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CloudSun className="w-3.5 h-3.5 text-blue-500" />
                        <div>
                          <div className="text-[8px] font-bold text-gray-400 uppercase">Weather</div>
                          <div className="text-[11px] font-bold text-midnight truncate max-w-[80px]">{selectedSegment.weather}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <ElevationProfile distance={selectedSegment.distance} className="mt-2" />

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
                      <Wind className="w-3.5 h-3.5" />
                      <span>Headwind: 5mph</span>
                    </div>
                    <button
                      onClick={() => setSelectedSegment(null)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                    >
                      Close Details
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map >

          {/* Map Controls */}
          {/* Map Controls - Floating Dock */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-surface-highlight/90 backdrop-blur-xl p-1.5 rounded-full border border-white/10 shadow-2xl z-20">
            <button
              onClick={() => setShowWeather(!showWeather)}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${showWeather ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                  `}
              title="Weather & Env Overlay"
            >
              <CloudSun className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowTraffic(!showTraffic)}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${showTraffic ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                  `}
              title="Traffic"
            >
              <Navigation className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>

            <button
              onClick={() => setMapType(mapType === 'roadmap' ? 'hybrid' : 'roadmap')}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${mapType === 'hybrid' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                   `}
              title="Satellite"
            >
              <Layers className="w-5 h-5" />
            </button>

            <button
              onClick={fitRouteBounds}
              className="p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 text-gray-400 hover:text-white hover:bg-white/10"
              title="Fit Route to Map"
            >
              <ArrowRightLeft className="w-5 h-5 rotate-90" />
            </button>

            <button
              onClick={() => {
                setTilt(tilt === 0 ? 45 : 0);
                setHeading(heading === 0 ? 90 : 0);
              }}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${tilt > 0 ? 'bg-purple-500/20 text-neon-purple' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                  `}
              title="3D Mode"
            >
              <Mountain className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-white/10 mx-1"></div>

            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${showLegend ? 'bg-neon-blue/20 text-neon-blue' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                  `}
              title="Map Legend"
            >
              <Info className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsMeasuring(!isMeasuring)}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${isMeasuring ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                  `}
              title="Measure Distance"
            >
              <Activity className="w-5 h-5" />
            </button>

            <button
              onClick={toggleFullscreen}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 text-gray-400 hover:text-white hover:bg-white/10`}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <X className="w-5 h-5" /> : <Layers className="w-5 h-5 rotate-45" />}
            </button>

            <button
              onClick={() => setIsFlying(!isFlying)}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${isFlying ? 'bg-neon-green text-surface' : 'bg-white text-surface hover:bg-white/90'}
                  `}
              title={isFlying ? "Pause" : "Flyover"}
            >
              {isFlying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {isFlying && (
              <div className="flex bg-white/5 rounded-full p-1 ml-1 border border-white/10">
                {[1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setFlyoverSpeed(speed as any)}
                    className={`px-2 py-1 rounded-full text-[9px] font-black transition-all ${flyoverSpeed === speed ? 'bg-white text-midnight' : 'text-gray-400 hover:text-white'
                      }`}
                  >
                    {speed}X
                  </button>
                ))}
              </div>
            )}

            {onFindNearby && (
              <>
                {/* Cached Indicator */}
                {isCached && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30 text-[10px] font-bold animate-in fade-in slide-in-from-left duration-500 mr-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Cached
                  </div>
                )}
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <button
                  onClick={onFindNearby}
                  className="p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30"
                  title="Find Nearby Chargers"
                >
                  <Zap className="w-5 h-5 fill-current" />
                </button>
              </>
            )}
          </div>

          {/* Overlay when flying */}
          {
            isFlying && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium animate-pulse border border-white/10 z-30">
                ✈️ Simulating Route...
              </div>
            )
          }
        </APIProvider >
      </div >
    </div >
  );
}
