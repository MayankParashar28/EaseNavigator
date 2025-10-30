import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EV_MODELS, type EVModel, getUserPreferences, saveTrip } from '../lib/localStorage';
import { LogOut, MapPin, Navigation, Battery, Loader2, Settings, History } from 'lucide-react';
import TripResults from './TripResults';
import UserPreferences from './UserPreferences';
import TripHistory from './TripHistory';

interface TripPlannerProps {
  onSignOut: () => void;
}

interface TripFormData {
  origin: string;
  destination: string;
  evModelId: string;
  batteryPercent: number;
  useCurrentLocation: boolean;
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
  });
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [tripResults, setTripResults] = useState<PlannerResults | null>(null);
  const [error, setError] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
      const routes: RouteShape[] = osrmRoutes.map((r, idx) => {
        const distanceMiles = r.distance / 1609.34; // meters to miles
        const durationMinutes = r.duration / 60; // seconds to minutes
        const geometryCoords: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);

        // Simple estimates for demo
        const efficiencyKwhPerMi = selectedEV.efficiency_kwh_per_mile;
        const energyUsedKwh = distanceMiles * efficiencyKwhPerMi;
        const batteryUsagePercent = Math.min(100, Math.round((energyUsedKwh / selectedEV.battery_capacity_kwh) * 100));
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
            start: { temp: 72, condition: 'Sunny', airQuality: 'Good' },
            midpoint: { temp: 74, condition: 'Clear', airQuality: 'Good' },
            end: { temp: 70, condition: 'Clear', airQuality: 'Good' },
          },
          energyEfficiency: Number(efficiencyKwhPerMi.toFixed(3)),
          estimatedCost,
          geometry: geometryCoords,
        };
      });

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
          const ocmUrl = `https://api.openchargemap.io/v3/poi/?${ocmParams.toString()}`;
          const ocmRes = await fetch(ocmUrl, {
            headers: {
              'Accept': 'application/json',
              ...(import.meta.env.VITE_OCM_API_KEY ? { 'X-API-Key': import.meta.env.VITE_OCM_API_KEY as string } : {}),
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

  if (tripResults) {
    return <TripResults results={tripResults} onBack={() => setTripResults(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-xl">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Neural Navigator</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition px-3 py-1 rounded-lg hover:bg-gray-50"
              >
                <History className="w-5 h-5" />
                <span className="hidden sm:inline">History</span>
              </button>
              <button
                onClick={() => setShowPrefs(true)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition px-3 py-1 rounded-lg hover:bg-gray-50"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <button
                onClick={onSignOut}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition px-3 py-1 rounded-lg hover:bg-gray-50"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plan Your EV Trip</h1>
          <p className="text-gray-600 mb-8">
            Get AI-powered route optimization with real-time weather, traffic, and charging station data
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Starting Location
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  placeholder="Enter origin address"
                  required
                  disabled={gettingLocation}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {gettingLocation ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5" />
                  )}
                  <span className="hidden sm:inline">Use Current</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Destination
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Enter destination address"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Your EV Model
              </label>
              <select
                value={formData.evModelId}
                onChange={(e) => setFormData({ ...formData, evModelId: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                {evModels.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.manufacturer} {ev.model_name} ({ev.year}) - {ev.range_miles} mi range
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Current Battery Level: {formData.batteryPercent}%
              </label>
              <div className="flex items-center space-x-4">
                <Battery className="w-6 h-6 text-emerald-600" />
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={formData.batteryPercent}
                  onChange={(e) => setFormData({ ...formData, batteryPercent: parseInt(e.target.value) })}
                  className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <span className="text-lg font-semibold text-gray-900 w-12 text-right">
                  {formData.batteryPercent}%
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-emerald-600 hover:to-teal-700 transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing Route...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  <span>Find Best Routes</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {showPrefs && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="max-w-lg w-full">
            <UserPreferences onClose={() => setShowPrefs(false)} />
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
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
      )}
    </div>
  );
}
