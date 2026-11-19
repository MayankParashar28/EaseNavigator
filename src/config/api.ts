// API Configuration
export const API_CONFIG = {
  // OpenChargeMap API
  OPENCHARGE: {
    // Served by the /api/ocm proxy (Vercel function in prod, Vite proxy in dev),
    // which adds the OCM_API_KEY server-side so it never reaches the browser.
    BASE_URL: '/api/ocm',
    DEFAULT_RADIUS: 6.2, // 10km in miles (10 * 0.621371)
    MAX_RESULTS: 50,
  },

  // Traffic APIs
  TRAFFIC: {
    GOOGLE_MAPS: {
      API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'demo',
      BASE_URL: 'https://maps.googleapis.com/maps/api',
    },
    TOMTOM: {
      API_KEY: import.meta.env.VITE_TOMTOM_API_KEY || 'demo',
      BASE_URL: 'https://api.tomtom.com/traffic/services/4',
    },
    OPENROUTE: {
      API_KEY: import.meta.env.VITE_OPENROUTE_API_KEY || 'demo',
      BASE_URL: 'https://api.openrouteservice.org/v2',
    }
  },

  // Weather API
  WEATHER: {
    OPENWEATHER: {
      API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo',
      BASE_URL: 'https://api.openweathermap.org/data/2.5'
    }
  }
};
