"use client"

import { useState, useEffect, useMemo } from "react"
import type { EVModel } from "../lib/localStorage"
import { updateTripFavorite, updateTripName, deleteTrip } from "../lib/localStorage"
import { trafficService, TrafficData, TrafficAlert } from "../lib/trafficService"
import { analyzeTrip, calculateTripMetrics, TripMetrics } from "../lib/ai"
import { useAuth } from "../contexts/AuthContext"
import TripHeader from "./trip-results/TripHeader"
import StatsBentoGrid from "./trip-results/StatsBentoGrid"
import TrafficPanel from "./trip-results/TrafficPanel"
import TripIntelligence from "./trip-results/TripIntelligence"
import RouteMap, { RouteWithGeom } from "./RouteMap"
import SmartRouteSelector from "./trip-results/SmartRouteSelector"
import CompanionView from "./navigation/CompanionView"
import ChargingStopCard from "./trip-results/ChargingStopCard"
import JourneyTimeline from "./trip-results/JourneyTimeline"
import NeuralAssistant from "./NeuralAssistant"
import { Navigation, LayoutGrid, ArrowRightLeft } from "lucide-react"

// Use the exported type from RouteMap
export type RouteWithGeometry = RouteWithGeom;

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
  const [loadingTraffic, setLoadingTraffic] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [isFavorite, setIsFavorite] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [tripName, setTripName] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [showCompanion, setShowCompanion] = useState(false);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'tesla' | 'ccs'>('all');
  const [sortBy, setSortBy] = useState<'speed' | 'cost' | 'distance'>('speed');
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);
  const [selectedStation, setSelectedStation] = useState<{ id: number; title: string; latitude: number; longitude: number; } | null>(null);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<TripMetrics | null>(null)
  const [rangePrediction, setRangePrediction] = useState<{ canReach: boolean; rangeAtDestination: number; needsCharging: boolean; suggestedStops: number } | null>(null)
  const [socOptimization, setSocOptimization] = useState<{ totalTripTime: number; totalChargingTime: number; chargingStops: Array<{ stopNumber: number; location: string; targetSOC: number; chargingSpeed: number; dwellTime: number; cost: number; reason: string }>; strategy: string; savings: { timeSaved: number; costSaved: number } } | null>(null)

  // Memoize enriched station data to ensure stable randoms (Moved after state declarations)
  const enrichedStations = useMemo(() => {
    return (results.stations || []).map((s, i) => {
      const seed = (s.id || 0) + s.title.length + i;
      const stopInfo = socOptimization?.chargingStops.find(cs => cs.stopNumber === i + 1);

      return {
        ...s,
        availableConnectors: 1 + (seed % 5),
        totalConnectors: 5 + (seed % 4),
        amenities: {
          foodNearby: (seed % 2) === 0, // Match Station interface
          restrooms: true,              // Match Station interface
          wifi: (seed % 3) === 0,
          shopping: (seed % 5) === 0
        },
        trafficLevel: ['low', 'moderate', 'heavy'][seed % 3] as 'low' | 'moderate' | 'heavy',
        arrivalSOC: stopInfo ? Math.round(stopInfo.targetSOC - 25) : (15 + (seed % 20)),
        chargeTime: stopInfo?.dwellTime || (20 + (seed % 30)),
        isRecommended: i === 0
      };
    });
  }, [results.stations, socOptimization]);

  useEffect(() => {
    // Initial deterministic state while AI loads
    const initialMetrics = calculateTripMetrics({
      distance: selectedRoute.distance || 0,
      energyEfficiency: selectedRoute.energyEfficiency || 0.28
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
          routes: results.routes as RouteWithGeom[]
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
          type: 'warning',
          severity: inc.severity === 'severe' ? 'critical' : inc.severity,
          message: inc.description,
          location: inc.location,
          timestamp: new Date().toISOString(),
          title: 'Traffic Incident',
          dismissible: true
        })))
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

  const filteredStations = (results.stations || [])
    .filter(s => {
      if (filterType === 'tesla') return s.network?.toLowerCase().includes('tesla');
      if (filterType === 'ccs') return !s.network?.toLowerCase().includes('tesla');
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'speed') return (b.powerKW || 0) - (a.powerKW || 0);
      if (sortBy === 'cost') return (a.id % 5) - (b.id % 5); // Mock cost tie to ID
      return 0;
    });

  if (isComparisonMode) {
    return (
      <div className="fixed inset-0 z-[100] bg-midnight flex flex-col animate-fade-in">
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-midnight/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsComparisonMode(false)} className="text-gray-400 hover:text-white">
              <ArrowRightLeft className="w-5 h-5 rotate-180" />
            </button>
            <h2 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter mb-2">Trip Analysis</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
              {['speed', 'cost', 'distance'].map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s as 'speed' | 'cost' | 'distance')}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${sortBy === s ? 'bg-neon-blue text-midnight shadow-[0_0_15px_rgba(0,210,255,0.4)]' : 'text-gray-400 hover:text-white'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsComparisonMode(false)}
              className="btn-primary !py-2 !px-6 text-xs uppercase tracking-widest shadow-lg shadow-neon-green/20"
            >
              Exit Workspace
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* List View (40%) */}
          <div className="w-[400px] border-r border-white/10 flex flex-col bg-surface-highlight/30">
            <div className="p-6 border-b border-white/10 space-y-4">
              <div className="flex items-center gap-2 mb-4 px-2">
                <h4 className="text-sm font-bold text-gray-400">Journey Strategy</h4>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Charger Presets</h3>
                <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-full text-white/40">
                  {filteredStations.length} Results
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`flex-1 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-all ${filterType === 'all' ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-gray-500 hover:border-white/10'
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('tesla')}
                  className={`flex-1 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-all ${filterType === 'tesla' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'border-white/5 text-gray-500 hover:border-white/10'
                    }`}
                >
                  Tesla
                </button>
                <button
                  onClick={() => setFilterType('ccs')}
                  className={`flex-1 py-1.5 rounded-full border text-[10px] font-bold uppercase transition-all ${filterType === 'ccs' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'border-white/5 text-gray-500 hover:border-white/10'
                    }`}
                >
                  CCS
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filteredStations.map((s) => (
                <div
                  key={s.id}
                  className="glass-card !bg-white/5 border-white/5 hover:border-neon-blue/40 transition-all p-4 cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-neon-blue transition-colors">{s.title}</h4>
                      <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{s.address}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-white italic">{s.powerKW}kW</div>
                      <div className="text-[9px] text-neon-green font-bold uppercase">Fastest</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[8px] text-gray-400">☕</div>
                      <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[8px] text-gray-400">🚻</div>
                      <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[8px] text-gray-400">📶</div>
                    </div>
                    <button className="btn-tertiary !px-2 !py-1 text-[9px] font-black text-neon-blue uppercase tracking-widest">
                      Apply as Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Map View (60%) */}
          <div className="flex-1 relative">
            <RouteMap
              route={selectedRoute}
              stations={filteredStations}
              origin={results.origin}
              destination={results.destination}
              originCoords={results.originCoords}
              destinationCoords={results.destinationCoords}
              incidents={trafficData?.roadConditions.incidents || []}
            />
            {/* Legend Overlay for Workspace */}
            <div className="absolute top-6 left-6 p-4 glass-card bg-midnight/60 border-white/10 rounded-2xl pointer-events-none">
              <h5 className="text-[10px] font-black text-white/40 uppercase mb-3">Live Filters</h5>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-blue shadow-[0_0_8px_rgba(0,210,255,0.6)]" />
                  <span className="text-[10px] font-bold text-white/80">Optimal Hub</span>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-[10px] font-bold text-white/80">Alternative</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalBatteryUsage = selectedRoute.batteryUsage || 25;
  const initialBattery = results.startingBattery || 80;

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
          origin={results.origin}
          destination={results.destination}
          stations={results.stations}
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

      <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {/* Banner */}
        <div className="glass-card p-6 md:p-10 mb-6 md:mb-10 animate-enter-up border border-neon-purple/20 relative overflow-hidden">
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
            className="w-full btn-primary !py-4 flex items-center justify-center gap-2 shadow-lg shadow-neon-green/20"
          >
            <Navigation className="w-5 h-5 fill-current" />
            Start Navigation
          </button>
        </div>

        <StatsBentoGrid
          results={results}
          selectedRoute={{
            ...selectedRoute,
            batteryUsage: selectedRoute.batteryUsage || 25,
            chargingStops: selectedRoute.chargingStops || 1,
            weatherConditions: selectedRoute.weatherConditions || {
              start: { temp: 72, condition: 'Clear', airQuality: 'Good' },
              midpoint: { temp: 75, condition: 'Sunny', airQuality: 'Moderate' },
              end: { temp: 70, condition: 'Clear', airQuality: 'Good' }
            },
            energyEfficiency: selectedRoute.energyEfficiency || 0.28,
            estimatedCost: selectedRoute.estimatedCost || 12.50
          }}
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

        <SmartRouteSelector
          routes={results.routes}
          selectedRouteId={selectedRoute.id}
          onSelectRoute={setSelectedRoute}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <TripIntelligence
              aiAnalysis={aiAnalysis}
              socOptimization={socOptimization}
            />

            <div className="mt-8 flex flex-col gap-6">
              <div className="w-full relative h-[450px] md:h-[600px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl isolate group">
                <RouteMap
                  route={selectedRoute}
                  allRoutes={(results.routes || []).map((r, i) => ({
                    ...r,
                    type: i === 0 ? 'fastest' : 'efficient',
                    stopsCount: i === 0 ? 1 : 2,
                    costSaving: i === 1 ? 2.50 : undefined
                  }))}
                  origin={results.origin}
                  destination={results.destination}
                  originCoords={results.originCoords}
                  destinationCoords={results.destinationCoords}
                  stations={enrichedStations.map((s, i) => ({
                    ...s,
                    isRecommended: i === 0
                  }))}
                  incidents={trafficData?.roadConditions.incidents || []}
                  onFindNearby={onFindNearby}
                  onSelectRoute={(r) => setSelectedRoute(r as RouteWithGeometry)}
                  hoveredSegmentIndex={hoveredNodeIndex}
                  onHoverSegment={setHoveredNodeIndex}
                  focusedStation={selectedStation as any}
                  onSelectStation={(s) => setSelectedStation(s as any)}
                />
              </div>

              <div className="w-full">
                <JourneyTimeline
                  origin={results.origin}
                  destination={results.destination}
                  totalDuration={selectedRoute.duration}
                  stops={enrichedStations.slice(0, 3).map(s => ({
                    location: s.title,
                    dwellTime: s.chargeTime,
                    arrivalSOC: s.arrivalSOC,
                    amenities: s.amenities,
                    trafficLevel: s.trafficLevel,
                    chargeTime: s.chargeTime,
                    soc: s.arrivalSOC,
                    connectors: s.availableConnectors
                  }))}
                  hoveredIndex={hoveredNodeIndex}
                  onHover={setHoveredNodeIndex}
                  onNodeClick={(index, type) => {
                    if (type === 'stop') {
                      const station = enrichedStations[index];
                      if (station) setSelectedStation(station as any);
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            {/* Battery Projection Card - Moved here from RouteList */}
            <div className="glass-card mb-6 border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
                <h3 className="text-lg font-bold text-white">Route Analysis</h3>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <div className="text-xs font-bold text-color-text-tertiary mb-3 uppercase tracking-wide">
                    Battery Projection
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-color-text-secondary">Start</span>
                        <span className="text-sm font-bold text-white">{results.startingBattery}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-neon-green h-2 rounded-full shadow-[0_0_10px_rgba(44,182,125,0.5)]"
                          style={{ width: `${initialBattery}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-color-text-secondary">After Trip</span>
                        <span className="text-sm font-bold text-white">
                          {Math.max(0, initialBattery - totalBatteryUsage)}%
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full shadow-[0_0_10px_rgba(255,183,0,0.5)] ${(initialBattery - totalBatteryUsage) < 20 ? 'bg-red-500' : 'bg-yellow-500'
                            }`}
                          style={{ width: `${Math.max(0, initialBattery - totalBatteryUsage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charging Stations List */}
            {results.stations && results.stations.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white italic tracking-tighter uppercase underline decoration-neon-blue decoration-2 underline-offset-[12px]">Charging Plan</h3>
                  <button
                    onClick={() => setIsComparisonMode(true)}
                    className="btn-secondary !py-1.5 !px-4 !rounded-full !text-[10px] flex items-center gap-1.5 font-black uppercase tracking-widest"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" /> Compare Hubs
                  </button>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {enrichedStations.map((s, i) => (
                    <ChargingStopCard
                      key={i}
                      station={s}
                      stopNumber={i + 1}
                      arrivalSOC={s.arrivalSOC}
                      chargeTime={s.chargeTime}
                      alternatives={enrichedStations.filter(alt => alt.id !== s.id).slice(0, 2)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <NeuralAssistant
        onCommand={(cmd) => {
          // You could add logic here to re-trigger a search or update UI
          console.log("AI Command in results:", cmd);
        }}
        context={{
          origin: results.origin,
          destination: results.destination,
          evModel: results.evModel,
          routes: results.routes,
          startingBattery: results.startingBattery
        }}
      />
    </div>
  )
}
