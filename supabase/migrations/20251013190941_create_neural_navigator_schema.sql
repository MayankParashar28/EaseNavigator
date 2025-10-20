/*
  # Neural Navigator Database Schema

  ## Overview
  Creates the complete database structure for the Neural Navigator EV trip planning application.

  ## New Tables

  ### 1. `ev_models`
  Stores electric vehicle specifications and battery information
  - `id` (uuid, primary key) - Unique identifier
  - `manufacturer` (text) - Car manufacturer name (e.g., Tesla, Nissan)
  - `model_name` (text) - Model name (e.g., Model 3, Leaf)
  - `year` (integer) - Model year
  - `battery_capacity_kwh` (numeric) - Total battery capacity in kWh
  - `range_miles` (numeric) - EPA estimated range in miles
  - `efficiency_kwh_per_mile` (numeric) - Average energy consumption
  - `fast_charge_capable` (boolean) - Supports DC fast charging
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. `charging_stations`
  Stores charging station locations and capabilities
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Station name
  - `address` (text) - Full address
  - `latitude` (numeric) - GPS latitude
  - `longitude` (numeric) - GPS longitude
  - `charger_type` (text) - Type of chargers available (Level 2, DC Fast, etc.)
  - `power_kw` (numeric) - Charging power in kW
  - `network` (text) - Charging network name
  - `available_ports` (integer) - Number of charging ports
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. `user_trips`
  Stores user trip history and preferences
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `ev_model_id` (uuid, foreign key) - References ev_models
  - `origin_address` (text) - Starting location
  - `origin_lat` (numeric) - Origin latitude
  - `origin_lng` (numeric) - Origin longitude
  - `destination_address` (text) - Ending location
  - `destination_lat` (numeric) - Destination latitude
  - `destination_lng` (numeric) - Destination longitude
  - `starting_battery_percent` (integer) - Battery level at start
  - `route_data` (jsonb) - Stored route analysis results
  - `weather_data` (jsonb) - Weather conditions during trip
  - `created_at` (timestamptz) - Trip planning timestamp

  ### 4. `user_preferences`
  Stores user settings and preferred EV
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References auth.users (unique)
  - `preferred_ev_model_id` (uuid, foreign key) - References ev_models
  - `default_battery_buffer_percent` (integer) - Safety battery buffer
  - `prefer_scenic_routes` (boolean) - Route preference
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Users can read all EV models and charging stations (public data)
  - Users can only access their own trips and preferences
  - Authenticated users can create trips and update their preferences

  ## Important Notes
  1. All tables use UUIDs for primary keys
  2. Timestamps default to current time
  3. RLS policies ensure data privacy
  4. JSONB fields store complex route and weather data
  5. Geographic coordinates use numeric type for precision
*/

-- Create ev_models table
CREATE TABLE IF NOT EXISTS ev_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  model_name text NOT NULL,
  year integer NOT NULL,
  battery_capacity_kwh numeric(6,2) NOT NULL,
  range_miles numeric(6,2) NOT NULL,
  efficiency_kwh_per_mile numeric(4,3) NOT NULL,
  fast_charge_capable boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create charging_stations table
CREATE TABLE IF NOT EXISTS charging_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  charger_type text NOT NULL,
  power_kw numeric(6,2) NOT NULL,
  network text,
  available_ports integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create user_trips table
CREATE TABLE IF NOT EXISTS user_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ev_model_id uuid REFERENCES ev_models(id) NOT NULL,
  origin_address text NOT NULL,
  origin_lat numeric(10,8) NOT NULL,
  origin_lng numeric(11,8) NOT NULL,
  destination_address text NOT NULL,
  destination_lat numeric(10,8) NOT NULL,
  destination_lng numeric(11,8) NOT NULL,
  starting_battery_percent integer NOT NULL CHECK (starting_battery_percent >= 0 AND starting_battery_percent <= 100),
  route_data jsonb,
  weather_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  preferred_ev_model_id uuid REFERENCES ev_models(id),
  default_battery_buffer_percent integer DEFAULT 20 CHECK (default_battery_buffer_percent >= 0 AND default_battery_buffer_percent <= 50),
  prefer_scenic_routes boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ev_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE charging_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ev_models (public read access)
CREATE POLICY "Anyone can view EV models"
  ON ev_models FOR SELECT
  USING (true);

-- RLS Policies for charging_stations (public read access)
CREATE POLICY "Anyone can view charging stations"
  ON charging_stations FOR SELECT
  USING (true);

-- RLS Policies for user_trips
CREATE POLICY "Users can view own trips"
  ON user_trips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trips"
  ON user_trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON user_trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON user_trips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert sample EV models
INSERT INTO ev_models (manufacturer, model_name, year, battery_capacity_kwh, range_miles, efficiency_kwh_per_mile, fast_charge_capable) VALUES
  ('Tesla', 'Model 3 Standard Range', 2024, 60.0, 272, 0.220, true),
  ('Tesla', 'Model 3 Long Range', 2024, 82.0, 358, 0.229, true),
  ('Tesla', 'Model Y Long Range', 2024, 81.0, 330, 0.245, true),
  ('Tesla', 'Model S', 2024, 100.0, 405, 0.247, true),
  ('Chevrolet', 'Bolt EV', 2024, 65.0, 259, 0.251, true),
  ('Nissan', 'Leaf', 2024, 60.0, 212, 0.283, true),
  ('Ford', 'Mustang Mach-E', 2024, 91.0, 312, 0.292, true),
  ('Hyundai', 'Ioniq 5', 2024, 77.4, 303, 0.255, true),
  ('Volkswagen', 'ID.4', 2024, 82.0, 275, 0.298, true),
  ('Rivian', 'R1T', 2024, 135.0, 314, 0.430, true)
ON CONFLICT DO NOTHING;