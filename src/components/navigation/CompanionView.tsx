/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import { X, Navigation, Zap, ExternalLink, MapPin } from 'lucide-react';

interface Station {
    id: number;
    title: string;
    latitude: number;
    longitude: number;
    address?: string;
    powerKW?: number;
    connectionType?: string;
    network?: string;
}

interface CompanionViewProps {
    route: {
        name: string;
        distance: number;
        duration: number;
        geometry?: [number, number][];
    };
    onExit: () => void;
    evModel: { range_miles: number };
    batteryLevel: number;
    origin: string;
    destination: string;
    stations?: Station[];
}

export default function CompanionView({ route, onExit, evModel, batteryLevel, origin, destination, stations = [] }: CompanionViewProps) {
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'error'>('searching');

    // Real geolocation tracking
    useEffect(() => {
        if (!("geolocation" in navigator)) {
            setGpsStatus('error');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setGpsStatus('active');
                // Convert m/s to mph
                const speedMps = position.coords.speed || 0;
                const speedMph = Math.round(speedMps * 2.23694);
                setCurrentSpeed(speedMph);
            },
            (error) => {
                console.error("GPS Error:", error);
                setGpsStatus('error');
            },
            { enableHighAccuracy: true }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const openInExternalMaps = () => {
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const nextStation = stations[0];

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col text-white p-6 pb-safe-area animate-fade-in">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${gpsStatus === 'active' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : gpsStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <span className={`font-bold tracking-wider text-sm transition-colors ${gpsStatus === 'active' ? 'text-green-500' : 'text-gray-400'}`}>
                        {gpsStatus === 'active' ? 'GPS ACTIVE' : gpsStatus === 'error' ? 'GPS ERROR' : 'SEARCHING FOR GPS...'}
                    </span>
                </div>
                <button
                    onClick={onExit}
                    className="bg-white/10 p-4 rounded-2xl active:bg-white/20 transition-all border border-white/5"
                >
                    <X className="w-7 h-7" />
                </button>
            </div>

            {/* Main Direction / Destination */}
            <div className="flex-1 flex flex-col justify-center mb-8">
                <div className="space-y-6">
                    <div className="flex items-center gap-3 text-neon-blue">
                        <MapPin className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-widest">En Route To</span>
                    </div>
                    <h1 className="text-5xl font-black leading-tight tracking-tighter">
                        {destination}
                    </h1>
                    <div className="flex items-center gap-2 text-xl text-gray-400">
                        <Navigation className="w-6 h-6 text-neon-blue fill-current" />
                        <span>{route.name} • {route.distance} mi total</span>
                    </div>
                </div>
            </div>

            {/* External App Link */}
            <button
                onClick={openInExternalMaps}
                className="w-full bg-white text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 mb-8 shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-[0.98] transition-all text-xl"
            >
                <ExternalLink className="w-6 h-6" />
                LAUNCH GOOGLE MAPS
            </button>

            {/* Hero Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Speed */}
                <div className="bg-white/5 rounded-[2.5rem] p-8 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-neon-blue/5 opacity-0 group-active:opacity-100 transition-opacity" />
                    <span className="text-sm text-gray-500 font-bold tracking-widest mb-2">SPEED</span>
                    <div className="text-7xl font-black tracking-tighter tabular-nums flex items-baseline">
                        {currentSpeed}
                    </div>
                    <span className="text-xs text-neon-blue font-bold mt-1">MPH</span>
                </div>

                {/* Battery */}
                <div className="bg-white/5 rounded-[2.5rem] p-8 flex flex-col items-center justify-center border border-white/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-neon-green/5 opacity-0 group-active:opacity-100 transition-opacity" />
                    <span className="text-sm text-gray-500 font-bold tracking-widest mb-2">BATTERY</span>
                    <div className={`text-7xl font-black tracking-tighter tabular-nums ${batteryLevel < 20 ? 'text-red-500' : 'text-neon-green'}`}>
                        {batteryLevel}
                    </div>
                    <span className="text-xs text-gray-400 font-bold mt-1">
                        {Math.round(batteryLevel / 100 * evModel.range_miles)} MI LEFT
                    </span>
                </div>
            </div>

            {/* Next Stop Card */}
            {nextStation ? (
                <div className="bg-gradient-to-br from-neon-purple/20 to-surface-highlight border border-neon-purple/30 rounded-[2.5rem] p-8 mb-2">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-neon-purple/20 rounded-2xl">
                            <Zap className="w-8 h-8 text-neon-purple" fill="currentColor" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-neon-purple font-black uppercase tracking-[0.2em] mb-1">Upcoming Charger</div>
                            <div className="text-2xl font-bold truncate">{nextStation.title}</div>
                            <div className="text-gray-400 font-medium">
                                {nextStation.powerKW ? `${nextStation.powerKW}kW Fast Charging` : 'Standard Charger'}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-2 text-center text-gray-500 font-bold tracking-wide">
                    NO CHARGING STOPS REQUIRED
                </div>
            )}
        </div>
    );
}
