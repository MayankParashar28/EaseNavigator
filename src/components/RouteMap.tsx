import { useEffect, useState, useCallback } from 'react';
import {
  APIProvider,
  Map,
  useMapsLibrary,
  useMap,
  AdvancedMarker,
  Pin,
  InfoWindow
} from '@vis.gl/react-google-maps';
import { Zap, Navigation, Layers, Mountain, Play, Pause, Sparkles, Loader2 } from 'lucide-react';
import { generateStopDescription } from '../lib/ai';

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
}

interface RouteMapProps {
  route: { geometry?: [number, number][], distance: number, chargingStops: number };
  origin: string;
  destination: string;
  originCoords?: [number, number];
  destinationCoords?: [number, number];
  stations?: Station[];
  useOpenCharge?: boolean;
  onFindNearby?: () => void;
}

// Map ID is required for Advanced Markers and Vector Maps (3D)
// This is a demo map ID that usually supports vector maps. 
// For production, the user should create their own Map ID in Google Cloud Console with "Vector" selected.
const MAP_ID = 'bf51a910020fa25a';

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
        strokeWeight: 6,
        strokeOpacity: 0.9,
      }
    }));
  }, [routesLibrary, map]);

  // Calculate Route
  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

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

  }, [directionsService, directionsRenderer, origin, destination]);

  return null;
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
  onStop
}: {
  routeGeometry: [number, number][],
  isPlaying: boolean,
  onStop: () => void
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !isPlaying || !routeGeometry || routeGeometry.length < 2) return;

    let startTime: number | null = null;
    const duration = 15000; // 15 seconds flyover
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

      // Interpolate between p1 and p2
      const segmentProgress = (progress * (totalPoints - 1)) - currentIndex;

      const lat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
      const lng = p1[1] + (p2[1] - p1[1]) * segmentProgress;

      // Calculate bearing
      const dy = p2[0] - p1[0];
      const dx = Math.cos(Math.PI / 180 * p1[0]) * (p2[1] - p1[1]);
      const angle = Math.atan2(dy, dx);
      let heading = angle * 180 / Math.PI;
      heading = 90 - heading;

      map.moveCamera({
        center: { lat, lng },
        zoom: 16,
        tilt: 60,
        heading: heading
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [map, isPlaying, routeGeometry, onStop]);

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

export default function RouteMap({ origin, destination, originCoords, destinationCoords, stations = [], route, onFindNearby }: RouteMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [showTraffic, setShowTraffic] = useState(false);
  const [isFlying, setIsFlying] = useState(false); // Playback state
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [stopDescription, setStopDescription] = useState<string>('');
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [tilt, setTilt] = useState(45); // Start with a 3D tilt
  const [heading, setHeading] = useState(0);
  // Use string literal to avoid "google is not defined" error before API loads
  const [mapType, setMapType] = useState<string>('roadmap');

  const handleStopFlying = useCallback(() => setIsFlying(false), []);

  const start = originCoords ? { lat: originCoords[0], lng: originCoords[1] } : { lat: 37.7749, lng: -122.4194 };
  const end = destinationCoords ? { lat: destinationCoords[0], lng: destinationCoords[1] } : { lat: 34.0522, lng: -118.2437 };
  const center = { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden h-[600px] flex flex-col relative group">
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
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={true}
            zoomControl={true}
            scaleControl={true}
            className="w-full h-full"
            onHeadingChanged={(ev) => !isFlying && setHeading(ev.detail.heading)}
            onTiltChanged={(ev) => !isFlying && setTilt(ev.detail.tilt)}
          >
            {/* Controller for manual 3D toggle */}
            {!isFlying && <Map3DController tilt={tilt} heading={heading} />}

            <Directions
              origin={start}
              destination={end}
            />

            <TrafficLayer show={showTraffic} />

            <FlyoverController
              routeGeometry={route?.geometry || []}
              isPlaying={isFlying}
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

            {/* Charging Stations */}
            {stations.map((station, i) => (
              <AdvancedMarker
                key={i}
                position={{ lat: station.latitude, lng: station.longitude }}
                onClick={async () => {
                  setSelectedStation(station);
                  setStopDescription('');
                  setLoadingDesc(true);
                  // Mock amenities based on random chance or station data if available
                  const amenities = ['Coffee', 'Restroom', 'WiFi'];
                  if (station.isFastCharge) amenities.push('Shopping Center');
                  const desc = await generateStopDescription(station.title, amenities);
                  setStopDescription(desc);
                  setLoadingDesc(false);
                }}
                zIndex={10}
              >
                <div className={`
                     p-1.5 rounded-full border-2 border-white shadow-xl transform transition-transform hover:scale-110
                     ${station.isFastCharge ? 'bg-orange-500' : 'bg-blue-500'}
                   `}>
                  <Zap className="w-4 h-4 text-white" fill="currentColor" />
                </div>
              </AdvancedMarker>
            ))}

            {/* Custom Info Window */}
            {selectedStation && (
              <InfoWindow
                position={{ lat: selectedStation.latitude, lng: selectedStation.longitude }}
                onCloseClick={() => setSelectedStation(null)}
                headerDisabled={true}
              >
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${selectedStation.isFastCharge ? 'bg-orange-500' : 'bg-blue-500'}`} />
                    <span className="font-bold text-gray-900 text-sm">{selectedStation.title}</span>
                  </div>

                  <div className="text-xs text-gray-500 mb-3 line-clamp-2">{selectedStation.address}</div>

                  {/* AI Description */}
                  <div className="mb-3 bg-gradient-to-br from-neon-purple/10 to-neon-blue/10 border border-neon-purple/20 rounded-lg p-2.5">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3 h-3 text-neon-purple mt-0.5 shrink-0" />
                      {loadingDesc ? (
                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          generating smart summary...
                        </div>
                      ) : (
                        <p className="text-[11px] font-medium text-gray-700 italic leading-snug">
                          "{stopDescription}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedStation.powerKW && (
                      <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        {selectedStation.powerKW} kW
                      </span>
                    )}
                    {selectedStation.network && (
                      <span className="bg-gray-50 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-medium">
                        {selectedStation.network}
                      </span>
                    )}
                  </div>

                  <button
                    className="w-full bg-blue-600 text-white text-xs py-2 rounded-md font-medium flex items-center justify-center gap-1 hover:bg-blue-700 transition-colors shadow-sm"
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedStation.latitude},${selectedStation.longitude}`, '_blank')}
                  >
                    <Navigation className="w-3 h-3" /> Get Directions
                  </button>
                </div>
              </InfoWindow>
            )}
          </Map>

          {/* Map Controls */}
          {/* Map Controls - Floating Dock */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-surface-highlight/90 backdrop-blur-xl p-1.5 rounded-full border border-white/10 shadow-2xl z-20">
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
              onClick={() => setIsFlying(!isFlying)}
              className={`p-3 rounded-full transition-all duration-300 hover:scale-105 active:scale-95
                    ${isFlying ? 'bg-neon-green text-surface' : 'bg-white text-surface hover:bg-white/90'}
                  `}
              title={isFlying ? "Pause" : "Flyover"}
            >
              {isFlying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {onFindNearby && (
              <>
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
          {isFlying && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium animate-pulse border border-white/10 z-30">
              ✈️ Simulating Route...
            </div>
          )}
        </APIProvider>
      </div>
    </div>
  );
}
