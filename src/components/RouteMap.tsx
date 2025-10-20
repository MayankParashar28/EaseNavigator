import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Map, MapPin, Zap, Loader2, AlertCircle, Navigation, ExternalLink, Phone, Globe, Clock, Battery, Star, DollarSign, Users, Wifi, Car, Shield, Sun, TreePine, Coffee, ShoppingBag, Layers, Maximize2, RotateCcw, Filter, Search, Settings, Mountain, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import { chargingStationService, ProcessedChargingStation } from '../lib/chargingStations';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Legacy interface for backward compatibility
interface Station {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
  address?: string;
  powerKW?: number;
  connectionType?: string;
  network?: string;
}

interface RouteMapProps {
  route: { geometry?: [number, number][], distance: number, chargingStops: number };
  origin: string;
  destination: string;
  originCoords?: [number, number];
  destinationCoords?: [number, number];
  stations?: Station[];
  useOpenCharge?: boolean; // New prop to enable OpenChargeMap integration
}

const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const chargingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const fastChargingIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapBounds({ positions, autoZoom, show3D }: { positions: [number, number][], autoZoom: boolean, show3D: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0 && autoZoom) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { 
        padding: show3D ? [100, 100] : [50, 50],
        maxZoom: show3D ? 12 : 15
      });
      
      // Add smooth zoom animation
      setTimeout(() => {
        if (show3D) {
          map.setZoom(Math.min(map.getZoom() + 1, 12));
        }
      }, 500);
    }
  }, [positions, map, autoZoom, show3D]);

  return null;
}

function MapController({ 
  onMapReady, 
  show3D, 
  showElevation, 
  pathThickness 
}: { 
  onMapReady: (map: L.Map) => void;
  show3D: boolean;
  showElevation: boolean;
  pathThickness: number;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
    
    // Add 3D terrain effect
    if (show3D) {
      map.getContainer().style.filter = 'contrast(1.1) brightness(1.05) saturate(1.2)';
      map.getContainer().style.transform = 'perspective(1000px) rotateX(5deg)';
    } else {
      map.getContainer().style.filter = 'none';
      map.getContainer().style.transform = 'none';
    }
  }, [map, show3D, onMapReady]);

  // Add elevation visualization
  useEffect(() => {
    if (showElevation && map) {
      // Add elevation contours (simplified)
      const elevationLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenTopoMap',
        opacity: 0.3
      });
      
      if (showElevation) {
        elevationLayer.addTo(map);
      } else {
        map.removeLayer(elevationLayer);
      }
    }
  }, [map, showElevation]);

  return null;
}

export default function RouteMap({ route, origin, destination, originCoords: originProp, destinationCoords: destinationProp, stations = [], useOpenCharge = false }: RouteMapProps) {
  const [openChargeStations, setOpenChargeStations] = useState<ProcessedChargingStation[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [stationError, setStationError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(7);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  const [filterFastCharge, setFilterFastCharge] = useState(false);
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [routeAnimation, setRouteAnimation] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [autoZoom, setAutoZoom] = useState(false);
  const [pathThickness, setPathThickness] = useState(6);
  const [showElevation, setShowElevation] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const originCoords: [number, number] = originProp || (route.geometry && route.geometry[0]) || [37.7749, -122.4194];
  const destinationCoords: [number, number] = destinationProp || (route.geometry && route.geometry[route.geometry.length - 1]) || [34.0522, -118.2437];

  // Calculate map center and bounds
  useEffect(() => {
    if (originCoords && destinationCoords) {
      const center: [number, number] = [
        (originCoords[0] + destinationCoords[0]) / 2,
        (originCoords[1] + destinationCoords[1]) / 2
      ];
      setMapCenter(center);
    }
  }, [originCoords, destinationCoords]);

  // Route animation effect
  useEffect(() => {
    if (route.geometry && route.geometry.length > 0) {
      setRouteAnimation(true);
      const timer = setTimeout(() => setRouteAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [route.geometry]);

  // Handle map ready
  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
  };

  // Auto-zoom to route
  const handleAutoZoom = () => {
    if (mapRef.current && autoZoom) {
      const bounds = L.latLngBounds(allPositions);
      mapRef.current.fitBounds(bounds, { 
        padding: show3D ? [100, 100] : [50, 50],
        maxZoom: show3D ? 12 : 15
      });
    }
  };

  // Fetch charging stations from OpenChargeMap API
  useEffect(() => {
    if (useOpenCharge && route.geometry && route.geometry.length > 0) {
      setLoadingStations(true);
      setStationError(null);
      
      chargingStationService
        .getChargingStationsAlongRoute(route.geometry, 6.2) // 10km radius along route
        .then(stations => {
          setOpenChargeStations(stations);
          setLoadingStations(false);
        })
        .catch(error => {
          console.error('Error fetching charging stations:', error);
          setStationError('Failed to load charging stations');
          setLoadingStations(false);
        });
    }
  }, [useOpenCharge, route.geometry]);

  // Use OpenChargeMap data if available, otherwise fall back to legacy stations
  const allChargingStations = useOpenCharge && openChargeStations.length > 0 
    ? openChargeStations.map(s => ({
        coords: [s.latitude, s.longitude] as [number, number],
        title: s.title,
        power: s.powerKW ? `${s.powerKW} kW` : undefined,
        address: s.address,
        network: s.network,
        isFastCharge: s.isFastCharge,
        status: s.status,
        operator: s.operator,
        website: s.website,
        phone: s.phone,
        distance: s.distance,
        // Enhanced data
        availablePorts: s.availablePorts,
        totalPorts: s.totalPorts,
        estimatedWaitTime: s.estimatedWaitTime,
        pricing: s.pricing,
        amenities: s.amenities,
        accessibility: s.accessibility,
        reviews: s.reviews,
        environmentalImpact: s.environmentalImpact,
        lastUpdated: s.lastUpdated,
      }))
    : stations.map(s => ({
        coords: [s.latitude, s.longitude] as [number, number],
    title: s.title,
    power: s.powerKW ? `${s.powerKW} kW` : undefined,
    address: s.address,
    network: s.network,
        isFastCharge: false,
        status: 'Unknown',
        operator: undefined,
        website: undefined,
        phone: undefined,
        distance: 0,
        // Default enhanced data
        availablePorts: 1,
        totalPorts: 1,
        estimatedWaitTime: undefined,
        pricing: undefined,
        amenities: undefined,
        accessibility: undefined,
        reviews: undefined,
        environmentalImpact: undefined,
        lastUpdated: undefined,
  }));

  // Filter stations based on user preferences
  const chargingStations = filterFastCharge 
    ? allChargingStations.filter(s => s.isFastCharge)
    : allChargingStations;

  const routePath: [number, number][] = route.geometry && route.geometry.length > 1
    ? route.geometry
    : [
        originCoords,
        ...chargingStations.map(s => s.coords),
        destinationCoords,
      ];

  const allPositions = [originCoords, destinationCoords, ...routePath];

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      <style jsx>{`
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
          padding: 0;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .route-animation {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawRoute 2s ease-in-out forwards;
        }
        @keyframes drawRoute {
          to {
            stroke-dashoffset: 0;
          }
        }
        .pulse-marker {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        .map-controls {
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.9);
        }
        .route-path {
          filter: drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3));
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .route-path-3d {
          filter: drop-shadow(0 6px 12px rgba(16, 185, 129, 0.4)) brightness(1.1);
        }
        .elevation-contour {
          stroke: #8b5cf6;
          stroke-width: 1;
          stroke-dasharray: 2,2;
          opacity: 0.6;
        }
        .terrain-3d {
          transform: perspective(1000px) rotateX(5deg);
          filter: contrast(1.1) brightness(1.05) saturate(1.2);
        }
      `}</style>
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-cyan-600/20"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Map className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Interactive Route Map</h3>
              <p className="text-emerald-100 text-sm">Real-time charging stations & traffic</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShow3D(!show3D)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                show3D 
                  ? 'bg-purple-500 text-white shadow-lg' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Mountain className="w-4 h-4 inline mr-1" />
              3D View
            </button>
            <button
              onClick={() => setFilterFastCharge(!filterFastCharge)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                filterFastCharge 
                  ? 'bg-orange-500 text-white shadow-lg' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Zap className="w-4 h-4 inline mr-1" />
              Fast Only
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-xl overflow-hidden shadow-inner mb-6 relative" style={{ height: isFullscreen ? 'calc(100vh - 200px)' : '500px' }}>
          {/* Enhanced Map Controls Overlay */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-col space-y-2">
            <div className="map-controls rounded-lg p-2 shadow-lg border border-white/20">
              <button
                onClick={() => setShowSatellite(!showSatellite)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  showSatellite ? 'bg-blue-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'
                }`}
                title="Toggle Satellite View"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowTraffic(!showTraffic)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  showTraffic ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'
                }`}
                title="Toggle Traffic Layer"
              >
                <Navigation className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowElevation(!showElevation)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  showElevation ? 'bg-purple-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'
                }`}
                title="Toggle Elevation Contours"
              >
                <Mountain className="w-4 h-4" />
              </button>
              <button
                onClick={handleAutoZoom}
                className="p-2 rounded-lg bg-white/80 text-gray-700 hover:bg-white transition-all duration-200"
                title="Auto Zoom to Route"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setMapCenter([(originCoords[0] + destinationCoords[0]) / 2, (originCoords[1] + destinationCoords[1]) / 2]);
                  setMapZoom(7);
                }}
                className="p-2 rounded-lg bg-white/80 text-gray-700 hover:bg-white transition-all duration-200"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            
            {/* Path Thickness Control */}
            <div className="map-controls rounded-lg p-3 shadow-lg border border-white/20">
              <div className="text-xs font-medium text-gray-700 mb-2">Path Thickness</div>
              <input
                type="range"
                min="2"
                max="12"
                value={pathThickness}
                onChange={(e) => setPathThickness(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">{pathThickness}px</div>
            </div>
          </div>

          <MapContainer
            center={mapCenter || [(originCoords[0] + destinationCoords[0]) / 2, (originCoords[1] + destinationCoords[1]) / 2]}
            zoom={mapZoom}
            className={`h-full w-full ${show3D ? 'terrain-3d' : ''}`}
            zoomControl={false}
          >
            {/* Base Map Layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={showSatellite 
                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
            />

            {/* Elevation Contour Layer */}
            {showElevation && (
              <TileLayer
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution="OpenTopoMap"
                opacity={0.3}
              />
            )}

            {/* Traffic Layer */}
            {showTraffic && (
              <TileLayer
                url="https://{s}.google.com/vt/lyrs=m@221097413,traffic&x={x}&y={y}&z={z}"
                attribution="Google Traffic"
              />
            )}

            <MapBounds positions={allPositions} autoZoom={false} show3D={show3D} />
            <MapController 
              onMapReady={handleMapReady}
              show3D={show3D}
              showElevation={showElevation}
              pathThickness={pathThickness}
            />

            {/* Enhanced Route Line with 3D Effects */}
            <Polyline
              positions={routePath}
              color={show3D ? "#059669" : (routeAnimation ? "#10b981" : "#059669")}
              weight={show3D ? pathThickness + 2 : pathThickness}
              opacity={show3D ? 0.9 : (routeAnimation ? 0.9 : 0.8)}
              className={`${routeAnimation ? "route-animation" : ""} ${show3D ? "route-path-3d" : "route-path"}`}
            />

            {/* Route Shadow for 3D Effect */}
            {show3D && (
              <Polyline
                positions={routePath}
                color="#000000"
                weight={pathThickness + 4}
                opacity={0.2}
                className="route-path"
                style={{ transform: 'translate(2px, 2px)' }}
              />
            )}

            {/* Enhanced Route Start/End Circles with 3D Effects */}
            <CircleMarker
              center={originCoords}
              radius={show3D ? 12 : 8}
              pathOptions={{
                color: show3D ? '#059669' : '#10b981',
                fillColor: show3D ? '#059669' : '#10b981',
                fillOpacity: show3D ? 0.9 : 0.8,
                weight: show3D ? 4 : 3
              }}
              className={show3D ? "pulse-marker" : ""}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="text-center">
                  <div className="font-bold text-emerald-700">Start</div>
                  <div className="text-sm text-gray-600">{origin}</div>
                </div>
              </Tooltip>
            </CircleMarker>

            <CircleMarker
              center={destinationCoords}
              radius={show3D ? 12 : 8}
              pathOptions={{
                color: show3D ? '#b91c1c' : '#dc2626',
                fillColor: show3D ? '#b91c1c' : '#dc2626',
                fillOpacity: show3D ? 0.9 : 0.8,
                weight: show3D ? 4 : 3
              }}
              className={show3D ? "pulse-marker" : ""}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div className="text-center">
                  <div className="font-bold text-red-700">Destination</div>
                  <div className="text-sm text-gray-600">{destination}</div>
                </div>
              </Tooltip>
            </CircleMarker>

            <Marker position={originCoords} icon={originIcon}>
              <Popup>
                <div className="p-2">
                  <div className="font-bold text-emerald-700 mb-1">Origin</div>
                  <div className="text-sm">{origin}</div>
                </div>
              </Popup>
            </Marker>

            <Marker position={destinationCoords} icon={destinationIcon}>
              <Popup>
                <div className="p-2">
                  <div className="font-bold text-red-700 mb-1">Destination</div>
                  <div className="text-sm">{destination}</div>
                </div>
              </Popup>
            </Marker>

            {chargingStations.map((station, index) => (
              <Marker 
                key={index} 
                position={station.coords} 
                icon={station.isFastCharge ? fastChargingIcon : chargingIcon}
                eventHandlers={{
                  click: () => setSelectedStation(selectedStation === index ? null : index),
                  mouseover: () => setSelectedStation(index),
                  mouseout: () => setSelectedStation(null)
                }}
              >
                <Popup maxWidth={500} className="custom-popup">
                  <div className="p-4 min-w-[400px]">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${station.isFastCharge ? 'bg-orange-500' : 'bg-yellow-500'}`}></div>
                        <div className="font-bold text-gray-900 text-base">
                          {station.isFastCharge ? 'Fast Charging Station' : 'Charging Station'}
                        </div>
                      </div>
                      <div className="text-right">
                        {station.distance > 0 && (
                          <div className="text-xs text-gray-500">
                            {station.distance.toFixed(1)} km away
                          </div>
                        )}
                        {station.lastUpdated && (
                          <div className="text-xs text-gray-400">
                            Updated {new Date(station.lastUpdated).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Station Name & Rating */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-lg font-semibold text-gray-900">{station.title}</div>
                      {station.reviews && (
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium text-gray-700">{station.reviews.averageRating}</span>
                          <span className="text-xs text-gray-500">({station.reviews.totalReviews})</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Address */}
                    {station.address && (
                      <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-gray-700">{station.address}</div>
                        </div>
                      </div>
                    )}

                    {/* Availability & Wait Time */}
                    {station.availablePorts !== undefined && (
                      <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Battery className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                              {station.availablePorts}/{station.totalPorts} ports available
                            </span>
                          </div>
                          {station.estimatedWaitTime && (
                            <div className="flex items-center space-x-1 text-sm text-orange-600">
                              <Clock className="w-3 h-3" />
                              <span>{station.estimatedWaitTime} min wait</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Station Details Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {station.network && (
                        <div className="bg-blue-50 p-2 rounded-lg">
                          <div className="text-xs font-medium text-blue-700 mb-1">Network</div>
                          <div className="text-sm text-blue-900">{station.network}</div>
                        </div>
                      )}
                      {station.operator && (
                        <div className="bg-green-50 p-2 rounded-lg">
                          <div className="text-xs font-medium text-green-700 mb-1">Operator</div>
                          <div className="text-sm text-green-900">{station.operator}</div>
                        </div>
                      )}
                    {station.power && (
                        <div className="bg-yellow-50 p-2 rounded-lg">
                          <div className="text-xs font-medium text-yellow-700 mb-1">Power</div>
                          <div className="text-sm text-yellow-900 font-semibold">{station.power}</div>
                        </div>
                      )}
                      {station.status && (
                        <div className={`p-2 rounded-lg ${
                          station.status === 'Operational' 
                            ? 'bg-green-50' 
                            : 'bg-gray-50'
                        }`}>
                          <div className={`text-xs font-medium mb-1 ${
                            station.status === 'Operational' 
                              ? 'text-green-700' 
                              : 'text-gray-700'
                          }`}>Status</div>
                          <div className={`text-sm ${
                            station.status === 'Operational' 
                              ? 'text-green-900' 
                              : 'text-gray-900'
                          }`}>{station.status}</div>
                        </div>
                      )}
                    </div>

                    {/* Pricing */}
                    {station.pricing && (
                      <div className="mb-3 p-2 bg-green-50 rounded-lg">
                        <div className="text-xs font-medium text-green-700 mb-1 flex items-center space-x-1">
                          <DollarSign className="w-3 h-3" />
                          <span>Pricing</span>
                        </div>
                        <div className="text-sm text-green-900">
                          ${station.pricing.perKWh}/kWh
                          {station.pricing.perMinute && ` • $${station.pricing.perMinute}/min`}
                          {station.pricing.sessionFee > 0 && ` • $${station.pricing.sessionFee} session fee`}
                        </div>
                      </div>
                    )}

                    {/* Amenities */}
                    {station.amenities && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-700 mb-2">Amenities</div>
                        <div className="flex flex-wrap gap-1">
                          {station.amenities.restrooms && (
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                              <span>🚻</span>
                              <span>Restrooms</span>
                            </span>
                          )}
                          {station.amenities.foodNearby && (
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                              <Coffee className="w-3 h-3" />
                              <span>Food</span>
                            </span>
                          )}
                          {station.amenities.shopping && (
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                              <ShoppingBag className="w-3 h-3" />
                              <span>Shopping</span>
                            </span>
                          )}
                          {station.amenities.wifi && (
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                              <Wifi className="w-3 h-3" />
                              <span>WiFi</span>
                            </span>
                          )}
                          {station.amenities.covered && (
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                              <span>🏢</span>
                              <span>Covered</span>
                            </span>
                          )}
                          {station.amenities.security && (
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs flex items-center space-x-1">
                              <Shield className="w-3 h-3" />
                              <span>Security</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Environmental Impact */}
                    {station.environmentalImpact && (
                      <div className="mb-3 p-2 bg-emerald-50 rounded-lg">
                        <div className="text-xs font-medium text-emerald-700 mb-1 flex items-center space-x-1">
                          <TreePine className="w-3 h-3" />
                          <span>Environmental Impact</span>
                        </div>
                        <div className="text-sm text-emerald-900">
                          Saves {station.environmentalImpact.co2Saved}kg CO₂ • 
                          {station.environmentalImpact.renewablePercentage}% renewable • 
                          {station.environmentalImpact.equivalentTrees} trees equivalent
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {station.isFastCharge && (
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
                          <Zap className="w-3 h-3" />
                          <span>Fast Charge</span>
                        </span>
                      )}
                      {station.totalPorts > 1 && (
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
                          <Battery className="w-3 h-3" />
                          <span>{station.totalPorts} Ports</span>
                        </span>
                      )}
                      {station.accessibility?.wheelchairAccessible && (
                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
                          <Car className="w-3 h-3" />
                          <span>Accessible</span>
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 mb-3">
                      <button
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;
                          window.open(url, '_blank');
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Get Directions</span>
                      </button>
                      
                      {station.website && (
                        <button
                          onClick={() => window.open(station.website, '_blank')}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Contact Info */}
                    {(station.phone || station.website) && (
                      <div className="border-t border-gray-200 pt-3">
                        <div className="text-xs font-medium text-gray-700 mb-2">Contact Information</div>
                        <div className="space-y-1">
                          {station.phone && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${station.phone}`} className="hover:text-blue-600">
                                {station.phone}
                              </a>
                            </div>
                          )}
                          {station.website && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Globe className="w-3 h-3" />
                              <a 
                                href={station.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 truncate"
                              >
                                Visit Website
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Enhanced Stats Grid with Animations */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-emerald-700">Total Distance</div>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-emerald-900">{route.distance} mi</div>
            <div className="text-xs text-emerald-600 mt-1">Route optimized</div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-50 via-yellow-100 to-yellow-200 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-yellow-700 flex items-center space-x-2">
                <span>Charging Stations</span>
                {loadingStations && <Loader2 className="w-4 h-4 animate-spin" />}
                {stationError && <AlertCircle className="w-4 h-4 text-red-500" />}
              </div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-yellow-900">
              {useOpenCharge ? openChargeStations.length : route.chargingStops}
            </div>
            {useOpenCharge && (
              <div className="text-xs text-yellow-600 mt-1">
                {openChargeStations.filter(s => s.isFastCharge).length} fast • 
                {openChargeStations.filter(s => s.availablePorts && s.availablePorts > 0).length} available
              </div>
            )}
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-blue-700">Est. Charging Time</div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {useOpenCharge ? 
                (openChargeStations.length * 15) : 
                (route.chargingStops * 20)
              } min
            </div>
            {useOpenCharge && (
              <div className="text-xs text-blue-600 mt-1">
                Based on real stations
              </div>
            )}
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-purple-700 flex items-center space-x-1">
                <Star className="w-4 h-4" />
                <span>Avg Rating</span>
              </div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {useOpenCharge && openChargeStations.length > 0 ? 
                (openChargeStations.reduce((sum, s) => sum + (s.reviews?.averageRating || 0), 0) / openChargeStations.length).toFixed(1) : 
                'N/A'
              }
            </div>
            {useOpenCharge && (
              <div className="text-xs text-purple-600 mt-1">
                {openChargeStations.reduce((sum, s) => sum + (s.reviews?.totalReviews || 0), 0)} total reviews
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Charging Stations Along Route</span>
            {useOpenCharge && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Live Data
              </span>
            )}
          </h4>
          
          {loadingStations && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-blue-600">Loading charging stations...</span>
            </div>
          )}
          
          {stationError && (
            <div className="flex items-center justify-center py-8 text-red-600">
              <AlertCircle className="w-6 h-6 mr-2" />
              <span>{stationError}</span>
            </div>
          )}
          
          {!loadingStations && !stationError && (
          <div className="space-y-3">
              {chargingStations.slice(0, useOpenCharge ? 15 : route.chargingStops).map((station, index) => (
                <div 
                  key={index} 
                  className="bg-white rounded-lg p-4 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer border border-gray-200 hover:border-emerald-300"
                  onClick={() => {
                    // Open Google Maps directions
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;
                    window.open(url, '_blank');
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${station.isFastCharge ? 'bg-orange-500' : 'bg-yellow-500'}`}></div>
                        <div className="font-semibold text-gray-900 text-sm">{station.title}</div>
                        {station.isFastCharge && (
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-semibold">
                            Fast
                          </span>
                        )}
                        {station.reviews && (
                          <div className="flex items-center space-x-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-xs text-gray-600">{station.reviews.averageRating}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-600 mb-2 line-clamp-2">{station.address}</div>
                      
                      {/* Enhanced info row */}
                      <div className="flex items-center space-x-3 text-xs text-gray-500 mb-2">
                        {station.network && <span>📡 {station.network}</span>}
                        {station.distance > 0 && <span>📍 {station.distance.toFixed(1)} km</span>}
                        {station.totalPorts > 1 && <span>🔌 {station.totalPorts} ports</span>}
                        {station.availablePorts !== undefined && (
                          <span className={`px-1 py-0.5 rounded text-xs ${
                            station.availablePorts > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {station.availablePorts} available
                          </span>
                        )}
                      </div>
                      
                      {/* Pricing and amenities */}
                      <div className="flex items-center space-x-2 mb-2">
                        {station.pricing && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            ${station.pricing.perKWh}/kWh
                          </span>
                        )}
                        {station.amenities && (
                          <div className="flex space-x-1">
                            {station.amenities.wifi && <span className="text-xs">📶</span>}
                            {station.amenities.restrooms && <span className="text-xs">🚻</span>}
                            {station.amenities.foodNearby && <span className="text-xs">🍕</span>}
                            {station.amenities.covered && <span className="text-xs">🏢</span>}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {station.status && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            station.status === 'Operational' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {station.status}
                          </span>
                        )}
                        {station.power && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">
                            {station.power}
                          </span>
                        )}
                        {station.estimatedWaitTime && (
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                            {station.estimatedWaitTime}min wait
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-3 flex flex-col items-end space-y-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;
                          window.open(url, '_blank');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Directions</span>
                      </button>
                      
                      {station.website && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(station.website, '_blank');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Website</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Enhanced footer info */}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                <div>
                        {station.operator && <span><span className="font-medium">Operator:</span> {station.operator}</span>}
                      </div>
                      {station.environmentalImpact && (
                        <div className="flex items-center space-x-1">
                          <TreePine className="w-3 h-3 text-emerald-600" />
                          <span>{station.environmentalImpact.co2Saved}kg CO₂ saved</span>
                        </div>
                      )}
                </div>
                  </div>
                </div>
              ))}
              
              {useOpenCharge && chargingStations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No charging stations found along this route</p>
                  <p className="text-sm">Try expanding your search radius</p>
              </div>
              )}
          </div>
          )}
        </div>

        {/* Enhanced Footer with Interactive Features */}
        <div className="mt-6 bg-gradient-to-r from-slate-50 to-gray-100 rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Map className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800">Interactive Features</h4>
                <p className="text-sm text-slate-600">Click, hover, and explore your route</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShow3D(!show3D)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  show3D 
                    ? 'bg-purple-500 text-white shadow-lg' 
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                <Mountain className="w-4 h-4 inline mr-1" />
                3D View
              </button>
              <button
                onClick={() => setShowSatellite(!showSatellite)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  showSatellite 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                <Layers className="w-4 h-4 inline mr-1" />
                Satellite
              </button>
              <button
                onClick={() => setShowTraffic(!showTraffic)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  showTraffic 
                    ? 'bg-red-500 text-white shadow-lg' 
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                <Navigation className="w-4 h-4 inline mr-1" />
                Traffic
              </button>
              <button
                onClick={handleAutoZoom}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
              >
                <ZoomIn className="w-4 h-4 inline mr-1" />
                Auto Zoom
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2 text-slate-600">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>Click markers for details</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Hover for quick info</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>3D terrain visualization</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>Auto-zoom to route</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
