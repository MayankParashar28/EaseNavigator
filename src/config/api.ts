// API Configuration
export const API_CONFIG = {
  // OpenChargeMap API
  OPENCHARGE: {
    BASE_URL: 'https://api.openchargemap.io/v3',
    // OpenChargeMap API key - using direct key for immediate functionality
    API_KEY: '8054f03f-85f5-4259-8173-0a31cc89da87',
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
  }
};

// Helper function to check if we have a valid API key
export const hasOpenChargeAPIKey = (): boolean => {
  return API_CONFIG.OPENCHARGE.API_KEY !== 'demo' && API_CONFIG.OPENCHARGE.API_KEY.length > 0;
};
