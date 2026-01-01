import { MapPin, Zap, Flag, Clock, Coffee, Wifi, ShoppingBag } from 'lucide-react';

interface TimelineNode {
    type: 'start' | 'stop' | 'end';
    label: string;
    subLabel?: string;
    time?: string;
    duration?: string;
    soc?: number;
    amenities?: {
        foodNearby: boolean;
        restrooms: boolean;
        wifi: boolean;
        shopping: boolean;
    };
    trafficLevel?: 'low' | 'moderate' | 'heavy';
}

interface JourneyTimelineProps {
    origin: string;
    destination: string;
    stops: Array<{
        location: string;
        dwellTime: number;
        arrivalSOC: number;
        amenities?: {
            foodNearby: boolean;
            restrooms: boolean;
            wifi: boolean;
            shopping: boolean;
        };
        trafficLevel?: 'low' | 'moderate' | 'heavy';
    }>;
    totalDuration: number;
    hoveredIndex?: number | null;
    onHover?: (index: number | null) => void;
    onNodeClick?: (index: number, type: 'start' | 'stop' | 'end') => void;
}

export default function JourneyTimeline({ origin, destination, stops, totalDuration, hoveredIndex, onHover, onNodeClick }: JourneyTimelineProps) {
    const nodes: TimelineNode[] = [
        { type: 'start', label: origin, subLabel: 'Departure', time: '0:00' },
        ...stops.map((s, i) => ({
            type: 'stop' as const,
            label: s.location,
            subLabel: `Charging Stop ${i + 1}`,
            duration: `${s.dwellTime}m`,
            soc: s.arrivalSOC,
            amenities: s.amenities,
            trafficLevel: s.trafficLevel
        })),
        { type: 'end', label: destination, subLabel: 'Arrival', time: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m` }
    ];

    return (
        <div className="glass-card p-3 md:p-4 border border-white/5 relative overflow-hidden flex flex-col w-full">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 relative z-10 shrink-0">
                <Clock className="w-4 h-4 text-neon-purple" />
                Journey Plan
            </h3>

            <div className="relative z-10 flex flex-row items-stretch gap-4 overflow-x-auto custom-scrollbar pb-2 px-1">
                {nodes.map((node, i) => {
                    // Helper for dynamic SOC color
                    const getSocColor = (soc?: number) => {
                        if (soc === undefined) return 'text-neon-green bg-neon-green/10 border-neon-green/10';
                        if (soc > 50) return 'text-neon-green bg-neon-green/10 border-neon-green/10';
                        if (soc > 20) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/10';
                        return 'text-red-500 bg-red-500/10 border-red-500/10';
                    };
                    const socColorClass = getSocColor(node.soc);

                    return (
                        <div
                            key={i}
                            className={`relative flex-shrink-0 w-52 p-3 rounded-xl border backdrop-blur-md transition-all duration-300 cursor-pointer flex flex-col justify-between group ${hoveredIndex === i ? 'bg-white/10 border-neon-blue shadow-lg shadow-neon-blue/20 scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            onMouseEnter={() => onHover?.(i)}
                            onMouseLeave={() => onHover?.(null)}
                            onClick={() => onNodeClick?.(i, node.type)}
                        >
                            {/* Connecting Line (Horizontal) */}
                            {i < nodes.length - 1 && (
                                <div className={`absolute top-1/2 left-full w-4 h-[2px] -translate-y-1/2 z-0 overflow-hidden ${node.trafficLevel === 'heavy' ? 'bg-red-500/50' :
                                    node.trafficLevel === 'moderate' ? 'bg-yellow-500/50' :
                                        'bg-white/10'
                                    }`}>
                                    {/* Animated Flow Effect */}
                                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-full -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]`} />

                                    <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full border border-midnight z-10 ${node.trafficLevel === 'heavy' ? 'bg-red-500' :
                                        node.trafficLevel === 'moderate' ? 'bg-yellow-500' :
                                            'bg-white/40'
                                        }`} />
                                </div>
                            )}

                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${node.type === 'start' ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' :
                                    node.type === 'end' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                                        'bg-neon-purple/10 border-neon-purple/30 text-neon-purple'
                                    }`}>
                                    {node.type === 'start' && <MapPin className="w-4 h-4" />}
                                    {node.type === 'stop' && <Zap className="w-4 h-4" />}
                                    {node.type === 'end' && <Flag className="w-4 h-4" />}
                                </div>
                                {node.time && (
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">ETA</span>
                                        <span className="text-xs font-mono font-bold text-white leading-none mt-0.5">
                                            {node.time}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Card Body */}
                            <div className="mb-2">
                                <h4 className="font-bold text-white text-sm mb-0.5 truncate leading-tight" title={node.label}>
                                    {node.label}
                                </h4>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    {node.subLabel}
                                </div>
                            </div>

                            {/* Card Footer: Metrics & Amenities */}
                            <div className="space-y-2">
                                {/* Metrics Tags */}
                                <div className="flex flex-wrap gap-1.5">
                                    {node.duration && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-neon-purple bg-neon-purple/10 px-1.5 py-0.5 rounded-md border border-neon-purple/10">
                                            <Clock className="w-3 h-3" /> {node.duration}
                                        </span>
                                    )}
                                    {node.soc !== undefined && (
                                        <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${socColorClass}`}>
                                            <Zap className="w-3 h-3" /> {node.soc}%
                                        </span>
                                    )}
                                </div>

                                {/* Amenities Row */}
                                {node.amenities && (
                                    <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                                        {node.amenities.foodNearby && (
                                            <div title="Food / Dining" className="p-1 rounded-md bg-orange-400/10 hover:bg-orange-400/20 transition-colors">
                                                <Coffee className="w-3 h-3 text-orange-400" />
                                            </div>
                                        )}
                                        {node.amenities.restrooms && (
                                            <div title="Restrooms" className="p-1 rounded-md bg-indigo-400/10 hover:bg-indigo-400/20 transition-colors">
                                                <div className="w-3 h-3 text-indigo-400 font-bold text-[8px] flex items-center justify-center border border-indigo-400 rounded-full">WC</div>
                                            </div>
                                        )}
                                        {node.amenities.wifi && (
                                            <div title="WiFi" className="p-1 rounded-md bg-blue-400/10 hover:bg-blue-400/20 transition-colors">
                                                <Wifi className="w-3 h-3 text-blue-400" />
                                            </div>
                                        )}
                                        {node.amenities.shopping && (
                                            <div title="Shopping" className="p-1 rounded-md bg-pink-400/10 hover:bg-pink-400/20 transition-colors">
                                                <ShoppingBag className="w-3 h-3 text-pink-400" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
