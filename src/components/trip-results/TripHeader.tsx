import { ArrowLeft, Navigation, MapPin, CheckCircle2, X } from "lucide-react"

interface TripHeaderProps {
    onBack: () => void
    results: {
        origin: string
        destination: string
    }
    isFavorite: boolean
    canSave: boolean
    tripName: string
    savingName: boolean
    onToggleFavorite: () => void
    onSaveName: () => void
    onDeleteTrip: () => void
    setTripName: (name: string) => void
}

export default function TripHeader({
    onBack,
    results,
    isFavorite,
    canSave,
    tripName,
    savingName,
    onToggleFavorite,
    onSaveName,
    onDeleteTrip,
    setTripName
}: TripHeaderProps) {
    return (
        <div className="glass-panel sticky top-0 z-50 border-b border-white/5 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 md:space-x-4 animate-enter-up">
                        <button
                            onClick={onBack}
                            className="group flex items-center space-x-2 px-3 md:px-4 py-2 md:py-2.5 btn-secondary text-xs md:text-sm hover-lift shadow-sm shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span className="hidden sm:inline">Back to Planning</span>
                            <span className="sm:hidden">Back</span>
                        </button>

                        <div className="h-8 w-px bg-white/10 shrink-0"></div>

                        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                            <div className="p-1.5 md:p-2 bg-surface-highlight rounded-xl md:rounded-2xl shadow-lg border border-white/5 shrink-0">
                                <Navigation className="w-4 h-4 md:w-5 md:h-5 text-neon-blue" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-base md:text-xl font-bold text-white truncate">🎯 Analysis</h1>
                                <div className="text-[10px] md:text-sm text-color-text-secondary flex items-center gap-1.5 truncate">
                                    <MapPin className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" />
                                    <span className="truncate">{results.origin} → {results.destination}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {canSave && (
                        <div className="flex items-center space-x-2 animate-enter-up animation-delay-200 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                            <button
                                onClick={onToggleFavorite}
                                className={`p-2 md:p-2.5 rounded-full transition-all duration-200 hover-lift shrink-0 ${isFavorite
                                    ? 'bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20 shadow-[0_0_15px_rgba(255,255,0,0.1)]'
                                    : 'bg-surface-highlight text-color-text-secondary hover:text-white border border-white/5'
                                    }`}
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
                            </button>

                            <div className="flex items-center space-x-2 shrink-0">
                                <input
                                    type="text"
                                    value={tripName}
                                    onChange={(e) => setTripName(e.target.value)}
                                    placeholder="Trip name..."
                                    className="input-modern py-1.5 md:py-2 px-3 md:px-4 text-xs md:text-sm w-24 sm:w-32 md:w-48"
                                />
                                <button
                                    onClick={onSaveName}
                                    disabled={savingName}
                                    className="px-3 md:px-4 py-1.5 md:py-2 btn-primary text-xs md:text-sm disabled:opacity-50 whitespace-nowrap"
                                >
                                    {savingName ? '...' : 'Save'}
                                </button>
                            </div>

                            <button
                                onClick={onDeleteTrip}
                                className="p-2 md:p-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full hover:bg-red-500/20 transition-all duration-200 hover-lift shrink-0"
                                title="Delete trip"
                            >
                                <X className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
