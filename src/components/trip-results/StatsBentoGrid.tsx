import { Battery, Zap, Brain, TrendingDown } from "lucide-react"
import { EVModel } from "../../lib/localStorage"

interface Route {
    id?: string
    name?: string
    batteryUsage: number
    estimatedCost: number
    distance: number
    duration?: number
    chargingStops?: number
    weatherConditions?: any
    energyEfficiency?: number;
    [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface StatsBentoGridProps {
    results: {
        evModel: EVModel
        startingBattery: number
    }
    selectedRoute: Route
    aiAnalysis: {
        efficiencyScore: number
    } | null
    rangePrediction: {
        canReach: boolean
        rangeAtDestination: number
        needsCharging: boolean
        suggestedStops: number
    } | null
    loading: boolean
}

export default function StatsBentoGrid({ results, selectedRoute, aiAnalysis, rangePrediction, loading }: StatsBentoGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Route Overview */}
            <div className="glass-card p-6 border border-white/5 bg-surface/30 hover:bg-surface/50 transition-colors group relative overflow-hidden rounded-[2rem]">
                <div className="absolute inset-0 bg-neon-blue/3 blur-3xl group-hover:bg-neon-blue/8 transition-colors"></div>
                <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="p-3 bg-neon-purple/10 rounded-2xl border border-neon-purple/20">
                        <Battery className="w-5 h-5 text-neon-purple" />
                    </div>
                    <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-neon-purple opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-purple"></span>
                    </span>
                </div>
                <div className="relative z-10">
                    <div className="text-3xl font-bold text-white mb-1 font-display tracking-tight">
                        {results.evModel.range_miles}
                        <span className="text-lg text-color-text-tertiary font-normal ml-1">mi</span>
                    </div>
                    <p className="text-sm text-color-text-secondary font-medium">Total Range</p>
                    <div className="mt-3 text-xs text-color-text-tertiary bg-white/5 py-1 px-2 rounded-md inline-block border border-white/5">
                        {results.evModel.model_name}
                    </div>
                </div>
            </div>

            {/* Battery Status */}
            <div className="glass-card p-6 border border-white/5 bg-surface/30 hover:bg-surface/50 transition-colors group rounded-[2rem]">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-neon-green/10 rounded-2xl border border-neon-green/20">
                        <Zap className="w-5 h-5 text-neon-green" />
                    </div>
                </div>
                <div>
                    <div className="flex items-end gap-2 mb-1">
                        <div className="text-3xl font-bold text-white font-display tracking-tight">{results.startingBattery}%</div>
                        <span className="text-sm text-color-text-secondary mb-1.5 font-medium">→</span>
                        <div className={`text-3xl font-bold font-display tracking-tight ${(results.startingBattery - selectedRoute.batteryUsage) < 15
                            ? 'text-red-400'
                            : 'text-neon-green'
                            }`}>
                            {Math.max(0, results.startingBattery - selectedRoute.batteryUsage)}%
                        </div>
                    </div>
                    <p className="text-sm text-color-text-secondary font-medium">Battery Usage Impact</p>
                    {rangePrediction?.canReach === false && (
                        <div className="mt-2 text-xs text-red-400 font-bold bg-red-400/10 py-1.5 px-3 rounded-full border border-red-400/20 animate-pulse inline-flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Charging required
                        </div>
                    )}
                </div>
            </div>

            {/* Efficiency Score */}
            <div className="glass-card p-6 border border-white/5 bg-surface/30 hover:bg-surface/50 transition-colors group rounded-[2rem]">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-neon-blue/10 rounded-2xl border border-neon-blue/20">
                        <Brain className="w-5 h-5 text-neon-blue" />
                    </div>
                    {loading && <div className="animate-spin w-4 h-4 border-2 border-neon-blue border-t-transparent rounded-full"></div>}
                </div>
                <div>
                    <div className="text-3xl font-bold text-white mb-1 font-display tracking-tight">
                        {aiAnalysis ? `${aiAnalysis.efficiencyScore}/100` : '--'}
                    </div>
                    <p className="text-sm text-color-text-secondary font-medium">AI Efficiency Score</p>
                    <div className="mt-3 flex gap-1">
                        <div className={`h-1 flex-1 rounded-full ${aiAnalysis && aiAnalysis.efficiencyScore > 80 ? 'bg-neon-green' : 'bg-white/10'}`}></div>
                        <div className={`h-1 flex-1 rounded-full ${aiAnalysis && aiAnalysis.efficiencyScore > 60 ? 'bg-neon-blue' : 'bg-white/10'}`}></div>
                        <div className={`h-1 flex-1 rounded-full ${aiAnalysis && aiAnalysis.efficiencyScore > 40 ? 'bg-neon-purple' : 'bg-white/10'}`}></div>
                    </div>
                </div>
            </div>

            {/* Cost Savings */}
            <div className="glass-card p-6 border border-white/5 bg-surface/30 hover:bg-surface/50 transition-colors group rounded-[2rem]">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                        <TrendingDown className="w-5 h-5 text-yellow-500" />
                    </div>
                </div>
                <div>
                    <div className="text-3xl font-bold text-white mb-1 font-display tracking-tight">
                        ${selectedRoute.estimatedCost}
                    </div>
                    <p className="text-sm text-color-text-secondary font-medium">Estimated Trip Cost</p>
                    <div className="mt-3 text-xs text-green-400/90 font-medium">
                        ~${(selectedRoute.distance * 0.15).toFixed(2)} savings vs gas
                    </div>
                </div>
            </div>
        </div>
    )
}
