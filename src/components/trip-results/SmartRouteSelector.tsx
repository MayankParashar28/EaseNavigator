import { Zap, Navigation, Leaf } from 'lucide-react';
import type { RouteWithGeometry } from "../TripResults";

interface SmartRouteSelectorProps {
    routes: RouteWithGeometry[];
    selectedRouteId: string;
    onSelectRoute: (route: RouteWithGeometry) => void;
}

export default function SmartRouteSelector({ routes, selectedRouteId, onSelectRoute }: SmartRouteSelectorProps) {
    const getIcon = (name: string) => {
        if (name.includes('Fastest')) return <Zap className="w-4 h-4" />;
        if (name.includes('Efficient')) return <Leaf className="w-4 h-4" />;
        return <Navigation className="w-4 h-4" />;
    };

    const getLabel = (name: string) => {
        if (name.includes('Fastest')) return 'Fastest';
        if (name.includes('Efficient')) return 'Most Efficient';
        return 'Fewer Stops';
    };

    const getColor = (name: string, isSelected: boolean) => {
        if (!isSelected) return 'border-white/5 bg-white/5 hover:border-white/20';
        if (name.includes('Fastest')) return 'border-neon-blue/50 bg-neon-blue/10 text-white shadow-[0_0_20px_rgba(0,240,255,0.15)]';
        if (name.includes('Efficient')) return 'border-neon-green/50 bg-neon-green/10 text-white shadow-[0_0_20px_rgba(44,182,125,0.15)]';
        return 'border-neon-purple/50 bg-neon-purple/10 text-white shadow-[0_0_20px_rgba(127,90,240,0.15)]';
    };

    const getIconColor = (name: string, isSelected: boolean) => {
        if (!isSelected) return 'text-gray-500';
        if (name.includes('Fastest')) return 'text-neon-blue';
        if (name.includes('Efficient')) return 'text-neon-green';
        return 'text-neon-purple';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {routes.slice(0, 3).map((route) => {
                const isSelected = selectedRouteId === route.id;
                const label = getLabel(route.name);

                return (
                    <button
                        key={route.id}
                        onClick={() => onSelectRoute(route)}
                        className={`relative flex flex-col p-5 rounded-[2rem] border transition-all duration-300 text-left ${getColor(route.name, isSelected)}`}
                    >
                        {/* Tag */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`p-1.5 rounded-lg bg-black/20 ${getIconColor(route.name, isSelected)}`}>
                                {getIcon(route.name)}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                {label}
                            </span>
                        </div>

                        {/* Metrics */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black">{Math.floor(route.duration / 60)}h {route.duration % 60}m</span>
                                <span className="text-xs font-bold text-gray-500">{route.distance} mi</span>
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md">
                                    <Zap className="w-3 h-3 text-yellow-500" />
                                    <span className="text-[10px] font-bold text-gray-400">{route.chargingStops} {route.chargingStops === 1 ? 'stop' : 'stops'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md">
                                    <span className="text-[10px] font-bold text-neon-green">${route.estimatedCost.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Selection indicator */}
                        {isSelected && (
                            <div className={`absolute top-4 right-4 w-2 h-2 rounded-full animate-pulse ${getIconColor(route.name, true)} bg-current`} />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
