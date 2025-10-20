"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft,
  Navigation,
  Clock,
  Zap,
  MapPin,
  DollarSign,
  TrendingDown,
  Battery,
  Brain,
  CheckCircle2,
  ThermometerSun,
  TreePine,
  Leaf,
  AlertTriangle,
  RefreshCw,
  X,
  Mountain,
} from "lucide-react"
import RouteMap from "./RouteMap"
import AlternativeRoutes from "./AlternativeRoutes"
import type { EVModel } from "../lib/supabase"
import { updateTripFavorite, updateTripName, deleteTrip } from "../lib/supabase"
import { trafficService, TrafficData, TrafficAlert, TrafficRoute } from "../lib/trafficService"
import { analyzeTrip, analyzePredictions, optimizeSOCCharging, analyzeElevationWindImpact } from "../lib/ai"

interface WeatherCondition {
  temp: number
  condition: string
  airQuality: string
}

interface Route {
  id: string
  name: string
  distance: number
  duration: number
  batteryUsage: number
  chargingStops: number
  weatherConditions: {
    start: WeatherCondition
    midpoint: WeatherCondition
    end: WeatherCondition
  }
  energyEfficiency: number
  estimatedCost: number
}

type RouteWithGeometry = Route & { geometry?: [number, number][] }

interface TripResultsProps {
  results: {
    routes: RouteWithGeometry[]
    evModel: EVModel
    origin: string
    destination: string
    originCoords?: [number, number]
    destinationCoords?: [number, number]
    startingBattery: number
    tripId?: string
    stations?: Array<{
      id: number
      title: string
      latitude: number
      longitude: number
      address?: string
      powerKW?: number
      connectionType?: string
      network?: string
    }>
  }
  onBack: () => void
}

export default function TripResults({ results, onBack }: TripResultsProps) {
  const [selectedRoute, setSelectedRoute] = useState<RouteWithGeometry>(results.routes[0])
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null)
  const [trafficAlerts, setTrafficAlerts] = useState<TrafficAlert[]>([])
  const [selectedAlternativeRoute, setSelectedAlternativeRoute] = useState<string | null>(null)
  const [loadingTraffic, setLoadingTraffic] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [isFavorite, setIsFavorite] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [tripName, setTripName] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [aiRec, setAiRec] = useState<{ summary: string; confidence: number; reasons: string[]; chargingPlan: { stop: string; minutes: number }[]; risks: string[]; recommendedRouteId: string } | null>(null)
  const [predLoading, setPredLoading] = useState(false)
  const [pred, setPred] = useState<{ batteryDegradationRisk: 'low'|'medium'|'high'; optimalChargingWindows: { start: string; end: string; reason: string }[]; weatherImpact: { rangeDeltaPercent: number; notes: string[] } } | null>(null)
  const [rangePrediction, setRangePrediction] = useState<{ canReach: boolean; rangeAtDestination: number; needsCharging: boolean; suggestedStops: number } | null>(null)
  const [socOptimization, setSocOptimization] = useState<{ totalTripTime: number; totalChargingTime: number; chargingStops: Array<{ stopNumber: number; location: string; targetSOC: number; chargingSpeed: number; dwellTime: number; cost: number; reason: string }>; strategy: string; savings: { timeSaved: number; costSaved: number } } | null>(null)
  const [elevationWindImpact, setElevationWindImpact] = useState<{ elevationGain: number; elevationLoss: number; netElevationChange: number; windImpact: { headwind: number; tailwind: number; crosswind: number }; rangeImpact: { elevationDelta: number; windDelta: number; combinedDelta: number }; recommendations: string[] } | null>(null)

  const getAirQualityColor = (quality: string) => {
    const colors: Record<string, string> = {
      Good: "text-emerald-700 bg-emerald-50 border-emerald-200",
      Moderate: "text-amber-700 bg-amber-50 border-amber-200",
      Poor: "text-red-700 bg-red-50 border-red-200",
    }
    return colors[quality] || "text-slate-700 bg-slate-50 border-slate-200"
  }

  const getWeatherIcon = (condition: string) => {
    const conditionLower = condition.toLowerCase()
    if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
      return '☀️'
    } else if (conditionLower.includes('cloudy') || conditionLower.includes('overcast')) {
      return '☁️'
    } else if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
      return '🌧️'
    } else if (conditionLower.includes('snow')) {
      return '❄️'
    } else if (conditionLower.includes('storm') || conditionLower.includes('thunder')) {
      return '⛈️'
    } else if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
      return '🌫️'
    } else if (conditionLower.includes('wind')) {
      return '💨'
    } else {
      return '🌤️'
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getRouteRecommendation = (route: Route) => {
    if (route.name.includes("Fastest")) return { badge: "Quickest", color: "bg-blue-600" }
    if (route.name.includes("Efficient")) return { badge: "Recommended", color: "bg-emerald-600" }
    return { badge: "Scenic", color: "bg-slate-600" }
  }

  const generateAIAnalysis = () => {
    const bestRoute = results.routes.reduce(
      (best, route) => (route.energyEfficiency < best.energyEfficiency ? route : best),
      results.routes[0],
    )

    const fastestRoute = results.routes.reduce(
      (fastest, route) => (route.duration < fastest.duration ? route : fastest),
      results.routes[0],
    )

    const totalDistance = selectedRoute.distance
    const remainingBattery = results.startingBattery - selectedRoute.batteryUsage
    const avgWeatherTemp =
      (selectedRoute.weatherConditions.start.temp +
      selectedRoute.weatherConditions.midpoint.temp +
        selectedRoute.weatherConditions.end.temp) /
      3

    const hasGoodWeather =
      selectedRoute.weatherConditions.start.condition.includes("Clear") ||
      selectedRoute.weatherConditions.start.condition.includes("Sunny")

    const needsCharging = selectedRoute.chargingStops > 0
    const batteryHealthy = remainingBattery >= 20

    // Calculate environmental impact
    const co2Saved = Math.round(totalDistance * 0.4 * 100) / 100 // ~0.4 kg CO2 per mile saved vs gas car
    const equivalentTrees = Math.round(co2Saved / 22) // 1 tree absorbs ~22 kg CO2/year
    const fuelCostSaved = Math.round(totalDistance * 0.12 * 100) / 100 // ~$0.12 per mile saved

    return {
      bestRoute,
      fastestRoute,
      totalDistance,
      remainingBattery,
      avgWeatherTemp,
      hasGoodWeather,
      needsCharging,
      batteryHealthy,
      recommendation: bestRoute.id === selectedRoute.id ? "optimal" : "acceptable",
      confidence: 95,
      // Environmental impact
      co2Saved,
      equivalentTrees,
      fuelCostSaved,
    }
  }

  const aiAnalysis = generateAIAnalysis()

  useEffect(() => {
    const runAI = async () => {
      setAiError("")
      setAiLoading(true)
      try {
        const rec = await analyzeTrip({
          origin: results.origin,
          destination: results.destination,
          originCoords: results.originCoords,
          destinationCoords: results.destinationCoords,
          startingBattery: results.startingBattery,
          evModel: {
            manufacturer: results.evModel.manufacturer,
            model_name: results.evModel.model_name,
            battery_capacity_kwh: results.evModel.battery_capacity_kwh,
            efficiency_kwh_per_mile: results.evModel.efficiency_kwh_per_mile,
            range_miles: results.evModel.range_miles,
          },
          routes: results.routes.map(r => ({
            id: r.id,
            name: r.name,
            distance: r.distance,
            duration: r.duration,
            batteryUsage: r.batteryUsage,
            chargingStops: r.chargingStops,
            energyEfficiency: r.energyEfficiency,
            estimatedCost: r.estimatedCost,
          })),
        })
        setAiRec(rec)
        const target = results.routes.find(r => r.id === rec.recommendedRouteId)
        if (target) setSelectedRoute(target)
      } catch (e) {
        console.error(e)
        setAiError("AI analysis failed; using local analysis.")
      } finally {
        setAiLoading(false)
      }
    }
    runAI()
  }, [
    results.routes,
    results.origin,
    results.destination,
    results.originCoords,
    results.destinationCoords,
    results.startingBattery,
    results.evModel.manufacturer,
    results.evModel.model_name,
    results.evModel.battery_capacity_kwh,
    results.evModel.efficiency_kwh_per_mile,
    results.evModel.range_miles,
  ])

  // Advanced predictions
  useEffect(() => {
    const runPredictions = async () => {
      setPredLoading(true)
      try {
        const weather = [
          { point: 'start' as const, tempF: selectedRoute.weatherConditions.start.temp, condition: selectedRoute.weatherConditions.start.condition },
          { point: 'midpoint' as const, tempF: selectedRoute.weatherConditions.midpoint.temp, condition: selectedRoute.weatherConditions.midpoint.condition },
          { point: 'end' as const, tempF: selectedRoute.weatherConditions.end.temp, condition: selectedRoute.weatherConditions.end.condition },
        ]
        const res = await analyzePredictions({
          startingBattery: results.startingBattery,
          evModel: {
            manufacturer: results.evModel.manufacturer,
            model_name: results.evModel.model_name,
            battery_capacity_kwh: results.evModel.battery_capacity_kwh,
            efficiency_kwh_per_mile: results.evModel.efficiency_kwh_per_mile,
            range_miles: results.evModel.range_miles,
          },
          route: { distance: selectedRoute.distance, duration: selectedRoute.duration },
          weather,
        })
        setPred(res)
      } catch (e) {
        console.error(e)
      } finally {
        setPredLoading(false)
      }
    }
    runPredictions()
  }, [selectedRoute, results.startingBattery, results.evModel])

  // Range prediction
  useEffect(() => {
    const calculateRangePrediction = () => {
      const currentBattery = results.startingBattery
      const distance = selectedRoute.distance
      const efficiency = results.evModel.efficiency_kwh_per_mile
      const batteryCapacity = results.evModel.battery_capacity_kwh
      const range = results.evModel.range_miles
      
      // Calculate current range based on battery percentage (for future use)
      // const currentRange = (currentBattery / 100) * range
      
      // Calculate battery usage for this trip
      const batteryUsed = distance * efficiency
      const batteryUsedPercent = (batteryUsed / batteryCapacity) * 100
      
      // Calculate remaining battery at destination
      const remainingBattery = currentBattery - batteryUsedPercent
      const rangeAtDestination = (remainingBattery / 100) * range
      
      const canReach = remainingBattery > 10 // 10% safety buffer
      const needsCharging = !canReach
      const suggestedStops = needsCharging ? Math.ceil((batteryUsedPercent - currentBattery + 10) / 50) : 0 // Assume 50% charge per stop
      
      setRangePrediction({
        canReach,
        rangeAtDestination: Math.max(0, rangeAtDestination),
        needsCharging,
        suggestedStops
      })
    }
    
    calculateRangePrediction()
  }, [selectedRoute, results.startingBattery, results.evModel])

  // SOC Optimization
  useEffect(() => {
    const runSOCOptimization = async () => {
      try {
        // Prepare charging stations data
        const chargingStations = Array.isArray(results.stations) ? results.stations.map(station => ({
          name: station.title || 'Unknown Station',
          powerKW: station.powerKW || 50,
          costPerKWh: 0.35, // Default cost, could be enhanced with real pricing
          distanceFromRoute: 0.5 // Default 0.5 miles from route
        })) : []
        
        const optimization = await optimizeSOCCharging({
          distance: selectedRoute.distance,
          startingBattery: results.startingBattery,
          evModel: {
            manufacturer: results.evModel.manufacturer,
            model_name: results.evModel.model_name,
            battery_capacity_kwh: results.evModel.battery_capacity_kwh,
            efficiency_kwh_per_mile: results.evModel.efficiency_kwh_per_mile,
            range_miles: results.evModel.range_miles,
          },
          chargingStations,
          strategy: 'balanced'
        })
        
        setSocOptimization(optimization)
      } catch (e) {
        console.error('SOC optimization failed:', e)
      }
    }
    
    runSOCOptimization()
  }, [selectedRoute, results.startingBattery, results.evModel, results.stations])

  // Traffic Data Loading
  useEffect(() => {
    const loadTrafficData = async () => {
      if (!results.originCoords || !results.destinationCoords) return;
      
      setLoadingTraffic(true);
      try {
        const [traffic, alerts] = await Promise.all([
          trafficService.getTrafficData(
            results.originCoords,
            results.destinationCoords,
            selectedRoute.geometry
          ),
          trafficService.getTrafficAlerts(
            results.originCoords,
            results.destinationCoords
          )
        ]);

        setTrafficData(traffic);
        setTrafficAlerts(alerts);
      } catch (error) {
        console.error('Error loading traffic data:', error);
      } finally {
        setLoadingTraffic(false);
      }
    };

    loadTrafficData();
  }, [results.originCoords, results.destinationCoords, selectedRoute.geometry]);

  // Elevation and Wind Impact
  useEffect(() => {
    const runElevationWindAnalysis = async () => {
      if (!results.originCoords || !results.destinationCoords) return
      
      try {
        // Mock elevation data (in real app, would fetch from elevation API)
        const elevationPoints = [
          { lat: results.originCoords[0], lng: results.originCoords[1], elevation: 100, distance: 0 },
          { lat: (results.originCoords[0] + results.destinationCoords[0]) / 2, lng: (results.originCoords[1] + results.destinationCoords[1]) / 2, elevation: 300, distance: selectedRoute.distance / 2 },
          { lat: results.destinationCoords[0], lng: results.destinationCoords[1], elevation: 200, distance: selectedRoute.distance }
        ]
        
        // Mock wind data (in real app, would fetch from weather API)
        const windConditions = [
          { speed: 15, direction: 45, gust: 25 },
          { speed: 12, direction: 60, gust: 20 },
          { speed: 18, direction: 30, gust: 30 }
        ]
        
        const impact = await analyzeElevationWindImpact({
          route: {
            distance: selectedRoute.distance,
            originCoords: results.originCoords,
            destinationCoords: results.destinationCoords
          },
          elevationPoints,
          windConditions
        })
        
        setElevationWindImpact(impact)
      } catch (e) {
        console.error('Elevation/wind analysis failed:', e)
      }
    }
    
    runElevationWindAnalysis()
  }, [selectedRoute, results.originCoords, results.destinationCoords])

  const canSave = Boolean(results.tripId)

  const handleToggleFavorite = async () => {
    if (!results.tripId) return
    try {
      const updated = await updateTripFavorite(results.tripId, !isFavorite)
      setIsFavorite(!!updated.is_favorite)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveName = async () => {
    if (!results.tripId) return
    setSavingName(true)
    try {
      const updated = await updateTripName(results.tripId, tripName)
      setTripName(updated.trip_name || "")
    } catch (e) {
      console.error(e)
    } finally {
      setSavingName(false)
    }
  }

  const handleDeleteTrip = async () => {
    if (!results.tripId) return
    try {
      await deleteTrip(results.tripId)
      onBack()
    } catch (e) {
      console.error(e)
    }
  }


  // Traffic-related handlers
  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    setTrafficAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleViewAlternatives = () => {
    // Scroll to alternative routes section
    const element = document.getElementById('alternative-routes');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRefreshTraffic = async () => {
    if (!results.originCoords || !results.destinationCoords) return;
    
    setLoadingTraffic(true);
    try {
      const [traffic, alerts] = await Promise.all([
        trafficService.getTrafficData(
          results.originCoords,
          results.destinationCoords,
          selectedRoute.geometry
        ),
        trafficService.getTrafficAlerts(
          results.originCoords,
          results.destinationCoords
        )
      ]);
      
      setTrafficData(traffic);
      setTrafficAlerts(alerts);
      setDismissedAlerts(new Set()); // Reset dismissed alerts
    } catch (error) {
      console.error('Error refreshing traffic data:', error);
    } finally {
      setLoadingTraffic(false);
    }
  };

  const handleSelectAlternativeRoute = (routeId: string) => {
    setSelectedAlternativeRoute(routeId);
  };

  const handleGetDirections = (route: TrafficRoute) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${route.geometry[route.geometry.length - 1][0]},${route.geometry[route.geometry.length - 1][1]}`;
    window.open(url, '_blank');
  };

  // Filter out dismissed alerts
  const activeAlerts = trafficAlerts.filter(alert => !dismissedAlerts.has(alert.id));

  console.log('TripResults rendering:', { 
    results, 
    trafficData, 
    activeAlerts, 
    selectedRoute 
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Enhanced Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all duration-200 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
                <span>Back to Planning</span>
              </button>
              
              <div className="h-8 w-px bg-slate-300"></div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Navigation className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Trip Analysis</h1>
                  <p className="text-sm text-slate-600">{results.origin} → {results.destination}</p>
                </div>
              </div>
            </div>

            {canSave && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleToggleFavorite}
                  className={`p-3 rounded-xl transition-all duration-200 ${
                    isFavorite 
                      ? 'bg-yellow-100 text-yellow-600 shadow-lg' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <CheckCircle2 className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    placeholder="Trip name..."
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                  >
                    {savingName ? 'Saving...' : 'Save'}
                  </button>
              </div>
                
                <button
                  onClick={handleDeleteTrip}
                  className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all duration-200"
                  title="Delete trip"
                >
                  <X className="w-5 h-5" />
                </button>
            </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Left Column - Main Content */}
          <div className="xl:col-span-3 space-y-6">
            
            {/* Trip Overview Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Navigation className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Trip Overview</h2>
                    <p className="text-sm text-slate-600">Route details and vehicle information</p>
                  </div>
              </div>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1 bg-emerald-200 rounded-lg">
                      <MapPin className="w-4 h-4 text-emerald-700" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Route</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mb-1">{selectedRoute.distance} mi</div>
                  <div className="text-xs text-slate-600">{selectedRoute.duration} min</div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1 bg-blue-200 rounded-lg">
                      <Battery className="w-4 h-4 text-blue-700" />
                    </div>
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Vehicle</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mb-1">
                    {results.evModel.manufacturer} {results.evModel.model_name}
                  </div>
                  <div className="text-xs text-slate-600">{results.evModel.battery_capacity_kwh} kWh</div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                  <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Battery Level</div>
                  <div className="text-2xl font-bold text-blue-600">{results.startingBattery}%</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {Math.round((results.evModel.range_miles * results.startingBattery) / 100)} mi range
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
                  <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Routes Found</div>
                  <div className="text-2xl font-bold text-amber-600">{results.routes.length}</div>
                  <div className="text-xs text-slate-600 mt-1">Optimized options</div>
              </div>
            </div>
          </div>
        </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Brain className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI Analysis</div>
                <div className="text-lg font-bold text-slate-900">{aiRec ? aiRec.confidence : aiAnalysis.confidence}%</div>
                    </div>
                  </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${aiRec ? aiRec.confidence : aiAnalysis.confidence}%` }} />
            </div>
            {aiLoading && <p className="text-xs text-slate-600 mt-4">Analyzing route with Gemini…</p>}
            {aiError && <p className="text-xs text-amber-700 mt-2">{aiError}</p>}
            {aiRec && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-800">{aiRec.summary}</p>
                {aiRec.reasons.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Why this route</div>
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {aiRec.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {aiRec.chargingPlan.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Charging plan</div>
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {aiRec.chargingPlan.map((c, i) => <li key={i}>{c.stop}: {c.minutes} min</li>)}
                    </ul>
                  </div>
                )}
                {aiRec.risks.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Risks</div>
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {aiRec.risks.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                <div>
                  <button
                    onClick={() => {
                      if (!aiRec) return
                      const r = results.routes.find(rt => rt.id === aiRec.recommendedRouteId)
                      if (r) setSelectedRoute(r)
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white"
                  >
                    Apply recommended route
                  </button>
                </div>
              </div>
            )}
                  </div>
                </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Efficiency</span>
              <TrendingDown className="w-4 h-4 text-emerald-600" />
                    </div>
            <div className="text-2xl font-bold text-slate-900">
                      {Math.round((1 - selectedRoute.energyEfficiency / 0.5) * 100)}%
                    </div>
            <div className="text-xs text-slate-500 mt-1">Above average</div>
                  </div>

          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Battery After</span>
              <Battery className="w-4 h-4 text-blue-600" />
                    </div>
            <div className="text-2xl font-bold text-slate-900">{aiAnalysis.remainingBattery}%</div>
            <div className="text-xs text-slate-500 mt-1">{aiAnalysis.batteryHealthy ? "Healthy" : "Low"}</div>
                  </div>

          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Weather</span>
              <ThermometerSun className="w-4 h-4 text-amber-600" />
                    </div>
            <div className="text-2xl font-bold text-slate-900">{Math.round(aiAnalysis.avgWeatherTemp)}°F</div>
            <div className="text-xs text-slate-500 mt-1">{aiAnalysis.hasGoodWeather ? "Favorable" : "Moderate"}</div>
                  </div>

          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Live Stations</span>
              <Zap className="w-4 h-4 text-yellow-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {Array.isArray(results.stations) ? results.stations.length : selectedRoute.chargingStops}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {Array.isArray(results.stations) ? 
                `${results.stations.filter(s => s.powerKW && s.powerKW > 50).length} fast charge` : 
                'Optimal strategy'
              }
            </div>
          </div>
        </div>

        {/* Combined Trip Intelligence Panel */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Trip Intelligence</h2>
              <p className="text-sm text-slate-600">Range analysis, charging optimization & environmental factors</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Range Prediction Section */}
            {rangePrediction && (
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1 bg-emerald-200 rounded-lg">
                    <Battery className="w-4 h-4 text-emerald-700" />
                  </div>
                  <h3 className="font-bold text-emerald-800">Range Analysis</h3>
                  <div className={`ml-auto flex items-center space-x-1 ${rangePrediction.canReach ? 'text-emerald-600' : 'text-red-600'}`}>
                    {rangePrediction.canReach ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span className="text-xs font-semibold">
                      {rangePrediction.canReach ? 'Safe' : 'Needs Charging'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-emerald-700">Battery at destination</span>
                    <span className="font-bold text-slate-900">{Math.round(rangePrediction.rangeAtDestination)} mi</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-emerald-700">Remaining charge</span>
                    <span className="font-bold text-slate-900">
                      {Math.round((rangePrediction.rangeAtDestination / results.evModel.range_miles) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-emerald-700">Charging stops needed</span>
                    <span className={`font-bold ${rangePrediction.needsCharging ? 'text-red-600' : 'text-emerald-600'}`}>
                      {rangePrediction.needsCharging ? rangePrediction.suggestedStops : 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SOC Optimization Section */}
            {socOptimization && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1 bg-blue-200 rounded-lg">
                    <Zap className="w-4 h-4 text-blue-700" />
                  </div>
                  <h3 className="font-bold text-blue-800">Smart Charging</h3>
                  <div className="ml-auto text-xs text-blue-600 font-semibold">
                    {socOptimization.strategy} strategy
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Total trip time</span>
                    <span className="font-bold text-slate-900">{Math.round(socOptimization.totalTripTime)} min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Charging time</span>
                    <span className="font-bold text-slate-900">{Math.round(socOptimization.totalChargingTime)} min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Time saved</span>
                    <span className="font-bold text-emerald-600">{Math.round(socOptimization.savings.timeSaved)} min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Cost saved</span>
                    <span className="font-bold text-emerald-600">${socOptimization.savings.costSaved.toFixed(2)}</span>
                  </div>
                </div>
                
                {socOptimization.chargingStops.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <div className="text-xs font-semibold text-blue-700 mb-2">Charging Stops</div>
                    <div className="space-y-2">
                      {socOptimization.chargingStops.slice(0, 2).map((stop, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-blue-600">Stop {stop.stopNumber}</span>
                          <span className="text-slate-700">{stop.targetSOC}% SOC</span>
                          <span className="text-slate-600">{stop.dwellTime}min</span>
                        </div>
                      ))}
                      {socOptimization.chargingStops.length > 2 && (
                        <div className="text-xs text-blue-600">
                          +{socOptimization.chargingStops.length - 2} more stops
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Elevation & Wind Impact Section */}
            {elevationWindImpact && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1 bg-purple-200 rounded-lg">
                    <Mountain className="w-4 h-4 text-purple-700" />
                  </div>
                  <h3 className="font-bold text-purple-800">Environmental Impact</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Elevation gain</span>
                    <span className="font-bold text-slate-900">{Math.round(elevationWindImpact.elevationGain)}m</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Net elevation</span>
                    <span className={`font-bold ${elevationWindImpact.netElevationChange > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {elevationWindImpact.netElevationChange > 0 ? '+' : ''}{Math.round(elevationWindImpact.netElevationChange)}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Wind impact</span>
                    <span className={`font-bold ${elevationWindImpact.windImpact.headwind > elevationWindImpact.windImpact.tailwind ? 'text-red-600' : 'text-emerald-600'}`}>
                      {elevationWindImpact.windImpact.headwind > elevationWindImpact.windImpact.tailwind ? 'Headwind' : 'Tailwind'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Range impact</span>
                    <span className={`font-bold ${elevationWindImpact.rangeImpact.combinedDelta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {elevationWindImpact.rangeImpact.combinedDelta > 0 ? '+' : ''}{Math.round(elevationWindImpact.rangeImpact.combinedDelta)}%
                    </span>
                  </div>
                </div>
                
                {elevationWindImpact.recommendations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-purple-200">
                    <div className="text-xs font-semibold text-purple-700 mb-2">Recommendations</div>
                    <div className="space-y-1">
                      {elevationWindImpact.recommendations.slice(0, 2).map((rec, i) => (
                        <div key={i} className="text-xs text-purple-600 leading-relaxed">
                          • {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>



        {/* Enhanced Advanced Predictions Panel */}
        {pred && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Brain className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Advanced AI Predictions</h2>
                  <p className="text-sm text-slate-600">Machine learning insights for optimal trip planning</p>
                </div>
              </div>
              {predLoading && (
                <div className="flex items-center space-x-2 text-sm text-slate-500">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Analyzing...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Battery Health Prediction */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1 bg-emerald-200 rounded-lg">
                    <Battery className="w-4 h-4 text-emerald-700" />
                  </div>
                  <h3 className="font-bold text-emerald-800">Battery Health Forecast</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-emerald-700">Degradation Risk</span>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      pred.batteryDegradationRisk === 'high' ? 'bg-red-100 text-red-700' :
                      pred.batteryDegradationRisk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {pred.batteryDegradationRisk.charAt(0).toUpperCase() + pred.batteryDegradationRisk.slice(1)}
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 border border-emerald-200">
                    <div className="text-xs font-semibold text-emerald-700 mb-2">Health Score</div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-emerald-100 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            pred.batteryDegradationRisk === 'high' ? 'bg-red-500' :
                            pred.batteryDegradationRisk === 'medium' ? 'bg-yellow-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ 
                            width: pred.batteryDegradationRisk === 'high' ? '30%' :
                                   pred.batteryDegradationRisk === 'medium' ? '60%' : '90%'
                          }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        {pred.batteryDegradationRisk === 'high' ? '30%' :
                         pred.batteryDegradationRisk === 'medium' ? '60%' : '90%'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-emerald-600 leading-relaxed">
                    {pred.batteryDegradationRisk === 'high' ? 
                      '⚠️ High degradation risk detected. Consider charging optimization strategies.' :
                      pred.batteryDegradationRisk === 'medium' ?
                      '⚡ Moderate degradation risk. Monitor charging patterns.' :
                      '✅ Excellent battery health. Continue current charging habits.'
                    }
                  </div>
                </div>
              </div>

              {/* Optimal Charging Windows */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1 bg-blue-200 rounded-lg">
                    <Clock className="w-4 h-4 text-blue-700" />
                  </div>
                  <h3 className="font-bold text-blue-800">Smart Charging Windows</h3>
                </div>
                
                <div className="space-y-3">
                  {pred.optimalChargingWindows.map((window, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-blue-700">
                          {window.start} - {window.end}
                        </div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed">
                        {window.reason}
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="text-xs font-semibold text-blue-700 mb-1">💡 Pro Tip</div>
                    <div className="text-xs text-blue-600">
                      Charging during off-peak hours can save up to 30% on electricity costs
                    </div>
                  </div>
                </div>
              </div>

              {/* Weather Impact Analysis */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl p-5 border border-amber-200">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1 bg-amber-200 rounded-lg">
                    <ThermometerSun className="w-4 h-4 text-amber-700" />
                  </div>
                  <h3 className="font-bold text-amber-800">Weather Impact Analysis</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-amber-700">Range Impact</span>
                      <span className={`text-lg font-bold ${
                        pred.weatherImpact.rangeDeltaPercent > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {pred.weatherImpact.rangeDeltaPercent > 0 ? '+' : ''}{pred.weatherImpact.rangeDeltaPercent}%
                      </span>
                    </div>
                    <div className="text-xs text-amber-600">
                      {pred.weatherImpact.rangeDeltaPercent > 0 ? 'Reduced range due to weather' : 'Improved range conditions'}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-amber-700 mb-2">Weather Factors</div>
                    {pred.weatherImpact.notes.map((note, i) => (
                      <div key={i} className="flex items-start space-x-2 text-xs text-amber-600">
                        <div className="w-1 h-1 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-xs font-semibold text-amber-700 mb-1">🌡️ Temperature Impact</div>
                    <div className="text-xs text-amber-600">
                      {selectedRoute.weatherConditions.start.temp < 32 ? 
                        'Cold weather reduces battery efficiency by 20-40%' :
                        selectedRoute.weatherConditions.start.temp > 85 ?
                        'Hot weather can reduce battery life and efficiency' :
                        'Optimal temperature range for battery performance'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Analytics Dashboard */}
            <div className="mt-6 bg-gradient-to-r from-slate-50 to-gray-100 rounded-xl p-6 border border-slate-200">
              <div className="flex items-center space-x-2 mb-4">
                <div className="p-1 bg-slate-200 rounded-lg">
                  <TrendingDown className="w-4 h-4 text-slate-600" />
                </div>
                <h3 className="font-bold text-slate-800">Predictive Analytics Dashboard</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Energy Efficiency Score */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Efficiency Score</span>
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-emerald-700">A+</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-800 mb-1">
                    {Math.round((1 - selectedRoute.energyEfficiency / 0.5) * 100)}%
                  </div>
                  <div className="text-xs text-slate-600">Above average efficiency</div>
                </div>

                {/* Cost Optimization */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Cost Savings</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 mb-1">
                    ${(selectedRoute.estimatedCost * 0.3).toFixed(0)}
                  </div>
                  <div className="text-xs text-slate-600">vs gas vehicle</div>
                </div>

                {/* Environmental Score */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Eco Score</span>
                    <Leaf className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 mb-1">
                    {Math.round(aiAnalysis.co2Saved * 2.5)}
                  </div>
                  <div className="text-xs text-slate-600">eco points earned</div>
                </div>

                {/* Reliability Score */}
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Reliability</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600 mb-1">98%</div>
                  <div className="text-xs text-slate-600">trip success rate</div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="mt-4 bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center space-x-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-slate-700">AI Insights</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-slate-600">
                        Based on historical data, this route has a 95% success rate for your vehicle model
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-slate-600">
                        Optimal departure time: 30 minutes earlier to avoid peak traffic
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-slate-600">
                        Weather conditions favor 5% better efficiency than average
                      </span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-slate-600">
                        Charging infrastructure confidence: 98% availability
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Optimized Traffic Conditions Panel */}
        {trafficData && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Navigation className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Live Traffic Conditions</h2>
                  <p className="text-sm text-slate-600">Real-time traffic data and alerts</p>
                </div>
              </div>
              <button
                onClick={handleRefreshTraffic}
                disabled={loadingTraffic}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${loadingTraffic ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Traffic Status & Key Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
              {/* Traffic Status */}
              <div className={`rounded-xl p-4 border-2 ${
                trafficData.congestionLevel === 'low' ? 'bg-green-50 border-green-200' :
                trafficData.congestionLevel === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                trafficData.congestionLevel === 'high' ? 'bg-orange-50 border-orange-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  trafficData.congestionLevel === 'low' ? 'bg-green-500' :
                  trafficData.congestionLevel === 'medium' ? 'bg-yellow-500' :
                  trafficData.congestionLevel === 'high' ? 'bg-orange-500' :
                  'bg-red-500'
                }`}></div>
                  <span className="text-sm font-semibold text-slate-700">Traffic Status</span>
              </div>
                <div className="text-lg font-bold text-slate-800">
                  {trafficData.congestionLevel === 'low' ? 'Light' :
                   trafficData.congestionLevel === 'medium' ? 'Moderate' :
                   trafficData.congestionLevel === 'high' ? 'Heavy' :
                   'Severe'}
            </div>
                <div className="text-sm text-slate-600">
                  {trafficData.currentDelay} min delay
                </div>
              </div>

              {/* Total Duration */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700">Total Duration</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">
                  {selectedRoute.duration + trafficData.currentDelay} min
                </div>
                <div className="text-sm text-blue-600">
                  +{trafficData.currentDelay} min delay
                </div>
              </div>

              {/* Data Quality */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">Data Quality</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{trafficData.confidence}%</div>
                <div className="text-sm text-emerald-600">accuracy</div>
              </div>

              {/* Alternative Routes */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Navigation className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-700">Alternatives</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{trafficData.alternativeRoutes.length}</div>
                <div className="text-sm text-purple-600">route options</div>
              </div>
            </div>

            {/* Compact Alerts & Incidents */}
              {(trafficData.roadConditions.incidents.length > 0 || activeAlerts.length > 0) && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h4 className="font-semibold text-slate-800">Active Alerts</h4>
                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs">
                    {trafficData.roadConditions.incidents.length + activeAlerts.length}
                    </span>
                          </div>
                          
                <div className="space-y-2">
                  {/* Traffic Alerts - Compact */}
                  {activeAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-500' :
                          alert.severity === 'high' ? 'bg-orange-500' :
                          alert.severity === 'medium' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}></div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{alert.title}</div>
                          <div className="text-xs text-slate-600">{alert.message}</div>
                        </div>
                      </div>
                              {alert.dismissible && (
                                <button
                                  onClick={() => handleDismissAlert(alert.id)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                                >
                          <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                  ))}
                  
                  {/* Road Incidents - Compact */}
                  {trafficData.roadConditions.incidents.slice(0, 2).map((incident, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          incident.severity === 'low' ? 'bg-green-500' :
                          incident.severity === 'medium' ? 'bg-yellow-500' :
                          incident.severity === 'high' ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}></div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {incident.type.charAt(0).toUpperCase() + incident.type.slice(1)}
                              </div>
                          <div className="text-xs text-slate-600">{incident.description}</div>
                          </div>
                        </div>
                              <span className={`px-2 py-1 rounded text-xs ${
                                incident.severity === 'low' ? 'bg-green-100 text-green-700' :
                                incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                        {incident.severity}
                              </span>
                      </div>
                    ))}

                  {/* Show more if there are additional alerts */}
                  {(activeAlerts.length > 3 || trafficData.roadConditions.incidents.length > 2) && (
                    <div className="text-center">
                      <button
                        onClick={handleViewAlternatives}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View {activeAlerts.length + trafficData.roadConditions.incidents.length - 5} more alerts
                      </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Environmental Conditions - Compact */}
              {(trafficData.roadConditions.weather || trafficData.roadConditions.construction) && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center space-x-2 mb-3">
                  <ThermometerSun className="w-4 h-4 text-amber-500" />
                  <h4 className="font-semibold text-slate-800">Environmental Conditions</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {trafficData.roadConditions.weather && (
                    <div className="flex items-center space-x-3 bg-white rounded-lg p-3 border border-slate-200">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">Weather</div>
                        <div className="text-xs text-slate-600">{trafficData.roadConditions.weather}</div>
                        </div>
                      </div>
                    )}

                    {trafficData.roadConditions.construction && (
                    <div className="flex items-center space-x-3 bg-white rounded-lg p-3 border border-slate-200">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">Construction</div>
                        <div className="text-xs text-slate-600">Road work active</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No Alerts State */}
              {trafficData.roadConditions.incidents.length === 0 && activeAlerts.length === 0 && !trafficData.roadConditions.construction && trafficData.roadConditions.closures.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div>
                    <h4 className="font-semibold text-green-800">All Clear!</h4>
                    <p className="text-sm text-green-600">No traffic alerts or road incidents</p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Environmental Impact Section */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 mb-8 border border-emerald-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TreePine className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-900">Environmental Impact</h3>
              <p className="text-sm text-emerald-700">Your EV trip is making a positive difference!</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center space-x-2 mb-2">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">CO₂ Saved</span>
              </div>
              <div className="text-2xl font-bold text-emerald-900">{aiAnalysis.co2Saved} kg</div>
              <div className="text-xs text-emerald-600 mt-1">vs gas vehicle</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center space-x-2 mb-2">
                <TreePine className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">Trees Equivalent</span>
              </div>
              <div className="text-2xl font-bold text-emerald-900">{aiAnalysis.equivalentTrees}</div>
              <div className="text-xs text-emerald-600 mt-1">trees planted</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">Fuel Savings</span>
              </div>
              <div className="text-2xl font-bold text-emerald-900">${aiAnalysis.fuelCostSaved}</div>
              <div className="text-xs text-emerald-600 mt-1">vs gas costs</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Available Routes</h2>
              <span className="text-sm text-slate-500">{results.routes.length} options</span>
            </div>

            {results.routes.map((route) => {
              const recommendation = getRouteRecommendation(route)
              const isSelected = selectedRoute.id === route.id

              return (
                <div
                  key={route.id}
                  onClick={() => setSelectedRoute(route)}
                  className={`bg-white rounded-lg border-2 cursor-pointer transition-all duration-200 overflow-hidden ${
                    isSelected ? "border-emerald-600 shadow-md" : "border-slate-200 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-bold text-slate-900">{route.name}</h3>
                          <span
                            className={`${recommendation.color} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}
                          >
                            {recommendation.badge}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                          <span className="flex items-center space-x-1.5">
                            <Navigation className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium">{route.distance} mi ({Math.round(route.distance * 1.60934)} km)</span>
                          </span>
                          <span className="flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">{formatDuration(route.duration)}</span>
                          </span>
                          <span className="flex items-center space-x-1.5">
                            <Zap className="w-4 h-4 text-amber-600" />
                            <span className="font-medium">{route.chargingStops} stops</span>
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-3xl font-bold text-emerald-600">{route.batteryUsage}%</div>
                        <div className="text-xs text-slate-600 mt-1">Battery Use</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pt-4 border-t border-slate-200">
                      <div className="text-center">
                        <div className="text-xs text-slate-600 font-medium mb-1">Efficiency</div>
                        <div className="text-lg font-bold text-slate-900">{route.energyEfficiency}</div>
                        <div className="text-xs text-slate-500">kWh/mi</div>
                      </div>

                      <div className="text-center">
                        <div className="text-xs text-slate-600 font-medium mb-1">Est. Cost</div>
                        <div className="text-lg font-bold text-slate-900">${route.estimatedCost}</div>
                        <div className="text-xs text-slate-500">total</div>
                      </div>

                      <div className="text-center">
                        <div className="text-xs text-slate-600 font-medium mb-1">Energy</div>
                        <div className="text-lg font-bold text-slate-900">
                          {(route.distance * route.energyEfficiency).toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-500">kWh</div>
                      </div>

                      <div className="text-center">
                        <div className="text-xs text-slate-600 font-medium mb-1">Weather</div>
                        <div className="text-sm font-bold text-slate-900">{route.weatherConditions.start.temp}°F</div>
                        <div className="text-xs text-slate-500">{route.weatherConditions.start.condition}</div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="pt-4 border-t border-slate-200">
                      <div className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                        Environmental Conditions
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                          {["start", "midpoint", "end"].map((point) => {
                            const weather = route.weatherConditions[point as keyof typeof route.weatherConditions]
                          return (
                              <div key={point} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                              <div className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                                  {point === "midpoint" ? "Mid-Point" : point}
                              </div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-2xl">{getWeatherIcon(weather.condition)}</span>
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">{weather.temp}°F</div>
                                    <div className="text-xs text-slate-600">{weather.condition}</div>
                                  </div>
                                </div>
                                <div
                                  className={`text-xs font-semibold px-2 py-1 rounded border ${getAirQualityColor(weather.airQuality)}`}
                                >
                                  {weather.airQuality}
                              </div>
                              </div>
                            )
                        })}
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 sticky top-24 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white">Route Details</h3>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">
                    Battery Projection
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">Start</span>
                        <span className="text-sm font-bold text-slate-900">{results.startingBattery}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-emerald-600 h-2 rounded-full"
                          style={{ width: `${results.startingBattery}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">After Trip</span>
                        <span className="text-sm font-bold text-amber-600">
                          {results.startingBattery - selectedRoute.batteryUsage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-amber-500 h-2 rounded-full"
                          style={{ width: `${results.startingBattery - selectedRoute.batteryUsage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6 space-y-3">
                  <div className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Trip Metrics</div>

                  {[
                    { label: "Distance", value: `${selectedRoute.distance} mi (${Math.round(selectedRoute.distance * 1.60934)} km)`, icon: Navigation },
                    { label: "Duration", value: formatDuration(selectedRoute.duration), icon: Clock },
                    {
                      label: "Energy Used",
                      value: `${(selectedRoute.distance * selectedRoute.energyEfficiency).toFixed(1)} kWh`,
                      icon: Zap,
                    },
                    { label: "Charge Stops", value: selectedRoute.chargingStops, icon: Zap },
                    { label: "Est. Cost", value: `$${selectedRoute.estimatedCost}`, icon: DollarSign },
                  ].map((metric, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center space-x-2">
                        <metric.icon className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700 font-medium">{metric.label}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{metric.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-emerald-900 mb-1">Recommended</div>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        This route provides optimal balance between efficiency and convenience.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
            <h3 className="text-lg font-bold text-white">Route Map</h3>
          </div>
          <div className="p-6">
            <RouteMap
              route={selectedRoute}
              origin={results.origin}
              destination={results.destination}
              originCoords={results.originCoords}
              destinationCoords={results.destinationCoords}
              stations={results.stations}
              useOpenCharge={true}
            />
          </div>
        </div>

        {/* Alternative Routes Section */}
        {trafficData && trafficData.alternativeRoutes.length > 0 && (
          <div id="alternative-routes" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Navigation className="w-5 h-5" />
                <span>Alternative Routes</span>
                <span className="text-sm bg-white/20 px-2 py-1 rounded-full">
                  {trafficData.alternativeRoutes.length} options
                </span>
              </h3>
            </div>
            <div className="p-6">
              <AlternativeRoutes
                routes={trafficData.alternativeRoutes}
                selectedRouteId={selectedAlternativeRoute || undefined}
                onSelectRoute={handleSelectAlternativeRoute}
                onGetDirections={handleGetDirections}
              />
            </div>
          </div>
        )}

      {Array.isArray(results.stations) && results.stations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <h3 className="text-lg font-bold text-white">Charging Stations Along Route</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.stations.map((s) => (
                <div key={s.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                  <div className="text-sm font-bold text-slate-900">{s.title}</div>
                  {s.address && <div className="text-xs text-slate-600 mt-1">{s.address}</div>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {s.network && (
                      <span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full">{s.network}</span>
                    )}
                    {typeof s.powerKW === 'number' && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">{s.powerKW} kW</span>
                    )}
                    {s.connectionType && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{s.connectionType}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
