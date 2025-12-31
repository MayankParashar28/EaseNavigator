import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';
import { EV_MODELS, type EVModel, getUserPreferences, saveTrip } from '../lib/localStorage';
import { LogOut, MapPin, Navigation, Battery, Loader2, History, AlertTriangle, Car, Menu, X } from 'lucide-react';
import TripResults from './TripResults';
import ErrorBoundary from './ErrorBoundary';
import UserPreferences from './UserPreferences';
import TripHistory from './TripHistory';
import NeuralAssistant from './NeuralAssistant';
import type { ParsedTripCommand } from '../lib/ai';
import { chargingStationService } from "../lib/chargingStations";
import { weatherService } from "../lib/weatherService";

interface TripPlannerProps {
  onSignOut: () => void;
}

interface TripFormData {
  origin: string;
  destination: string;
  evModelId: string;
  batteryPercent: number;
  useCurrentLocation: boolean;
  batteryHealth: number;
}

export default function TripPlanner({ onSignOut }: TripPlannerProps) {
  const { user } = useAuth();
  const [evModels, setEvModels] = useState<EVModel[]>([]);
  type LatLng = [number, number];
  type WeatherCondition = { temp: number; condition: string; airQuality: string };
  type RouteShape = {
    id: string;
    name: string;
    distance: number;
    duration: number;
    batteryUsage: number;
    chargingStops: number;
    weatherConditions: { start: WeatherCondition; midpoint: WeatherCondition; end: WeatherCondition };
    energyEfficiency: number;
    estimatedCost: number;
    geometry?: LatLng[];
  };
  type PlannerResults = {
    routes: RouteShape[];
    evModel: EVModel;
    origin: string;
    destination: string;
    originCoords: LatLng;
    destinationCoords: LatLng;
    startingBattery: number;
    stations: Array<{
      id: number;
      title: string;
      latitude: number;
      longitude: number;
      address?: string;
      powerKW?: number;
      connectionType?: string;
      network?: string;
    }>;
    tripId?: string;
  };
  const [formData, setFormData] = useState<TripFormData>({
    origin: '',
    destination: '',
    evModelId: '',
    batteryPercent: 80,
    useCurrentLocation: false,
    batteryHealth: 100,
  });
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [tripResults, setTripResults] = useState<PlannerResults | null>(null);
  const [error, setError] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    loadEVModels();
  }, []);

  useEffect(() => {
    const applyPreferences = async () => {
      if (!user) return;
      try {
        const prefs = await getUserPreferences(user.id);
        if (!prefs) return;
        setFormData(prev => ({
          ...prev,
          evModelId: prefs.preferred_ev_model_id || prev.evModelId,
          batteryPercent: Math.max(10, 100 - (prefs.default_battery_buffer_percent ?? 20)),
          batteryHealth: prefs.battery_health_percent ?? 100,
        }));
      } catch {
        // ignore
      }
    };
    applyPreferences();
  }, [user]);

  const loadEVModels = () => {
    setEvModels(EV_MODELS);
    if (EV_MODELS.length > 0) {
      setFormData(prev => ({ ...prev, evModelId: EV_MODELS[0].id }));
    }
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setError('');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=YOUR_API_KEY`
            );
            const data: unknown = await response.json();

            if (
              typeof data === 'object' && data !== null &&
              'results' in data && Array.isArray((data as Record<string, unknown>).results) &&
              ((data as Record<string, unknown>).results as unknown[])[0]
            ) {
              const first = ((data as Record<string, unknown>).results as unknown[])[0] as Record<string, unknown>;
              setFormData(prev => ({
                ...prev,
                origin: (first.formatted_address as string) || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                useCurrentLocation: true,
              }));
            }
          } catch {
            setFormData(prev => ({
              ...prev,
              origin: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              useCurrentLocation: true,
            }));
          }

          setGettingLocation(false);
        },
        () => {
          setError('Unable to get your location. Please enter manually.');
          setGettingLocation(false);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
      setGettingLocation(false);
    }
  };



  const handleAICommand = (cmd: ParsedTripCommand) => {
    setFormData(prev => ({
      ...prev,
      origin: cmd.origin || prev.origin,
      destination: cmd.destination || prev.destination,
      batteryPercent: cmd.batteryPercent || prev.batteryPercent,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTripResults(null);

    try {
      const selectedEV = evModels.find(ev => ev.id === formData.evModelId);

      if (!selectedEV) {
        throw new Error('Please select an EV model');
      }

      // Geocode origin and destination using Nominatim
      const geocode = async (q: string) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!res.ok) throw new Error('Failed to geocode address');
        const data: unknown = await res.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('No results for address');
        const first = data[0] as Record<string, unknown>;
        return { lat: parseFloat(String(first.lat)), lon: parseFloat(String(first.lon)), display_name: String(first.display_name || q) };
      };

      const [originGeo, destinationGeo] = await Promise.all([
        geocode(formData.origin),
        geocode(formData.destination),
      ]);

      // Fetch route from OSRM
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originGeo.lon},${originGeo.lat};${destinationGeo.lon},${destinationGeo.lat}?overview=full&geometries=geojson&alternatives=true`;
      const routeRes = await fetch(osrmUrl);
      if (!routeRes.ok) throw new Error('Failed to fetch route');
      const routeJson: unknown = await routeRes.json();
      const routesArray = (typeof routeJson === 'object' && routeJson !== null && 'routes' in routeJson)
        ? ((routeJson as Record<string, unknown>).routes as unknown)
        : undefined;
      if (!Array.isArray(routesArray) || routesArray.length === 0) throw new Error('No route found');
      const osrmRoutes = routesArray.slice(0, 3) as Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>;

      // Transform OSRM routes into our structure
      const routes: RouteShape[] = await Promise.all(osrmRoutes.map(async (r, idx) => {
        const distanceMiles = r.distance / 1609.34; // meters to miles
        const durationMinutes = r.duration / 60; // seconds to minutes
        const geometryCoords: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

        // Fetch weather data for start, middle, and end
        const startWeather = await weatherService.getWeather(originGeo.lat, originGeo.lon);
        const endWeather = await weatherService.getWeather(destinationGeo.lat, destinationGeo.lon);

        // Find midpoint
        const midIdx = Math.floor(geometryCoords.length / 2);
        const midGeo = geometryCoords[midIdx];
        const midWeather = await weatherService.getWeather(midGeo[0], midGeo[1]);

        // Calculate efficiency impact based on average temperature
        const avgEfficiencyLoss = (startWeather.impact.efficiency + midWeather.impact.efficiency + endWeather.impact.efficiency) / 3;

        // Simple estimates for demo
        // Apply weather impact to efficiency
        const baseEfficiency = selectedEV.efficiency_kwh_per_mile;
        const efficiencyKwhPerMi = baseEfficiency / avgEfficiencyLoss; // Higher usage if efficiency < 1.0 (e.g. 0.3 / 0.8 = 0.375 kWh/mi)

        // Calculate effective capacity based on battery health
        const effectiveCapacityKwh = selectedEV.battery_capacity_kwh * (formData.batteryHealth / 100);

        const energyUsedKwh = distanceMiles * efficiencyKwhPerMi;
        const batteryUsagePercent = Math.min(100, Math.round((energyUsedKwh / effectiveCapacityKwh) * 100));
        const chargingStops = batteryUsagePercent > formData.batteryPercent ? Math.ceil((batteryUsagePercent - formData.batteryPercent) / 40) : 0;
        const estimatedCost = Number((energyUsedKwh * 0.15).toFixed(2));

        return {
          id: String(idx + 1),
          name: idx === 0 ? 'Fastest Route' : idx === 1 ? 'Alternative Route' : 'Scenic Route',
          distance: Math.round(distanceMiles),
          duration: Math.round(durationMinutes),
          batteryUsage: batteryUsagePercent,
          chargingStops,
          weatherConditions: {
            start: { temp: startWeather.temp, condition: startWeather.condition, airQuality: 'Good' },
            midpoint: { temp: midWeather.temp, condition: midWeather.condition, airQuality: 'Good' },
            end: { temp: endWeather.temp, condition: endWeather.condition, airQuality: 'Good' },
          },
          energyEfficiency: Number(efficiencyKwhPerMi.toFixed(3)),
          estimatedCost,
          geometry: geometryCoords,
        };
      }));

      // Fetch charging stations from Open Charge Map using route bounding box (first route)
      let stations: Array<{
        id: number;
        title: string;
        latitude: number;
        longitude: number;
        address?: string;
        powerKW?: number;
        connectionType?: string;
        network?: string;
      }> = [];

      try {
        const primaryGeometry = routes[0]?.geometry || [];
        if (primaryGeometry.length > 1) {
          const lats = primaryGeometry.map(p => p[0]);
          const lons = primaryGeometry.map(p => p[1]);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLon = Math.min(...lons);
          const maxLon = Math.max(...lons);

          const ocmParams = new URLSearchParams({
            output: 'json',
            boundingbox: `${minLat},${minLon},${maxLat},${maxLon}`,
            maxresults: '50',
            compact: 'true',
            verbose: 'false',
          });
          const ocmUrl = `/api/ocm/poi/?${ocmParams.toString()}`;
          const ocmRes = await fetch(ocmUrl, {
            headers: {
              'Accept': 'application/json',
              'X-API-Key': import.meta.env.VITE_OCM_API_KEY || API_CONFIG.OPENCHARGE.API_KEY || 'demo',
            },
          });
          if (ocmRes.ok) {
            const ocmData: unknown = await ocmRes.json();
            if (Array.isArray(ocmData)) {
              stations = ocmData.map((pUnknown) => {
                const p = pUnknown as Record<string, unknown>;
                const addr = (p.AddressInfo as Record<string, unknown>) || {};
                const connections = (p.Connections as unknown[]) || [];
                const firstConn = Array.isArray(connections) && connections.length > 0 ? (connections[0] as Record<string, unknown>) : undefined;
                return {
                  id: Number(p.ID),
                  title: String(addr.Title || ''),
                  latitude: Number(addr.Latitude),
                  longitude: Number(addr.Longitude),
                  address: [addr.AddressLine1, addr.Town, addr.StateOrProvince, addr.Postcode].filter(Boolean).map(String).join(', '),
                  powerKW: firstConn && typeof firstConn.PowerKW !== 'undefined' ? Number(firstConn.PowerKW) : undefined,
                  connectionType: firstConn && firstConn.ConnectionType && typeof (firstConn.ConnectionType as Record<string, unknown>).Title !== 'undefined' ? String((firstConn.ConnectionType as Record<string, unknown>).Title) : undefined,
                  network: p.OperatorInfo && typeof (p.OperatorInfo as Record<string, unknown>).Title !== 'undefined' ? String((p.OperatorInfo as Record<string, unknown>).Title) : undefined,
                };
              });
            }
          }
        }
      } catch {
        // Non-fatal if station fetch fails
      }

      const results = {
        routes,
        evModel: selectedEV,
        origin: originGeo.display_name || formData.origin,
        destination: destinationGeo.display_name || formData.destination,
        originCoords: [originGeo.lat, originGeo.lon] as [number, number],
        destinationCoords: [destinationGeo.lat, destinationGeo.lon] as [number, number],
        startingBattery: formData.batteryPercent,
        stations,
      };

      if (user) {
        const savedTrip = saveTrip({
          user_id: user.id,
          ev_model_id: formData.evModelId,
          origin_address: results.origin,
          origin_lat: results.originCoords[0],
          origin_lng: results.originCoords[1],
          destination_address: results.destination,
          destination_lat: results.destinationCoords[0],
          destination_lng: results.destinationCoords[1],
          starting_battery_percent: formData.batteryPercent,
          route_data: results,
        });
        setTripResults({ ...results, tripId: savedTrip.id });
      } else {
        setTripResults(results);
      }

    } catch (err: unknown) {
      // Fallback to previous mock behavior on error
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to plan trip. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFindNearbyStations = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coords: [number, number] = [latitude, longitude];

        // Update form
        setFormData(prev => ({ ...prev, origin: "Current Location", useCurrentLocation: true }));

        try {
          // Fetch stations within 10 miles
          const results = await chargingStationService.getChargingStations(latitude, longitude, 10);

          // Map to component format
          const mappedStations = results.map(s => ({
            id: s.id,
            title: s.title,
            latitude: s.latitude,
            longitude: s.longitude,
            address: s.address,
            powerKW: s.powerKW,
            connectionType: s.connectionType,
            network: s.network
          }));

          // Set dummy trip results to show map
          const dummyRoute: RouteShape = {
            id: 'nearby',
            name: 'Nearby Chargers',
            distance: 0,
            duration: 0,
            batteryUsage: 0,
            chargingStops: 0,
            weatherConditions: {
              start: { temp: 72, condition: 'Clear', airQuality: 'Good' },
              midpoint: { temp: 72, condition: 'Clear', airQuality: 'Good' },
              end: { temp: 72, condition: 'Clear', airQuality: 'Good' }
            },
            energyEfficiency: 0,
            estimatedCost: 0,
            geometry: []
          };

          setTripResults({
            routes: [dummyRoute],
            evModel: evModels.find(e => e.id === formData.evModelId) || evModels[0],
            origin: "Current Location",
            destination: "Nearby Chargers",
            originCoords: coords,
            destinationCoords: coords,
            startingBattery: formData.batteryPercent,
            stations: mappedStations
          });

        } catch (err) {
          console.error("Failed to fetch stations", err);
          setError("Failed to find nearby charging stations");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Location error", err);
        setError("Unable to retrieve your location");
        setLoading(false);
      }
    );
  };

  if (tripResults) {
    return (
      <ErrorBoundary>
        <TripResults
          results={tripResults}
          onBack={() => setTripResults(null)}
          onFindNearby={handleFindNearbyStations}
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-midnight animate-fade-in">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neon-purple/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-blue/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Navigation */}
      <nav className="glass-panel sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3 group cursor-pointer">
              <div className="p-2.5 bg-gradient-to-br from-neon-purple to-neon-blue rounded-2xl shadow-[0_0_15px_rgba(127,90,240,0.3)] group-hover:shadow-[0_0_25px_rgba(127,90,240,0.5)] transition-all duration-300">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-neon-blue transition-colors">
                Neural Navigator
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6 lg:gap-12">
              <button
                onClick={() => setShowHistory(true)}
                className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm"
              >
                <History className="w-4 h-4" />
                <span>History</span>
              </button>
              <button
                onClick={() => setShowPrefs(true)}
                className="group relative flex items-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-neon-purple/50 transition-all duration-300"
                title="My Garage"
              >
                <div className="relative">
                  <Car className="w-5 h-5 text-gray-400 group-hover:text-neon-purple transition-colors" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-neon-purple opacity-0 group-hover:opacity-100 animate-pulse transition-opacity"></div>
                </div>
                <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">My Garage</span>
              </button>
              <button
                onClick={onSignOut}
                className="flex items-center space-x-2 text-color-text-secondary hover:text-white transition px-3 py-2"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-midnight/95 backdrop-blur-xl animate-fade-in">
            <div className="px-4 py-6 space-y-4">
              <button
                onClick={() => {
                  setShowHistory(true);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center space-x-4 p-4 bg-white/5 rounded-2xl border border-white/5 text-white active:scale-95 transition-all"
              >
                <div className="p-2 bg-neon-purple/10 rounded-lg">
                  <History className="w-5 h-5 text-neon-purple" />
                </div>
                <span className="font-semibold text-lg">Trip History</span>
              </button>

              <button
                onClick={() => {
                  setShowPrefs(true);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center space-x-4 p-4 bg-white/5 rounded-2xl border border-white/5 text-white active:scale-95 transition-all"
              >
                <div className="p-2 bg-neon-green/10 rounded-lg">
                  <Car className="w-5 h-5 text-neon-green" />
                </div>
                <span className="font-semibold text-lg">My Garage</span>
              </button>

              <div className="pt-4 mt-4 border-t border-white/5">
                <button
                  onClick={() => {
                    onSignOut();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-4 p-4 text-red-400 hover:bg-red-500/5 rounded-2xl transition-all"
                >
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-lg">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        <div className="text-center mb-12 space-y-4 animate-enter-up">
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50 mb-4 tracking-tighter">
            Plan Your Journey
          </h1>
          <p className="text-color-text-secondary text-xl max-w-2xl mx-auto font-light leading-relaxed">
            Advanced route optimization with real-time weather integration and charging station analysis.
          </p>
        </div>

        <div className="glass-card p-8 md:p-10 animate-enter-up animation-delay-200 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Subtle internal glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-32 bg-neon-purple/20 blur-[100px] pointer-events-none rounded-full"></div>

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Origin Input */}
              <div className="space-y-2 group">
                <label className="block text-sm font-medium text-neon-blue mb-1 uppercase tracking-wider text-xs">
                  Origin Point
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    placeholder="Where are you starting?"
                    required
                    disabled={gettingLocation}
                    className="input-modern pl-10"
                  />
                  <div className="absolute left-0 bottom-3 pl-3 text-color-text-tertiary">
                    <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse"></div>
                  </div>

                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                    className="absolute right-2 top-2 p-2 hover:bg-white/10 rounded-full text-color-text-secondary hover:text-white transition-all disabled:opacity-50"
                    title="Use Current Location"
                  >
                    {gettingLocation ? (
                      <Loader2 className="w-5 h-5 animate-spin text-neon-purple" />
                    ) : (
                      <MapPin className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Destination Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neon-green mb-1 uppercase tracking-wider text-xs">
                  Destination
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="Where do you want to go?"
                  required
                  className="input-modern"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              {/* EV Model Select */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-color-text-secondary mb-1 uppercase tracking-wider text-xs">
                  Vehicle Configuration
                </label>
                <select
                  value={formData.evModelId}
                  onChange={(e) => setFormData({ ...formData, evModelId: e.target.value })}
                  required
                  className="input-modern appearance-none bg-transparent"
                  style={{ backgroundImage: 'none' }}
                >
                  {evModels.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-surface text-white">
                      {ev.manufacturer} {ev.model_name} ({ev.range_miles} mi)
                    </option>
                  ))}
                </select>
              </div>

              {/* Battery Level Slider */}
              <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
                <div className="flex justify-between items-center">
                  <label className="flex items-center text-sm font-medium text-white gap-2">
                    <Battery className="w-4 h-4 text-neon-green" />
                    Current Charge
                  </label>
                  <span className="text-xl font-bold text-neon-green font-mono">
                    {formData.batteryPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={formData.batteryPercent}
                  onChange={(e) => setFormData({ ...formData, batteryPercent: parseInt(e.target.value) })}
                  className="w-full h-2 bg-surface-highlight rounded-lg appearance-none cursor-pointer accent-neon-green"
                />
                <div className="flex justify-between text-xs text-color-text-tertiary">
                  <span>Low (10%)</span>
                  <span>Full (100%)</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-6 py-4 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 text-lg font-bold tracking-wide mt-4"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Calculating Optimal Route...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Navigation className="w-6 h-6" />
                  <span>Initialize Route Analysis</span>
                </div>
              )}
            </button>
          </form>
        </div>
      </div>

      {
        showPrefs && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-up">
            <div className="w-full max-w-6xl">
              <UserPreferences onClose={() => setShowPrefs(false)} />
            </div>
          </div>
        )
      }

      {
        showHistory && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-up">
            <div className="max-w-3xl w-full">
              <TripHistory
                onClose={() => setShowHistory(false)}
                onReplan={(trip) => {
                  setShowHistory(false);
                  setFormData(prev => ({
                    ...prev,
                    origin: trip.origin_address,
                    destination: trip.destination_address,
                    evModelId: trip.ev_model_id,
                    batteryPercent: trip.starting_battery_percent,
                  }));
                }}
                onViewDetails={(trip) => {
                  setShowHistory(false);
                  // Minimal: re-plan immediately to show details with fresh data
                  setFormData(prev => ({ ...prev, origin: trip.origin_address, destination: trip.destination_address, evModelId: trip.ev_model_id }));
                }}
              />
            </div>
          </div>
        )
      }


      <NeuralAssistant onCommand={handleAICommand} />
    </div >
  );
}
