import { Navigation, Clock, Zap, CheckCircle2, DollarSign } from "lucide-react"
import type { RouteWithGeometry } from "../TripResults"

interface RouteListProps {
    routes: RouteWithGeometry[]
    selectedRoute: RouteWithGeometry
    setSelectedRoute: (route: RouteWithGeometry) => void
    onGetDirections: (route: RouteWithGeometry) => void
    results: {
        startingBattery: number
    }
}

export default function RouteList({ results, routes, selectedRoute, setSelectedRoute }: RouteListProps) {
    const getRouteRecommendation = (route: RouteWithGeometry) => {
        if (route.name.includes("Fastest")) return { badge: "Quickest", color: "bg-black" }
        if (route.name.includes("Efficient")) return { badge: "Recommended", color: "bg-gray-900" }
        return { badge: "Scenic", color: "bg-slate-600" }
    }

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return `${hours}h ${mins}m`
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

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
            <div className="xl:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">Available Routes</h2>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-color-text-secondary">
                        {routes.length} options
                    </span>
                </div>

                <div className="space-y-4">
                    {routes.map((route) => {
                        const recommendation = getRouteRecommendation(route)
                        const isSelected = selectedRoute.id === route.id

                        return (
                            <div
                                key={route.id}
                                onClick={() => setSelectedRoute(route)}
                                className={`glass-card p-0 cursor-pointer transition-all duration-300 group ${isSelected
                                    ? "border-neon-green/50 shadow-[0_0_20px_rgba(44,182,125,0.2)] bg-surface-highlight"
                                    : "border-white/5 hover:border-white/20 hover:bg-surface-highlight/50"
                                    }`}
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <h3 className="text-lg font-bold text-white">{route.name}</h3>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${recommendation.badge === "Best Value" ? "bg-neon-green/10 text-neon-green border-neon-green/20" :
                                                    recommendation.badge === "Fastest" ? "bg-neon-blue/10 text-neon-blue border-neon-blue/20" :
                                                        "bg-white/10 text-color-text-secondary border-white/10"
                                                    }`}>
                                                    {recommendation.badge}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap gap-4 text-sm text-color-text-secondary">
                                                <span className="flex items-center space-x-1.5">
                                                    <Navigation className="w-4 h-4 text-neon-blue" />
                                                    <span className="font-medium text-white">{route.distance} mi</span>
                                                </span>
                                                <span className="flex items-center space-x-1.5">
                                                    <Clock className="w-4 h-4 text-neon-purple" />
                                                    <span className="font-medium text-white">{formatDuration(route.duration)}</span>
                                                </span>
                                                <span className="flex items-center space-x-1.5">
                                                    <Zap className="w-4 h-4 text-yellow-500" />
                                                    <span className="font-medium text-white">{route.chargingStops} stops</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-3xl font-bold text-white">{route.batteryUsage}%</div>
                                            <div className="text-xs text-color-text-tertiary mt-1">Battery Use</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pt-4 border-t border-white/5">
                                        <div className="text-center p-2 rounded-lg bg-surface/50">
                                            <div className="text-xs text-color-text-tertiary font-bold uppercase mb-1">Efficiency</div>
                                            <div className="text-lg font-bold text-white">{route.energyEfficiency}</div>
                                            <div className="text-xs text-color-text-secondary">kWh/mi</div>
                                        </div>

                                        <div className="text-center p-2 rounded-lg bg-surface/50">
                                            <div className="text-xs text-color-text-tertiary font-bold uppercase mb-1">Est. Cost</div>
                                            <div className="text-lg font-bold text-white">${route.estimatedCost}</div>
                                            <div className="text-xs text-color-text-secondary">total</div>
                                        </div>

                                        <div className="text-center p-2 rounded-lg bg-surface/50">
                                            <div className="text-xs text-color-text-tertiary font-bold uppercase mb-1">Energy</div>
                                            <div className="text-lg font-bold text-white">
                                                {(route.distance * route.energyEfficiency).toFixed(1)}
                                            </div>
                                            <div className="text-xs text-color-text-secondary">kWh</div>
                                        </div>

                                        <div className="text-center p-2 rounded-lg bg-surface/50">
                                            <div className="text-xs text-color-text-tertiary font-bold uppercase mb-1">Weather</div>
                                            <div className="text-lg font-bold text-white">{route.weatherConditions.start.temp}°F</div>
                                            <div className="text-xs text-color-text-secondary">{route.weatherConditions.start.condition}</div>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="pt-4 border-t border-white/5 animate-fade-in-up">
                                            <div className="text-xs font-bold text-color-text-secondary mb-3 uppercase tracking-wide">
                                                Environmental Conditions
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {["start", "midpoint", "end"].map((point) => {
                                                    const weather = route.weatherConditions[point as keyof typeof route.weatherConditions]
                                                    return (
                                                        <div key={point} className="bg-surface/50 rounded-lg p-3 border border-white/5">
                                                            <div className="text-[10px] font-bold text-color-text-tertiary mb-2 uppercase tracking-wide">
                                                                {point === "midpoint" ? "Mid-Point" : point}
                                                            </div>
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <span className="text-xl">{getWeatherIcon(weather.condition)}</span>
                                                                <div>
                                                                    <div className="text-sm font-bold text-white">{weather.temp}°F</div>
                                                                    <div className="text-xs text-color-text-secondary">{weather.condition}</div>
                                                                </div>
                                                            </div>
                                                            <div
                                                                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border inline-block ${weather.airQuality === 'Good' ? 'bg-neon-green/10 text-neon-green border-neon-green/20' :
                                                                    'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                                    }`}
                                                            >
                                                                AQI: {weather.airQuality}
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
            </div>

            <div className="xl:col-span-1">
                <div className="glass-card sticky top-24 border border-white/5 overflow-hidden">
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
                                            style={{ width: `${results.startingBattery}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-color-text-secondary">After Trip</span>
                                        <span className="text-sm font-bold text-white">
                                            {Math.max(0, results.startingBattery - selectedRoute.batteryUsage)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-2 rounded-full shadow-[0_0_10px_rgba(255,183,0,0.5)] ${(results.startingBattery - selectedRoute.batteryUsage) < 20 ? 'bg-red-500' : 'bg-yellow-500'
                                                }`}
                                            style={{ width: `${Math.max(0, results.startingBattery - selectedRoute.batteryUsage)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-6 space-y-3">
                            <div className="text-xs font-bold text-color-text-tertiary mb-3 uppercase tracking-wide">Trip Metrics</div>

                            {[
                                { label: "Distance", value: `${selectedRoute.distance} mi`, icon: Navigation, color: "text-neon-blue" },
                                { label: "Duration", value: formatDuration(selectedRoute.duration), icon: Clock, color: "text-neon-purple" },
                                {
                                    label: "Energy Used",
                                    value: `${(selectedRoute.distance * selectedRoute.energyEfficiency).toFixed(1)} kWh`,
                                    icon: Zap,
                                    color: "text-yellow-500"
                                },
                                { label: "Est. Cost", value: `$${selectedRoute.estimatedCost}`, icon: DollarSign, color: "text-green-400" },
                            ].map((metric, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-surface-highlight rounded-lg border border-white/5"
                                >
                                    <div className="flex items-center space-x-3">
                                        <metric.icon className={`w-4 h-4 ${metric.color}`} />
                                        <span className="text-sm text-color-text-secondary font-medium">{metric.label}</span>
                                    </div>
                                    <span className="text-sm font-bold text-white">{metric.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="bg-neon-green/10 border border-neon-green/20 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <CheckCircle2 className="w-5 h-5 text-neon-green mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="text-sm font-bold text-white mb-1">Recommended</div>
                                    <p className="text-xs text-color-text-secondary leading-relaxed">
                                        This route provides the best balance between speed, efficiency, and charging availability.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
