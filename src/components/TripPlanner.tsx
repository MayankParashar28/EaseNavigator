import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';
import { EV_MODELS, type EVModel, getUserPreferences, saveTrip, type VehiclePreset, upsertUserPreferences } from '../lib/localStorage';
import { LogOut, MapPin, Navigation, Battery, Loader2, History, AlertTriangle, Car, Menu, X } from 'lucide-react';
import TripResults from './TripResults';
import ErrorBoundary from './ErrorBoundary';
import UserPreferences from './UserPreferences';
import TripHistory from './TripHistory';
import NeuralAssistant from './NeuralAssistant';
import type { ParsedTripCommand } from '../lib/ai';
import { chargingStationService } from "../lib/chargingStations";
import { weatherService } from "../lib/weatherService";
import LocationAutocomplete from './LocationAutocomplete';
import { ArrowUpDown } from 'lucide-react';

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
  const [originValid, setOriginValid] = useState<boolean | undefined>(undefined);
  const [destValid, setDestValid] = useState<boolean | undefined>(undefined);
  const [tripResults, setTripResults] = useState<PlannerResults | null>(null);
  const [error, setError] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [presets, setPresets] = useState<VehiclePreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    loadEVModels();
  }, []);

  useEffect(() => {
    const applyPreferences = async () => {
      if (!user) return;
      try {
        const prefs = await getUserPreferences(user.id);
        if (!prefs) return;
        setPresets(prefs.vehicle_presets || []);
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

  const handleSavePreset = async () => {
    if (!user || !presetName.trim()) return;
    try {
      const prefs = (await getUserPreferences(user.id)) || {};
      const newPreset: VehiclePreset = {
        id: `preset_${Date.now()}`,
        name: presetName,
        evModelId: formData.evModelId,
        batteryPercent: formData.batteryPercent,
        batteryHealth: formData.batteryHealth,
      };
      const updatedPresets = [...(prefs.vehicle_presets || []), newPreset];
      await upsertUserPreferences(user.id, { ...prefs, vehicle_presets: updatedPresets });
      setPresets(updatedPresets);
      setPresetName('');
      setShowSavePreset(false);
    } catch (err) {
      console.error("Failed to save preset", err);
    }
  };

  const applyPreset = (preset: VehiclePreset) => {
    setFormData(prev => ({
      ...prev,
      evModelId: preset.evModelId,
      batteryPercent: preset.batteryPercent,
      batteryHealth: preset.batteryHealth,
    }));
  };

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
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${API_CONFIG.TRAFFIC.GOOGLE_MAPS.API_KEY}`
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

  const swapOrigins = () => {
    setFormData(prev => ({
      ...prev,
      origin: prev.destination,
      destination: prev.origin
    }));
    // Swap validation states too
    setOriginValid(destValid);
    setDestValid(originValid);
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
          name: idx === 0 ? 'Fastest' : idx === 1 ? 'Efficient' : 'Fewer Stops',
          distance: Math.round(distanceMiles),
          duration: Math.round(durationMinutes + (idx === 1 ? 15 : idx === 2 ? 30 : 0)), // Add slight delays for variety
          batteryUsage: idx === 1 ? Math.round(batteryUsagePercent * 0.9) : batteryUsagePercent, // Efficient uses 10% less
          chargingStops: idx === 2 ? Math.max(1, chargingStops - 1) : chargingStops, // Fewer stops logic
          weatherConditions: {
            start: { temp: startWeather.temp, condition: startWeather.condition, airQuality: 'Good' },
            midpoint: { temp: midWeather.temp, condition: midWeather.condition, airQuality: 'Good' },
            end: { temp: endWeather.temp, condition: endWeather.condition, airQuality: 'Good' },
          },
          energyEfficiency: Number((efficiencyKwhPerMi * (idx === 1 ? 0.9 : 1)).toFixed(3)),
          estimatedCost: Number((estimatedCost * (idx === 1 ? 0.85 : 1)).toFixed(2)),
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
          const prefs = getUserPreferences(user?.id || '');
          stations = await chargingStationService.getChargingStationsAlongRoute(
            primaryGeometry,
            6.2,
            prefs?.preferred_amenities || []
          );
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
          const prefs = getUserPreferences(user?.id || '');
          const results = await chargingStationService.getChargingStations(
            latitude,
            longitude,
            10,
            50,
            prefs?.preferred_amenities || []
          );

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
                className="btn-tertiary group relative flex items-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-neon-purple/50 transition-all duration-300"
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
              {/* My Fleet Section */}
              <div className="pt-10 border-t border-white/5 space-y-8">
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

      <div className="max-w-4xl mx-auto px-6 py-16 relative z-10">
        <div className="text-center mb-12 space-y-4 animate-enter-up">
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50 mb-4 tracking-tighter">
            Plan Your Journey
          </h1>
          <p className="text-color-text-secondary text-xl max-w-2xl mx-auto font-light leading-relaxed">
            Advanced route optimization with real-time weather integration and charging station analysis.
          </p>
        </div>

        <div className="glass-card p-10 md:p-12 animate-enter-up animation-delay-200 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Subtle internal glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-32 bg-neon-purple/20 blur-[100px] pointer-events-none rounded-full"></div>

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-y-6 md:gap-x-16">
              {/* Swap Button - Desktop */}
              <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[45%] z-20 mt-3">
                <button
                  type="button"
                  onClick={swapOrigins}
                  className="group p-3.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-neon-blue hover:text-white hover:bg-white/10 hover:border-neon-blue/50 transition-all duration-500 hover:rotate-180 shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:shadow-[0_0_30px_rgba(86,204,242,0.2)] active:scale-95"
                  title="Swap Locations"
                >
                  <ArrowUpDown className="w-5 h-5 rotate-90 transition-transform duration-500 group-hover:drop-shadow-[0_0_8px_rgba(86,204,242,0.8)]" />
                </button>
              </div>



              {/* Origin Input */}
              <div className="space-y-2 group">
                <label className="label-modern !text-neon-blue">
                  Origin Point
                </label>
                <div className="relative">
                  <LocationAutocomplete
                    value={formData.origin}
                    onChange={(val) => {
                      setFormData({ ...formData, origin: val });
                      setOriginValid(val.length > 3);
                    }}
                    placeholder="Enter origin city or address"
                    disabled={gettingLocation}
                    isValid={originValid}
                  />

                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full text-color-text-secondary hover:text-white transition-all disabled:opacity-50 z-10"
                    title="Use Current Location"
                  >
                    {gettingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin text-neon-purple" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Swap Button - Mobile */}
              <div className="md:hidden flex justify-center my-2 z-20 relative">
                <button
                  type="button"
                  onClick={swapOrigins}
                  className="p-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-neon-blue shadow-lg hover:text-white hover:border-neon-blue/50 transition-all active:scale-90 hover:shadow-[0_0_15px_rgba(86,204,242,0.2)]"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>

              {/* Destination Input */}
              <div className="space-y-2">
                <label className="label-modern !text-neon-green">
                  Destination
                </label>
                <LocationAutocomplete
                  value={formData.destination}
                  onChange={(val) => {
                    setFormData({ ...formData, destination: val });
                    setDestValid(val.length > 3);
                  }}
                  placeholder="Enter destination city or address"
                  isValid={destValid}
                />
              </div>
            </div>

            {/* My Fleet Presets */}
            {presets.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-color-text-tertiary uppercase tracking-wider text-[10px]">
                  My Fleet
                </label>
                <div className="flex flex-wrap gap-2">
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:border-neon-purple/50 text-xs font-bold text-gray-400 hover:text-white transition-all duration-300"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-color-text-secondary uppercase tracking-wider text-[10px]">
                    Vehicle Configuration
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSavePreset(true)}
                    className="text-[10px] font-bold text-neon-purple hover:underline"
                  >
                    Save as Preset
                  </button>
                </div>
                <select
                  value={formData.evModelId}
                  onChange={(e) => setFormData({ ...formData, evModelId: e.target.value })}
                  required
                  className="input-modern appearance-none bg-transparent"
                  style={{ backgroundImage: 'none' }}
                >
                  {evModels.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-surface text-white">
                      {ev.manufacturer} {ev.model_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Battery Level Slider */}
              <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
                <div className="flex justify-between items-center">
                  <label className="flex items-center text-sm font-semibold text-white gap-2">
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
                  className="w-full h-3 bg-surface-highlight rounded-lg appearance-none cursor-pointer accent-neon-green"
                />
                <div className="flex justify-between items-center">
                  <div className="text-[10px] font-bold text-color-text-tertiary">
                    {(() => {
                      const model = evModels.find(m => m.id === formData.evModelId);
                      if (!model) return null;
                      const range = Math.round((formData.batteryPercent / 100) * model.range_miles * (formData.batteryHealth / 100));
                      return <span className="text-neon-blue">~{range} mi remaining range</span>;
                    })()}
                  </div>
                  <div className="flex gap-4 text-[10px] text-color-text-tertiary">
                    <span>Low (10%)</span>
                    <span>Full (100%)</span>
                  </div>
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
              className="w-full btn-primary py-4 text-lg font-bold tracking-wide mt-4 min-h-[56px] flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Analyzing Route...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Navigation className="w-6 h-6" />
                  <span>Analyze Route</span>
                </div>
              )}
            </button>
          </form>
        </div>
      </div>

      {showSavePreset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="glass-panel p-8 max-w-md w-full border border-white/10 rounded-[2rem] shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Save as Preset</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. Daily Commute"
                  className="input-modern"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowSavePreset(false)}
                  className="flex-1 btn-secondary py-3 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreset}
                  className="flex-1 btn-primary py-3 text-sm"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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


      <NeuralAssistant
        onCommand={handleAICommand}
        context={{
          origin: formData.origin,
          destination: formData.destination,
          evModel: evModels.find(m => m.id === formData.evModelId),
          startingBattery: formData.batteryPercent
        }}
      />
    </div >
  );
}
