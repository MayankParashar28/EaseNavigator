
import { useState, useEffect } from 'react';
import { X, Navigation, Zap } from 'lucide-react';

interface CompanionViewProps {
    route: unknown; // Using unknown for flexibility
    onExit: () => void;
    evModel: { range_miles: number };
    batteryLevel: number;
}

export default function CompanionView({ onExit, evModel, batteryLevel }: Omit<CompanionViewProps, 'route'>) {
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [distanceToNext, setDistanceToNext] = useState(45); // mocked
    const [nextInstruction] = useState("Head North on I-5");

    // Simulation effect
    useEffect(() => {
        const interval = setInterval(() => {
            // Fluctuate speed between 60-70 mph
            setCurrentSpeed(Math.floor(Math.random() * 10) + 60);
            // Decrease distance slightly
            setDistanceToNext(prev => Math.max(0, prev - 0.1));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col text-white p-6 pb-safe-area">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-bold text-green-500 tracking-wider">LIVE NAV</span>
                </div>
                <button
                    onClick={onExit}
                    className="bg-white/10 p-4 rounded-full active:bg-white/20 transition-colors"
                >
                    <X className="w-8 h-8" />
                </button>
            </div>

            {/* Main Direction */}
            <div className="flex-1 flex flex-col justify-center mb-8">
                <div className="flex items-start gap-4 mb-4">
                    <Navigation className="w-16 h-16 text-neon-blue mt-1" />
                    <div>
                        <h1 className="text-5xl font-black leading-tight mb-2">
                            {nextInstruction}
                        </h1>
                        <p className="text-2xl text-gray-400">
                            Next turn in <span className="text-white font-bold">{districtToMiles(distanceToNext)}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Hero Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                {/* Speed */}
                <div className="bg-white/10 rounded-3xl p-6 flex flex-col items-center justify-center border-2 border-white/5">
                    <span className="text-xl text-gray-400 font-medium mb-1">SPEED</span>
                    <div className="text-6xl font-black tracking-tighter">
                        {currentSpeed}
                    </div>
                    <span className="text-sm text-gray-400">MPH</span>
                </div>

                {/* Battery */}
                <div className="bg-white/10 rounded-3xl p-6 flex flex-col items-center justify-center border-2 border-white/5">
                    <span className="text-xl text-gray-400 font-medium mb-1">BATTERY</span>
                    <div className={`text-6xl font-black tracking-tighter ${batteryLevel < 20 ? 'text-red-500' : 'text-neon-green'}`}>
                        {batteryLevel}%
                    </div>
                    <span className="text-sm text-gray-400">
                        {Math.round(batteryLevel / 100 * evModel.range_miles)} mi
                    </span>
                </div>
            </div>

            {/* Next Stop Card */}
            <div className="bg-neon-purple/20 border border-neon-purple/30 rounded-3xl p-6 mb-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-neon-purple/20 rounded-full">
                        <Zap className="w-8 h-8 text-neon-purple" />
                    </div>
                    <div>
                        <div className="text-sm text-neon-purple font-bold uppercase tracking-wider mb-1">Next Charging Stop</div>
                        <div className="text-2xl font-bold">Supercharger - San Jose</div>
                        <div className="text-white/60">Arriving in 42 min</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function districtToMiles(d: number) {
    return d.toFixed(1) + " mi";
}
