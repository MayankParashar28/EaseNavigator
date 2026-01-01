import { TreePine, Leaf, TrendingDown, Battery } from "lucide-react"

interface TripIntelligenceProps {
    aiAnalysis: {
        co2Saved: number
        equivalentTrees: number
        fuelCostSaved: number
        efficiencyScore: number
    } | null
    socOptimization: {
        savings: {
            timeSaved: number
        }
    } | null
}

export default function TripIntelligence({ aiAnalysis }: TripIntelligenceProps) {
    if (!aiAnalysis) return null

    return (
        <div className="glass-card p-10 mb-10 border border-white/5 bg-surface/50 group hover:shadow-[0_0_30px_rgba(46,213,115,0.1)] transition-all duration-300">
            <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-neon-green/10 rounded-lg border border-neon-green/20">
                    <TreePine className="w-5 h-5 text-neon-green" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Environmental Impact</h3>
                    <p className="text-sm text-color-text-secondary">Your EV trip is making a positive difference!</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-surface-highlight rounded-xl p-4 border border-white/5 hover:border-neon-green/30 transition-colors">
                    <div className="flex items-center space-x-2 mb-2">
                        <Leaf className="w-4 h-4 text-neon-green" />
                        <span className="text-sm font-semibold text-color-text-secondary">CO₂ Saved</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{aiAnalysis.co2Saved} kg</div>
                    <div className="text-xs text-white/50 mt-1">vs gas vehicle</div>
                </div>

                <div className="bg-surface-highlight rounded-xl p-4 border border-white/5 hover:border-neon-green/30 transition-colors">
                    <div className="flex items-center space-x-2 mb-2">
                        <TreePine className="w-4 h-4 text-neon-green" />
                        <span className="text-sm font-semibold text-color-text-secondary">Trees Equivalent</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{aiAnalysis.equivalentTrees}</div>
                    <div className="text-xs text-white/50 mt-1">trees planted</div>
                </div>

                <div className="bg-surface-highlight rounded-xl p-4 border border-white/5 hover:border-neon-green/30 transition-colors">
                    <div className="flex items-center space-x-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-neon-green" />
                        <span className="text-sm font-semibold text-color-text-secondary">Efficiency Score</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-sm">
                        <span className="text-white/50">Score</span>
                        <span className="font-semibold text-white">{aiAnalysis.efficiencyScore}/100</span>
                    </div>
                </div>

                <div className="bg-surface-highlight rounded-xl p-4 border border-white/5 hover:border-neon-green/30 transition-colors">
                    <div className="flex items-center space-x-1.5 mb-2">
                        <Battery className="w-4 h-4 text-neon-green" />
                        <span className="text-sm font-semibold text-color-text-secondary">Fuel Savings</span>
                    </div>
                    <div className="text-2xl font-bold text-white">${aiAnalysis.fuelCostSaved}</div>
                    <div className="text-xs text-white/50 mt-1">vs gas costs</div>
                </div>
            </div>
        </div>
    )
}
