import { useMemo } from 'react';

interface ElevationProfileProps {
    distance: number; // miles
    className?: string;
}

export default function ElevationProfile({ distance, className = "" }: ElevationProfileProps) {
    // Generate mock elevation data points based on distance
    const points = useMemo(() => {
        const numPoints = 50;
        const data = [];
        let currentHeight = 100 + Math.random() * 200;

        for (let i = 0; i <= numPoints; i++) {
            // Random walk with some trend
            const change = (Math.random() - 0.45) * 40;
            currentHeight = Math.max(0, currentHeight + change);
            data.push({
                x: (i / numPoints) * 100,
                y: currentHeight
            });
        }
        return data;
    }, [distance]);

    const maxElevation = Math.max(...points.map(p => p.y));
    const minElevation = Math.min(...points.map(p => p.y));
    const range = maxElevation - minElevation + 20;

    const pathData = useMemo(() => {
        if (points.length === 0) return "";
        const scaledPoints = points.map(p => ({
            x: p.x,
            y: 100 - ((p.y - minElevation + 10) / range) * 80
        }));

        let d = `M ${scaledPoints[0].x} 100`;
        scaledPoints.forEach(p => {
            d += ` L ${p.x} ${p.y}`;
        });
        d += ` L 100 100 Z`;
        return d;
    }, [points, minElevation, range]);

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex justify-between items-end text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                <span>Elevation Profile</span>
                <span className="text-indigo-500">{Math.round(maxElevation)}ft peak</span>
            </div>

            <div className="relative h-16 w-full bg-indigo-50/30 rounded-lg overflow-hidden border border-indigo-100/50">
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full"
                >
                    <defs>
                        <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
                        </linearGradient>
                    </defs>
                    <path
                        d={pathData}
                        fill="url(#elevationGradient)"
                        stroke="#4338ca"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>

                {/* Distance markers */}
                <div className="absolute bottom-1 left-0 right-0 px-2 flex justify-between text-[7px] text-indigo-400 font-medium">
                    <span>0 mi</span>
                    <span>{Math.round(distance / 2)} mi</span>
                    <span>{Math.round(distance)} mi</span>
                </div>
            </div>
        </div>
    );
}
