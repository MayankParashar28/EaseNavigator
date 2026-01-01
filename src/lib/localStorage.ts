// Local storage helpers for trip history and preferences
export interface EVModel {
  id: string;
  manufacturer: string;
  model_name: string;
  year: number;
  battery_capacity_kwh: number;
  range_miles: number;
  efficiency_kwh_per_mile: number;
  fast_charge_capable: boolean;
}

export interface UserTrip {
  id: string;
  user_id: string;
  ev_model_id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  starting_battery_percent: number;
  route_data?: unknown;
  weather_data?: unknown;
  created_at: string;
  is_favorite?: boolean;
  trip_name?: string | null;
  notes?: string | null;
}

export interface VehiclePreset {
  id: string;
  name: string;
  evModelId: string;
  batteryPercent: number;
  batteryHealth: number;
}

export interface UserPreferences {
  preferred_ev_model_id?: string | null;
  default_battery_buffer_percent?: number | null;
  battery_health_percent?: number | null;
  prefer_scenic_routes?: boolean | null;
  preferred_amenities?: string[] | null;
  vehicle_presets?: VehiclePreset[] | null;
}

// Hardcoded EV models data
export const EV_MODELS: EVModel[] = [
  { id: '1', manufacturer: 'Tesla', model_name: 'Model 3 Standard Range', year: 2024, battery_capacity_kwh: 60.0, range_miles: 272, efficiency_kwh_per_mile: 0.220, fast_charge_capable: true },
  { id: '2', manufacturer: 'Tesla', model_name: 'Model 3 Long Range', year: 2024, battery_capacity_kwh: 82.0, range_miles: 358, efficiency_kwh_per_mile: 0.229, fast_charge_capable: true },
  { id: '3', manufacturer: 'Tesla', model_name: 'Model Y Long Range', year: 2024, battery_capacity_kwh: 81.0, range_miles: 330, efficiency_kwh_per_mile: 0.245, fast_charge_capable: true },
  { id: '4', manufacturer: 'Tesla', model_name: 'Model S', year: 2024, battery_capacity_kwh: 100.0, range_miles: 405, efficiency_kwh_per_mile: 0.247, fast_charge_capable: true },
  { id: '5', manufacturer: 'Chevrolet', model_name: 'Bolt EV', year: 2024, battery_capacity_kwh: 65.0, range_miles: 259, efficiency_kwh_per_mile: 0.251, fast_charge_capable: true },
  { id: '6', manufacturer: 'Nissan', model_name: 'Leaf', year: 2024, battery_capacity_kwh: 60.0, range_miles: 212, efficiency_kwh_per_mile: 0.283, fast_charge_capable: true },
  { id: '7', manufacturer: 'Ford', model_name: 'Mustang Mach-E', year: 2024, battery_capacity_kwh: 91.0, range_miles: 312, efficiency_kwh_per_mile: 0.292, fast_charge_capable: true },
  { id: '8', manufacturer: 'Hyundai', model_name: 'Ioniq 5', year: 2024, battery_capacity_kwh: 77.4, range_miles: 303, efficiency_kwh_per_mile: 0.255, fast_charge_capable: true },
  { id: '9', manufacturer: 'Volkswagen', model_name: 'ID.4', year: 2024, battery_capacity_kwh: 82.0, range_miles: 275, efficiency_kwh_per_mile: 0.298, fast_charge_capable: true },
  { id: '10', manufacturer: 'Rivian', model_name: 'R1T', year: 2024, battery_capacity_kwh: 135.0, range_miles: 314, efficiency_kwh_per_mile: 0.430, fast_charge_capable: true },
];

// Local storage keys
const STORAGE_KEYS = {
  TRIPS: 'neural_navigator_trips',
  PREFERENCES: 'neural_navigator_preferences',
  USER_ID: 'neural_navigator_user_id',
};

// Trip history functions
export function getUserTrips(userId: string, favoritesOnly = false): UserTrip[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRIPS);
    if (!stored) return [];
    const allTrips: UserTrip[] = JSON.parse(stored);
    const userTrips = allTrips.filter(t => t.user_id === userId);
    if (favoritesOnly) {
      return userTrips.filter(t => t.is_favorite);
    }
    return userTrips.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export function saveTrip(trip: Omit<UserTrip, 'id' | 'created_at'>): UserTrip {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRIPS);
    const allTrips: UserTrip[] = stored ? JSON.parse(stored) : [];
    const newTrip: UserTrip = {
      ...trip,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
    };
    allTrips.push(newTrip);
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(allTrips));
    return newTrip;
  } catch {
    const newTrip: UserTrip = {
      ...trip,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([newTrip]));
    return newTrip;
  }
}

export function updateTripFavorite(tripId: string, userId: string, isFavorite: boolean): UserTrip | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRIPS);
    if (!stored) return null;
    const allTrips: UserTrip[] = JSON.parse(stored);
    const trip = allTrips.find(t => t.id === tripId && t.user_id === userId);
    if (!trip) return null;
    trip.is_favorite = isFavorite;
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(allTrips));
    return trip;
  } catch {
    return null;
  }
}

export function updateTripName(tripId: string, userId: string, name: string): UserTrip | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRIPS);
    if (!stored) return null;
    const allTrips: UserTrip[] = JSON.parse(stored);
    const trip = allTrips.find(t => t.id === tripId && t.user_id === userId);
    if (!trip) return null;
    trip.trip_name = name;
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(allTrips));
    return trip;
  } catch {
    return null;
  }
}

export function deleteTrip(tripId: string, userId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRIPS);
    if (!stored) return;
    const allTrips: UserTrip[] = JSON.parse(stored);
    const filtered = allTrips.filter(t => !(t.id === tripId && t.user_id === userId));
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(filtered));
  } catch {
    // Ignore errors
  }
}

// Preferences functions
export function getUserPreferences(userId: string): UserPreferences | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (!stored) return null;
    const allPrefs: Record<string, UserPreferences> = JSON.parse(stored);
    return allPrefs[userId] || null;
  } catch {
    return null;
  }
}

export function upsertUserPreferences(userId: string, prefs: UserPreferences): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    const allPrefs: Record<string, UserPreferences> = stored ? JSON.parse(stored) : {};
    allPrefs[userId] = prefs;
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(allPrefs));
    return prefs;
  } catch {
    return prefs;
  }
}

// Get or create user ID
export function getUserId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (stored) return stored;
    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(STORAGE_KEYS.USER_ID, newId);
    return newId;
  } catch {
    return `user_${Date.now()}`;
  }
}

