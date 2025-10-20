# ⚡ EaseNavigator – AI-Powered EV Trip Companion

**EaseNavigator** is an intelligent Electric Vehicle (EV) trip planner that helps users drive smarter by predicting energy consumption, optimizing routes, and suggesting charging stops — all powered by AI and real-time environmental data.  
Built to make EV journeys more efficient, stress-free, and sustainable. 🌱⚙️

---

## 🚀 Features

- 🚗 **Smart Route Optimization** – AI-enhanced routing with Google Maps integration.  
- 🔋 **Battery Prediction Model** – Estimates battery usage based on speed, terrain, temperature, and more.  
- ⚡ **Charging Station Finder** – Displays available stations near your route using Open Charge Map API.  
- ☁️ **Weather & Air Quality Insights** – Integrates live data to adjust route and energy predictions.  
- 🌍 **Real-Time Traffic Awareness** – Detects traffic congestion and reroutes dynamically.  
- 💾 **Trip History & Preferences** – Saves user journeys for quick re-planning.  
- 🧠 **AI-Ready Architecture** – Built to integrate deep learning range-prediction models.  
- 🧭 **Current Location Tracking** – Allows planning directly from the user’s GPS coordinates.  

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React + TypeScript + Tailwind CSS |
| **Backend** | Flask (for ML integration) / Supabase |
| **Database & Auth** | Supabase |
| **APIs Used** | Google Maps, OpenWeatherMap, OpenChargeMap, Air Quality API |
| **Hosting** | Vercel / Render / GitHub Pages |

---

## 🧩 Project Structure

ease-navigator/
│
├── src/
│   ├── components/
│   │   ├── TripPlanner.tsx
│   │   ├── TripResults.tsx
│   │   ├── UserPreferences.tsx
│   │   └── TripHistory.tsx
│   ├── contexts/
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── apiUtils.ts
│   └── App.tsx
│
├── public/
│   └── index.html
│
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md


---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/<your-username>/ease-navigator.git
cd ease-navigator
