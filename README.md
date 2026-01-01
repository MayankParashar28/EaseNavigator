# ⚡ EaseNavigator AI: Intelligent EV Trip Optimization

> **Smart, sustainable, and data-driven travel for electric vehicle users.**

EaseNavigator AI is an intelligent route planner built for electric vehicle (EV) users.  
It combines real-time data, smart energy predictions, and AI-powered optimization to plan the most efficient and eco-friendly trip possible — while keeping users informed about charging stations, traffic, and environmental conditions along the way.

---

## 🚀 Key Features

### 🧠 Neural Assistant
- **Natural Language Input**: Plan your trip by simply describing it (e.g., "Plan a trip from San Francisco to LA avoiding highways").

- **AI Intent Parsing**: Uses Google Gemini to extract origin, destination, and preferences from natural language.

### 🔋 Smart Route Analysis
- **Weather Integration**: Automatically fetches weather data for the start, mid-point, and end of your journey to predict range impact.
- **Battery Usage Intelligence**: Deep analysis of battery consumption based on model-specific efficiency and environmental factors.
- **Alternative Routes**: Compare multiple route options based on time, battery usage, and charging needs.

### ✈️ 3D Cinematic Flyover
- **Route Visualization**: Experience a cinematic 3D flyover of your planned route before you even start the car.
- **Interactive Map**: Toggle between 2D, 3D (tilt/heading), and satellite views with live traffic overlays.

### ⚡ AI-Powered Charging Insights
- **Smart Summaries**: Get AI-generated "pitches" for charging stations, highlighting nearby amenities and the best spots to take a break.
- **Fast Charge Identification**: Instantly see high-power chargers vs. standard ones.

### 🏎️ My Garage
- **Vehicle Management**: Save and manage your preferred EV model with real-time range and battery capacity tracking.
- **Battery Health Tracking**: Adjust for battery degradation to get even more accurate range estimates.

---

## 🧩 Tech Stack

| Area | Technology | Description |
|------|-------------|-------------|
| **Frontend** | React + TypeScript | Modular, scalable, and type-safe UI |
| **AI Engine** | Google Gemini (1.5 Flash) | Natural language parsing and intelligent recommendations |
| **Mapping** | Google Maps Platform | Advanced markers, directions, and 3D vector maps |
| **Routing** | OSRM (Open Source Routing Machine) | Optimized driving routes with multiple alternatives |
| **Geocoding** | Nominatim (OpenStreetMap) | High-accuracy address resolution |
| **Charging Data** | OpenChargeMap API | Comprehensive global database of charging stations |
| **Weather** | Open-Meteo | Real-time weather impact analysis |
| **Styling** | Tailwind CSS | Modern, responsive, and aesthetic design |

---

## 🌍 Setup & APIs

To run Neural Navigator locally, you'll need to set up the following environment variables in a `.env` file:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_OCM_API_KEY=your_openchargemap_api_key
```

### ⚙️ Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/<your-username>/NeuralNavigator.git
   cd NeuralNavigator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

---

## 🧱 Project Structure

```text
NeuralNavigator/
├── src/
│   ├── components/
│   │   ├── NeuralAssistant.tsx    # AI Voice/Text command center
│   │   ├── RouteMap.tsx           # 3D Map & Flyover engine
│   │   ├── TripPlanner.tsx        # Main orchestration logic
│   │   ├── TripResults.tsx        # Analytics & bento-grid stats
│   │   └── UserPreferences.tsx    # "My Garage" management
│   ├── lib/
│   │   ├── ai.ts                  # Gemini integration layer
│   │   ├── weatherService.ts      # Environmental calculations
│   │   └── localStorage.ts        # Persistent storage & auth
│   └── main.tsx                   # App entry
└── package.json                   # Project configuration
```
```

