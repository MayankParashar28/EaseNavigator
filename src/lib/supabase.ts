import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export interface ChargingStation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  charger_type: string;
  power_kw: number;
  network: string;
  available_ports: number;
}

export interface UserTrip {
  id?: string;
  user_id: string;
  ev_model_id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  starting_battery_percent: number;
  route_data?: any;
  weather_data?: any;
  created_at?: string;
  // New retention fields
  is_favorite?: boolean;
  trip_name?: string | null;
  notes?: string | null;
}

export interface UserPreferences {
  id?: string;
  user_id: string;
  preferred_ev_model_id?: string | null;
  default_battery_buffer_percent?: number | null;
  prefer_scenic_routes?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

// Trip history helpers
export async function getUserTrips(userId: string, favoritesOnly = false) {
  const query = supabase
    .from('user_trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const finalQuery = favoritesOnly ? query.eq('is_favorite', true) : query;
  const { data, error } = await finalQuery;
  if (error) throw error;
  return (data || []) as UserTrip[];
}

export async function updateTripFavorite(tripId: string, isFavorite: boolean) {
  const { data, error } = await supabase
    .from('user_trips')
    .update({ is_favorite: isFavorite })
    .eq('id', tripId)
    .select()
    .single();
  if (error) throw error;
  return data as UserTrip;
}

export async function updateTripName(tripId: string, name: string) {
  const { data, error } = await supabase
    .from('user_trips')
    .update({ trip_name: name })
    .eq('id', tripId)
    .select()
    .single();
  if (error) throw error;
  return data as UserTrip;
}

export async function deleteTrip(tripId: string) {
  const { error } = await supabase
    .from('user_trips')
    .delete()
    .eq('id', tripId);
  if (error) throw error;
}

// Preferences helpers
export async function getUserPreferences(userId: string) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
    throw error;
  }
  return (data || null) as UserPreferences | null;
}

export async function upsertUserPreferences(userId: string, prefs: Partial<UserPreferences>) {
  const payload = { user_id: userId, ...prefs };
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data as UserPreferences;
}
