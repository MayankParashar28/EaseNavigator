import { useState } from 'react';
import { Clock, Coffee, Wifi, ShoppingBag, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface Station {
    id: number;
    title: string;
    latitude: number;
    longitude: number;
    address?: string;
    powerKW?: number;
    connectionType?: string;
    network?: string;
    availablePorts?: number;
    totalPorts?: number;
    pricing?: {
        perKWh: number;
        currency: string;
    };
    amenities?: {
        restrooms: boolean;
        foodNearby: boolean;
        shopping: boolean;
        wifi: boolean;
    };
}

interface ChargingStopCardProps {
    station: Station;
    stopNumber: number;
    arrivalSOC: number;
    chargeTime: number; // minutes
    alternatives?: Station[];
}

export default function ChargingStopCard({ station, stopNumber, arrivalSOC, chargeTime, alternatives = [] }: ChargingStopCardProps) {
    const [showAlternatives, setShowAlternatives] = useState(false);

    // Simulated availability if not provided
    const total = station.totalPorts || 4;
    const available = station.availablePorts ?? Math.floor(Math.random() * (total + 1));
    const queueTime = available === 0 ? Math.floor(Math.random() * 15) + 5 : 0;

    return (
        <div className="glass-panel border border-white/10 overflow-hidden transition-all duration-300 hover:border-neon-purple/30 group">
            {/* Header */}
            <div className="p-5 flex flex-col sm:flex-row justify-between items-start gap-4 bg-gradient-to-br from-white/5 to-transparent">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-neon-purple/20 text-neon-purple text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-neon-purple/20">
                            Stop #{stopNumber}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${available > 0 ? 'state-success' : 'state-error'}`}>
                            {available}/{total} Available
                        </span>
                    </div>
                    <h4 className="text-lg font-bold text-white leading-tight truncate" title={station.title}>{station.title}</h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5" title={station.address}>{station.address}</p>
                </div>
                <div className="flex items-center sm:items-end sm:flex-col justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    <div className="text-2xl font-black text-white">{station.powerKW || 50}<span className="text-xs font-bold text-gray-500 ml-1">kW</span></div>
                    <div className="text-[10px] font-bold text-neon-blue uppercase tracking-wider">{station.connectionType || 'CCS'}</div>
                </div>
            </div>

            {/* Main Stats */}
            <div className="px-5 py-4 grid grid-cols-3 gap-2 border-y border-white/5 bg-black/20">
                <div className="flex flex-col items-center p-2 rounded-xl bg-white/5">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mb-1">Arrival</span>
                    <span className="text-sm font-black text-neon-green">{arrivalSOC}%</span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-xl bg-white/5">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mb-1">Duration</span>
                    <span className="text-sm font-black text-white">{chargeTime}m</span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-xl bg-white/5">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mb-1">Price</span>
                    <span className="text-sm font-black text-neon-blue">${station.pricing?.perKWh || '0.35'}/kWh</span>
                </div>
            </div>

            {/* Amenities & Status */}
            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {station.amenities?.foodNearby && <Coffee className="w-4 h-4 text-neon-purple" />}
                        {station.amenities?.restrooms && <Info className="w-4 h-4 text-gray-400" />}
                        {station.amenities?.wifi && <Wifi className="w-4 h-4 text-neon-blue" />}
                        {station.amenities?.shopping && <ShoppingBag className="w-4 h-4 text-neon-green" />}
                    </div>
                    {queueTime > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-yellow-500 font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>~{queueTime}m wait</span>
                        </div>
                    )}
                </div>

                {/* Alternatives Toggle */}
                {alternatives.length > 0 && (
                    <button
                        onClick={() => setShowAlternatives(!showAlternatives)}
                        className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 text-xs font-bold text-gray-400 hover:bg-white/10 transition-colors"
                    >
                        <span>Alternative Stations</span>
                        {showAlternatives ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                )}

                {/* Alternatives List */}
                {showAlternatives && alternatives.length > 0 && (
                    <div className="mt-2 space-y-2 animate-fade-in">
                        {alternatives.map((alt) => (
                            <div key={alt.id} className="p-3 rounded-xl border border-white/5 bg-black/40 flex justify-between items-center">
                                <div>
                                    <div className="text-xs font-bold text-white">{alt.title}</div>
                                    <div className="text-[10px] text-gray-400">{alt.network} • {alt.powerKW}kW</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-neon-blue">${alt.pricing?.perKWh || '0.38'}</div>
                                    <div className="text-[9px] font-bold text-gray-500 uppercase">Per kWh</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
