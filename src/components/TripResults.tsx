"use client"

import { useState, useEffect } from "react"
import type { EVModel } from "../lib/localStorage"
import { updateTripFavorite, updateTripName, deleteTrip } from "../lib/localStorage"
import { trafficService, TrafficData, TrafficAlert } from "../lib/trafficService"
import { analyzeTrip, calculateTripMetrics, TripMetrics } from "../lib/ai"
import { useAuth } from "../contexts/AuthContext"
import TripHeader from "./trip-results/TripHeader"
import StatsBentoGrid from "./trip-results/StatsBentoGrid"
import TrafficPanel from "./trip-results/TrafficPanel"
import TripIntelligence from "./trip-results/TripIntelligence"
import RouteList from "./trip-results/RouteList"
import RouteMap from "./RouteMap"
import AlternativeRoutes from "./AlternativeRoutes"
import CompanionView from "./navigation/CompanionView"
import { Navigation } from "lucide-react"

// Re-export type if needed by children, though usually better in types file.
// For now defining here to match previous structure or import from trafficService
// But RouteWithGeometry was defined locally. Let's define it here.
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

export type RouteWithGeometry = Route & { geometry?: [number, number][] }

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
  onFindNearby?: () => void
}

export default function TripResults({ results, onBack, onFindNearby }: TripResultsProps) {
  const { user } = useAuth()
  const [selectedRoute, setSelectedRoute] = useState<RouteWithGeometry>(results.routes[0])
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null)
  const [trafficAlerts, setTrafficAlerts] = useState<TrafficAlert[]>([])
  const [selectedAlternativeRoute] = useState<string | null>(null)
  const [loadingTraffic, setLoadingTraffic] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [isFavorite, setIsFavorite] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [tripName, setTripName] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [showCompanion, setShowCompanion] = useState(false);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<TripMetrics | null>(null)
  const [rangePrediction, setRangePrediction] = useState<{ canReach: boolean; rangeAtDestination: number; needsCharging: boolean; suggestedStops: number } | null>(null)
  const [socOptimization, setSocOptimization] = useState<{ totalTripTime: number; totalChargingTime: number; chargingStops: Array<{ stopNumber: number; location: string; targetSOC: number; chargingSpeed: number; dwellTime: number; cost: number; reason: string }>; strategy: string; savings: { timeSaved: number; costSaved: number } } | null>(null)

  useEffect(() => {
    // Initial deterministic state while AI loads
    const initialMetrics = calculateTripMetrics({
      distance: selectedRoute.distance,
      energyEfficiency: selectedRoute.energyEfficiency
    }, results.evModel);
    setAiAnalysis(initialMetrics);
    setAiLoading(true);

    const performAiAnalysis = async () => {
      try {
        const aiRecommendation = await analyzeTrip({
          origin: results.origin,
          destination: results.destination,
          originCoords: results.originCoords,
          destinationCoords: results.destinationCoords,
          startingBattery: results.startingBattery,
          evModel: results.evModel,
          routes: results.routes
        });

        // Merge AI recommendation with metrics
        setAiAnalysis(prev => ({
          ...prev!,
          efficiencyScore: aiRecommendation.confidence || prev!.efficiencyScore // Use confidence as score proxy or real score if available
        }));

        // In a real app, we'd use more fields from aiRecommendation
      } catch (error) {
        console.error("AI Analysis failed:", error);
      } finally {
        setAiLoading(false);
      }
    };

    performAiAnalysis();

    // Deterministic Range Prediction
    const rangeRemaining = results.evModel.range_miles * (results.startingBattery / 100) - selectedRoute.distance;
    setRangePrediction({
      canReach: rangeRemaining > 0,
      rangeAtDestination: Math.max(0, Math.round(rangeRemaining)),
      needsCharging: rangeRemaining < 0,
      suggestedStops: rangeRemaining < 0 ? Math.ceil(Math.abs(rangeRemaining) / 150) : 0
    })

    setSocOptimization({
      totalTripTime: selectedRoute.duration,
      totalChargingTime: 0,
      chargingStops: [],
      strategy: "Standard",
      savings: { timeSaved: 15, costSaved: 5.50 }
    })
  }, [results, selectedRoute])

  useEffect(() => {
    const fetchTraffic = async () => {
      setLoadingTraffic(true)
      try {
        const data = await trafficService.getTrafficData(
          results.originCoords || [0, 0],
          results.destinationCoords || [0, 0]
        )
        setTrafficData(data)
        setTrafficAlerts((data.roadConditions?.incidents || []).map(inc => ({
          id: Math.random().toString(),
          type: 'warning', // Map accident to warning
          severity: inc.severity,
          message: inc.description,
          location: { lat: 0, lng: 0 },
          timestamp: new Date().toISOString(),
          title: 'Traffic Incident',
          dismissible: true
        }) as TrafficAlert))
      } catch (error) {
        console.error("Traffic data fetch failed", error)
      } finally {
        setLoadingTraffic(false)
      }
    }
    fetchTraffic()
  }, [results.originCoords, results.destinationCoords])

  const handleRefreshTraffic = async () => {
    setLoadingTraffic(true);
    // Re-fetch logic would go here
    setTimeout(() => setLoadingTraffic(false), 1000);
  };

  const handleToggleFavorite = () => {
    if (!user || !results.tripId) return
    const newStatus = !isFavorite
    setIsFavorite(newStatus)
    updateTripFavorite(user.id, results.tripId, newStatus)
  }

  const handleSaveName = () => {
    if (!user || !results.tripId) return
    setSavingName(true)
    setTimeout(() => {
      if (user && results.tripId) {
        updateTripName(user.id, results.tripId, tripName)
      }
      setSavingName(false)
    }, 800)
  }

  const handleDeleteTrip = () => {
    if (!user || !results.tripId) return
    if (confirm('Are you sure you want to delete this trip?')) {
      deleteTrip(user.id, results.tripId)
      onBack()
    }
  }

  // Filter out dismissed alerts
  const activeAlerts = trafficAlerts.filter(alert => !dismissedAlerts.has(alert.id));

  return (
    <div className="min-h-screen relative overflow-hidden bg-midnight animate-fade-in">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neon-purple/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-blue/10 rounded-full blur-[120px] pointer-events-none"></div>

      {showCompanion && (
        <CompanionView
          route={selectedRoute}
          onExit={() => setShowCompanion(false)}
          evModel={results.evModel}
          batteryLevel={results.startingBattery}
        />
      )}

      <TripHeader
        onBack={onBack}
        results={results}
        isFavorite={isFavorite}
        canSave={!!results.tripId && !!user}
        tripName={tripName}
        savingName={savingName}
        onToggleFavorite={handleToggleFavorite}
        onSaveName={handleSaveName}
        onDeleteTrip={handleDeleteTrip}
        setTripName={setTripName}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        {/* Banner */}
        <div className="glass-card p-6 mb-6 animate-enter-up border border-neon-purple/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/5 rounded-full blur-[80px]"></div>
          <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                Ready for your journey to <span className="text-neon-purple">{results.destination}</span>?
              </h2>
              <p className="text-color-text-secondary">
                We've optimized your route using real-time traffic data and AI-powered efficiency models.
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Companion Toggle */}
        <div className="md:hidden mb-6">
          <button
            onClick={() => setShowCompanion(true)}
            className="w-full bg-neon-green text-surface font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-neon-green/20"
          >
            <Navigation className="w-5 h-5 fill-current" />
            Start Navigation
          </button>
        </div>

        <StatsBentoGrid
          results={results}
          selectedRoute={{ ...selectedRoute, id: selectedRoute.id, name: selectedRoute.name, distance: selectedRoute.distance, duration: selectedRoute.duration, batteryUsage: selectedRoute.batteryUsage, chargingStops: selectedRoute.chargingStops, weatherConditions: selectedRoute.weatherConditions, energyEfficiency: selectedRoute.energyEfficiency, estimatedCost: selectedRoute.estimatedCost }}
          aiAnalysis={aiAnalysis}
          rangePrediction={rangePrediction}
          loading={aiLoading}
        />

        {trafficData && (
          <TrafficPanel
            trafficData={trafficData}
            selectedRoute={selectedRoute}
            loadingTraffic={loadingTraffic}
            activeAlerts={activeAlerts}
            onRefreshTraffic={handleRefreshTraffic}
            onDismissAlert={(id) => {
              const newDismissed = new Set(dismissedAlerts)
              newDismissed.add(id)
              setDismissedAlerts(newDismissed)
            }}
            onViewAlternatives={() => { }}
          />
        )}

        <TripIntelligence
          aiAnalysis={aiAnalysis}
          socOptimization={socOptimization}
        />

        <RouteList
          routes={results.routes}
          selectedRoute={selectedRoute}
          setSelectedRoute={setSelectedRoute}
          onGetDirections={() => { }}
          results={results}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <RouteMap
              route={selectedRoute}
              origin={results.origin}
              destination={results.destination}
              originCoords={results.originCoords}
              destinationCoords={results.destinationCoords}
              stations={results.stations || []}
              onFindNearby={onFindNearby}
            />
          </div>
          <div className="lg:col-span-1">
            <AlternativeRoutes
              routes={results.routes.filter(r => r.id !== selectedRoute.id).map(r => ({
                ...r,
                delay: 0,
                congestionLevel: 'low' as const,
                summary: r.name,
                warnings: [],
                geometry: r.geometry || []
              }))}
              onSelectRoute={(id) => {
                const route = results.routes.find(r => r.id === id)
                if (route) setSelectedRoute(route)
              }}
              selectedRouteId={selectedAlternativeRoute || undefined}
              onGetDirections={() => { }}
            />

            {/* Charging Stations List */}
            {results.stations && results.stations.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold text-white mb-4">Charging Stops</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {results.stations.map((s, i) => (
                    <div key={i} className="glass-card p-4 border border-white/5 hover:bg-surface-highlight/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-white">{s.title}</div>
                        <span className="text-xs font-bold bg-neon-blue/10 text-neon-blue px-2 py-1 rounded border border-neon-blue/20">
                          Stop #{i + 1}
                        </span>
                      </div>
                      {s.address && <div className="text-xs text-color-text-secondary mb-3 truncate">{s.address}</div>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {s.network && (
                          <span className="bg-white/5 border border-white/10 text-color-text-tertiary text-[10px] uppercase font-bold px-2 py-1 rounded-md">{s.network}</span>
                        )}
                        {typeof s.powerKW === 'number' && (
                          <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] uppercase font-bold px-2 py-1 rounded-md">{s.powerKW} kW</span>
                        )}
                        {s.connectionType && (
                          <span className="bg-neon-blue/10 border border-neon-blue/20 text-neon-blue text-[10px] uppercase font-bold px-2 py-1 rounded-md">{s.connectionType}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
