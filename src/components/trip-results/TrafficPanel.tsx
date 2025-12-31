import { Navigation, RefreshCw, Clock, AlertTriangle, X, ThermometerSun } from "lucide-react"
import { TrafficData, TrafficAlert } from "../../lib/trafficService"

interface TrafficPanelProps {
    trafficData: TrafficData
    selectedRoute: { duration: number }
    loadingTraffic: boolean
    activeAlerts: TrafficAlert[]
    onRefreshTraffic: () => void
    onDismissAlert: (id: string) => void
    onViewAlternatives: () => void
}

export default function TrafficPanel({
    trafficData,
    selectedRoute,
    loadingTraffic,
    activeAlerts,
    onRefreshTraffic,
    onDismissAlert,
    onViewAlternatives
}: TrafficPanelProps) {
    return (
        <div className="glass-card mb-6 border border-white/5 bg-surface/50">
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-surface-highlight rounded-lg border border-white/5">
                            <Navigation className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Live Traffic Conditions</h2>
                            <p className="text-sm text-color-text-secondary">Real-time traffic data and alerts</p>
                        </div>
                    </div>
                    <button
                        onClick={onRefreshTraffic}
                        disabled={loadingTraffic}
                        className="px-4 py-2 bg-neon-blue/10 text-neon-blue border border-neon-blue/20 rounded-lg text-sm font-bold hover:bg-neon-blue/20 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${loadingTraffic ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            <div className="p-6">
                {/* Traffic Status & Key Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                    {/* Traffic Status */}
                    <div className={`rounded-xl p-4 border ${trafficData.congestionLevel === 'low' ? 'bg-neon-green/10 border-neon-green/20' :
                        trafficData.congestionLevel === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                            trafficData.congestionLevel === 'high' ? 'bg-orange-500/10 border-orange-500/20' :
                                'bg-red-500/10 border-red-500/20'
                        }`}>
                        <div className="flex items-center space-x-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${trafficData.congestionLevel === 'low' ? 'bg-neon-green shadow-[0_0_10px_rgba(44,182,125,0.6)]' :
                                trafficData.congestionLevel === 'medium' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(255,183,0,0.6)]' :
                                    trafficData.congestionLevel === 'high' ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]' :
                                        'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                                }`}></div>
                            <span className="text-sm font-bold text-white">Traffic Status</span>
                        </div>
                        <div className="text-lg font-bold text-white">
                            {trafficData.congestionLevel === 'low' ? 'Light' :
                                trafficData.congestionLevel === 'medium' ? 'Moderate' :
                                    trafficData.congestionLevel === 'high' ? 'Heavy' :
                                        'Severe'}
                        </div>
                        <div className="text-sm text-color-text-secondary">
                            {trafficData.currentDelay} min delay
                        </div>
                    </div>

                    {/* Total Duration */}
                    <div className="bg-surface-highlight rounded-xl p-4 border border-white/5">
                        <div className="flex items-center space-x-2 mb-2">
                            <Clock className="w-4 h-4 text-white" />
                            <span className="text-sm font-semibold text-color-text-secondary">Total Duration</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {selectedRoute.duration + trafficData.currentDelay} min
                        </div>
                        <div className="text-sm text-red-400">
                            +{trafficData.currentDelay} min delay
                        </div>
                    </div>

                    {/* Data Quality */}
                    <div className="bg-surface-highlight rounded-xl p-4 border border-white/5">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="w-4 h-4 rounded-full bg-neon-green/20 flex items-center justify-center border border-neon-green/50">
                                <div className="w-2 h-2 bg-neon-green rounded-full"></div>
                            </div>
                            <span className="text-sm font-semibold text-color-text-secondary">Data Quality</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{trafficData.confidence}%</div>
                        <div className="text-sm text-color-text-tertiary">accuracy</div>
                    </div>

                    {/* Alternative Routes */}
                    <div className="bg-surface-highlight rounded-xl p-4 border border-white/5">
                        <div className="flex items-center space-x-2 mb-2">
                            <Navigation className="w-4 h-4 text-white" />
                            <span className="text-sm font-semibold text-color-text-secondary">Alternatives</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{(trafficData.alternativeRoutes || []).length}</div>
                        <div className="text-sm text-color-text-tertiary">options</div>
                    </div>
                </div>

                {/* Compact Alerts & Incidents */}
                {((trafficData.roadConditions?.incidents || []).length > 0 || activeAlerts.length > 0) && (
                    <div className="bg-surface-highlight rounded-xl p-4 border border-white/5">
                        <div className="flex items-center space-x-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            <h4 className="font-semibold text-white">Active Alerts</h4>
                            <span className="bg-white/10 text-white px-2 py-1 rounded-full text-xs border border-white/5">
                                {(trafficData.roadConditions?.incidents || []).length + activeAlerts.length}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {/* Traffic Alerts - Compact */}
                            {activeAlerts.slice(0, 3).map((alert) => (
                                <div key={alert.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' :
                                            alert.severity === 'high' ? 'bg-orange-500' :
                                                alert.severity === 'medium' ? 'bg-yellow-500' :
                                                    'bg-neon-blue'
                                            }`}></div>
                                        <div>
                                            <div className="text-sm font-medium text-white">{alert.title}</div>
                                            <div className="text-xs text-color-text-secondary">{alert.message}</div>
                                        </div>
                                    </div>
                                    {alert.dismissible && (
                                        <button
                                            onClick={() => onDismissAlert(alert.id)}
                                            className="text-color-text-tertiary hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* Road Incidents - Compact */}
                            {(trafficData.roadConditions?.incidents || []).slice(0, 2).map((incident, index) => (
                                <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${incident.severity === 'low' ? 'bg-neon-green' :
                                            incident.severity === 'medium' ? 'bg-yellow-500' :
                                                incident.severity === 'high' ? 'bg-orange-500' :
                                                    'bg-red-500'
                                            }`}></div>
                                        <div>
                                            <div className="text-sm font-medium text-white">
                                                {(incident.type || 'unknown').charAt(0).toUpperCase() + (incident.type || 'unknown').slice(1)}
                                            </div>
                                            <div className="text-xs text-color-text-secondary">{incident.description}</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs border ${incident.severity === 'low' ? 'bg-neon-green/10 text-neon-green border-neon-green/20' :
                                        incident.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                            incident.severity === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                'bg-red-500/10 text-red-500 border-red-500/20'
                                        }`}>
                                        {incident.severity}
                                    </span>
                                </div>
                            ))}

                            {/* Show more if there are additional alerts */}
                            {(activeAlerts.length > 3 || (trafficData.roadConditions?.incidents || []).length > 2) && (
                                <div className="text-center">
                                    <button
                                        onClick={onViewAlternatives}
                                        className="text-sm text-color-text-secondary hover:text-white font-medium"
                                    >
                                        View {activeAlerts.length + (trafficData.roadConditions?.incidents || []).length - 5} more alerts
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Environmental Conditions - Compact */}
                {(trafficData.roadConditions?.weather || trafficData.roadConditions?.construction) && (
                    <div className="bg-surface-highlight rounded-xl p-4 border border-white/5">
                        <div className="flex items-center space-x-2 mb-3">
                            <ThermometerSun className="w-4 h-4 text-amber-500" />
                            <h4 className="font-semibold text-white">Environmental Conditions</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {trafficData.roadConditions?.weather && (
                                <div className="flex items-center space-x-3 bg-surface rounded-lg p-3 border border-white/5">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <div>
                                        <div className="text-sm font-medium text-white">Weather</div>
                                        <div className="text-xs text-color-text-secondary">{trafficData.roadConditions?.weather}</div>
                                    </div>
                                </div>
                            )}

                            {trafficData.roadConditions?.construction && (
                                <div className="flex items-center space-x-3 bg-surface rounded-lg p-3 border border-white/5">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                    <div>
                                        <div className="text-sm font-medium text-white">Construction</div>
                                        <div className="text-xs text-color-text-secondary">Road work active</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* No Alerts State */}
                {(trafficData.roadConditions?.incidents || []).length === 0 && activeAlerts.length === 0 && !trafficData.roadConditions?.construction && (trafficData.roadConditions?.closures || []).length === 0 && (
                    <div className="bg-neon-green/10 border border-neon-green/20 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-neon-green/20 flex items-center justify-center">
                                <div className="w-3 h-3 bg-neon-green rounded-full shadow-[0_0_10px_rgba(44,182,125,0.5)]"></div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">All Clear!</h4>
                                <p className="text-sm text-color-text-secondary">No traffic alerts or road incidents</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
