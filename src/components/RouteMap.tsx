import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { APIProvider, Map, useMapsLibrary, useMap, AdvancedMarker, Pin, InfoWindow, MapMouseEvent } from '@vis.gl/react-google-maps';
import { Zap, Navigation, Layers, Mountain, Play, Pause, Sparkles, Loader2, AlertTriangle, Construction, MapPin, CloudSun, Wind, Activity, Car, CloudRain, ArrowRightLeft, Info, X } from 'lucide-react';
import { generateStopDescription } from '../lib/ai';
import ElevationProfile from './trip-results/ElevationProfile';
import { clusterStations } from './route-map/clustering';
import type { Station, Incident, RouteWithGeom, RouteSegment } from './route-map/types';
import { MAP_ID, DARK_MAP_STYLE } from './route-map/mapStyle';
import { Directions, TrafficLayer, Map3DController, UserLocationMarker } from './route-map/MapLayers';
import { FlyoverController, SimulationHUD } from './route-map/Flyover';
import { MapTooltip, MapLegend } from './route-map/MapOverlays';
import { WeatherOverlay, MultiRouteDisplay, RouteSegments } from './route-map/RouteOverlays';

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
  const handleStationSelect = useCallback((s: Station | null) => {
    if (onSelectStation) onSelectStation(s);
    setInternalSelectedStation(s);
  }, [onSelectStation]);

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
      // Don't hijack arrow/+/- keys while the user is typing in a field
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

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
  }, [map, handleStationSelect]);

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
        try {
          localStorage.setItem('last_planned_route', JSON.stringify({
            route,
            stations,
            incidents,
            timestamp: Date.now()
          }));
          setIsCached(true);
        } catch {
          // Storage full or unavailable; offline cache is best-effort
        }
      }
    }
  }, [map, stations, route, originCoords, fitRouteBounds, incidents]);

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
  }, [isMeasuring, measurementLine]);

  const start = originCoords ? { lat: originCoords[0], lng: originCoords[1] } : { lat: 37.7749, lng: -122.4194 };
  const end = destinationCoords ? { lat: destinationCoords[0], lng: destinationCoords[1] } : { lat: 34.0522, lng: -118.2437 };
  const center = { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 };

  const clusters = useMemo(() => clusterStations(stations, zoom), [stations, zoom]);

  return (
    <div
      ref={mapContainerRef}
      className={`bg-white rounded-xl shadow-lg overflow-hidden flex flex-col relative group transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen rounded-none' : 'h-[450px] md:h-[600px]'
        }`}
    >
      {/* Header */}

      <div className="flex-1 relative map-mask-edges">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={11}
            defaultHeading={0}
            defaultTilt={0}
            {...(MAP_ID ? { mapId: MAP_ID } : { styles: DARK_MAP_STYLE })}
            mapTypeId={mapType}
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
              totalDistance={route?.distance || 150}
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
            {clusters.map((c, i) => {
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
                  onMouseEnter={(e) => {
                    // The library passes the native DOM event (not a MapMouseEvent).
                    const power = station.powerKW || 0;
                    if (e instanceof MouseEvent) {
                      setTooltip({
                        content: `${station.title} · ${power}kW · ${station.availableConnectors || 2}/5 free`,
                        pos: { x: e.clientX, y: e.clientY }
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
                  onMouseEnter={(e) => {
                    if (e instanceof MouseEvent) {
                      setTooltip({
                        content: `+${incident.delayMinutes || 15} min delay · ${incident.type.charAt(0).toUpperCase() + incident.type.slice(1)}`,
                        pos: { x: e.clientX, y: e.clientY }
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

                  <ElevationProfile distance={selectedSegment.distance} geometry={selectedSegment.points} className="mt-2" />

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
                {([1, 2, 4] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setFlyoverSpeed(speed)}
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

export type { Station, RouteWithGeom } from './route-map/types';
