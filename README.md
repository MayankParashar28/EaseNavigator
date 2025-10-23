# ⚡ EaseNavigator – AI-Powered EV Route Planner

> **Smart, sustainable, and data-driven travel for electric vehicle users.**

EaseNavigator is an intelligent route planner built for electric vehicle (EV) users.  
It combines real-time data, smart energy predictions, and AI-powered optimization to plan the most efficient and eco-friendly trip possible — while keeping users informed about charging stations, traffic, and environmental conditions along the way.

---

## 🚀 Features

### 🔋 Smart Trip Planning
- Enter your **origin**, **destination**, and **current battery percentage**.
- Select your **EV model** to get accurate predictions based on real efficiency data.
- Get the **best route options** with distance, time, estimated energy use, and recharging stops.

### 🧭 Live Location Support
- Instantly detect your **current location** using geolocation.
- Automatically set your origin without typing your address.

### ⚡ Real-Time Data Integration
- Fetch **real-time EV charging stations** along your route using OpenChargeMap API.
- Integrated structure for **live traffic**, **weather**, and **road conditions** (future-ready setup).

### 🧠 AI & Predictive Intelligence
- Predicts **battery consumption** using model-specific efficiency data.
- Built for future **machine learning integration** to improve range estimation and route optimization.

### 📚 Trip History & Analytics
- Every trip is automatically saved to your **Supabase** account.
- View, replan, or analyze past trips directly from the dashboard.

### ⚙️ User Preferences
- Save your preferred EV model and default settings.
- Adjust **battery buffer** and auto-fill defaults for quicker planning.

---

## 🧩 Tech Stack

| Area | Technology | Description |
|------|-------------|-------------|
| Frontend | **React + TypeScript** | Modular, scalable, and type-safe UI |
| Backend & Database | **Supabase** | Auth, user data, and trip storage |
| Styling | **Tailwind CSS** | Modern responsive design |
| Icons | **Lucide React** | Lightweight vector icons |
| Build Tool | **Vite** | Fast bundler and dev server |

---

## 🌍 APIs & Integrations

| API / Service | Purpose | Type |
|----------------|----------|------|
| **OpenStreetMap (Nominatim)** | Converts place names to coordinates | Geocoding |
| **OSRM (Open Source Routing Machine)** | Provides optimized driving routes | Routing |
| **OpenChargeMap** | Finds nearby charging stations | EV Charging API |
| **Supabase** | Stores trips, preferences, and user auth | Backend |
| *(Optional)* OpenRoute / TomTom APIs | For live traffic and travel times | Traffic (future-ready) |

---

## 🧱 Project Structure

EaseNavigator/
│
├── src/
│   ├── components/
│   │   ├── TripPlanner.tsx        # Main trip planning component
│   │   ├── TripResults.tsx        # Displays optimized routes
│   │   ├── TripHistory.tsx        # Past trip records
│   │   ├── UserPreferences.tsx    # Settings for EV model & defaults
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx        # Supabase user auth context
│   │
│   ├── lib/
│   │   ├── supabase.ts            # DB and auth functions
│   │   └── apiConfig.ts           # API configuration and keys
│   │
│   ├── App.tsx                    # App entry point
│   ├── main.tsx                   # React root
│   └── index.css                  # Global styles
│
├── public/
│   └── favicon.ico
│
├── .env                           # Environment variables
├── package.json                   # Dependencies
└── README.md                      # Documentation



⚙️ How It Works
	1.	User Input:
The user provides origin, destination, EV model, and battery level.
	2.	Data Fetching:
	•	Location geocoding via OpenStreetMap
	•	Route calculation using OSRM
	•	Charging station data from OpenChargeMap
	3.	Computation:
	•	Estimates battery consumption and charging needs
	•	Calculates distance, duration, cost, and energy use
	4.	Display:
	•	Presents optimized routes with detailed info
	•	Saves trip data for analytics and history


💻 Installation
# Clone the repo
git clone https://github.com/<your-username>/EaseNavigator.git

# Navigate to the project folder
cd EaseNavigator

# Install dependencies
npm install

# Run the app
npm run dev

