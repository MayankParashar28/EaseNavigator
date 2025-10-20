# OpenChargeMap Integration Setup

This application now includes dynamic charging station data from OpenChargeMap API.

## Setup Instructions

### 1. Get OpenChargeMap API Key

1. Visit [OpenChargeMap API](https://openchargemap.org/site/develop/api)
2. Register for a free account
3. Generate an API key
4. Copy the API key

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# OpenChargeMap API Configuration
VITE_OPENCHARGE_API_KEY=your_actual_api_key_here

# Supabase Configuration (if not already set)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Features

The OpenChargeMap integration provides:

- **Real-time charging station data** along your route
- **Fast charging detection** with visual indicators
- **Station details** including power, network, operator, and status
- **Distance calculations** from your route
- **Operational status** filtering (only shows working stations)
- **Caching** for improved performance (5-minute cache)
- **Error handling** with fallback to demo data

### 4. Usage

The integration is automatically enabled in the TripResults component. The RouteMap component will:

1. Fetch charging stations along the route geometry
2. Display them on the map with different icons for fast/slow charging
3. Show detailed information in popups
4. List stations in the sidebar with real-time data

### 5. API Limits

- Free tier: 1000 requests per month
- Demo key: Limited functionality, may not work in production
- Caching reduces API calls significantly

### 6. Troubleshooting

If you see "Failed to load charging stations":
- Check your API key is correct
- Verify internet connection
- Check browser console for detailed error messages
- Ensure the API key is set in `.env.local` and restart the dev server

### 7. Development

To disable OpenChargeMap integration temporarily:
- Set `useOpenCharge={false}` in the RouteMap component
- The app will fall back to the original static station data
