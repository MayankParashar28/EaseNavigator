import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Zap, Activity } from 'lucide-react';
import type { Station } from './types';
import { useLatest } from './useLatest';

export function FlyoverController({
  routeGeometry,
  isPlaying,
  speedMultiplier = 1,
  onMetricsUpdate,
  onStop,
  totalDistance = 150
}: {
  routeGeometry: [number, number][],
  isPlaying: boolean,
  speedMultiplier?: number,
  onMetricsUpdate?: (metrics: { speed: number, efficiency: number, milesRemaining: number, currentSoC: number, progress: number }) => void,
  onStop: () => void,
  totalDistance?: number
}) {
  const map = useMap();
  const onMetricsUpdateRef = useLatest(onMetricsUpdate);
  const totalDistanceRef = useLatest(totalDistance);

  useEffect(() => {
    if (!map || !isPlaying || !routeGeometry || routeGeometry.length < 2) return;

    let startTime: number | null = null;
    const baseDuration = 30000; // 30 seconds base for full route
    const duration = baseDuration / speedMultiplier;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / duration;

      if (progress >= 1) {
        onStop();
        return;
      }

      // Calculate current position index
      const totalPoints = routeGeometry.length;
      const currentIndex = Math.floor(progress * (totalPoints - 1));
      const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);

      const p1 = routeGeometry[currentIndex];
      const p2 = routeGeometry[nextIndex];

      const segmentProgress = (progress * (totalPoints - 1)) - currentIndex;
      const lat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
      const lng = p1[1] + (p2[1] - p1[1]) * segmentProgress;

      const dy = p2[0] - p1[0];
      const dx = Math.cos(Math.PI / 180 * p1[0]) * (p2[1] - p1[1]);
      const angle = Math.atan2(dy, dx);
      let heading = angle * 180 / Math.PI;
      heading = 90 - heading;

      map.moveCamera({
        center: { lat, lng },
        zoom: 17,
        tilt: 65,
        heading: heading
      });

      // Update Simulated Metrics
      if (onMetricsUpdateRef.current) {
        onMetricsUpdateRef.current({
          speed: Math.round(65 + Math.random() * 5),
          efficiency: 0.25 + Math.random() * 0.1,
          milesRemaining: Math.max(0, Math.round((1 - progress) * totalDistanceRef.current)),
          currentSoC: Math.max(15, 80 - progress * 65), // Starts at 80, drops to 15
          progress
        });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [map, isPlaying, routeGeometry, speedMultiplier, onStop, onMetricsUpdateRef, totalDistanceRef]);

  return null;
}

export function SimulationHUD({
  metrics,
  origin,
  destination,
  stations
}: {
  metrics: { speed: number, efficiency: number, milesRemaining: number, currentSoC: number, progress: number },
  origin: string,
  destination: string,
  stations: Station[]
}) {
  const nextStation = stations.find((_, i) => (i / stations.length) > metrics.progress) || stations[stations.length - 1];

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Top Narrative Bar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
        <div className="glass-card bg-midnight/80 backdrop-blur-xl border-white/10 p-3 md:p-4 rounded-3xl shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Origin</span>
              <span className="text-xs font-bold text-white truncate max-w-[120px]">{origin.split(',')[0]}</span>
            </div>

            <div className="flex-1 h-1.5 bg-white/10 rounded-full relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-neon-blue shadow-[0_0_10px_rgba(0,210,255,1)] transition-all duration-300"
                style={{ width: `${metrics.progress * 100}%` }}
              />
              {/* Stops on timeline */}
              {stations.map((station, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-white/30 border border-white/10 -translate-y-1/4"
                  style={{ left: `${((i + 1) / (stations.length + 1)) * 100}%` }}
                  title={station.title}
                />
              ))}
            </div>

            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Destination</span>
              <span className="text-xs font-bold text-white truncate max-w-[120px]">{destination.split(',')[0]}</span>
            </div>
          </div>

          <div className="ml-8 pl-8 border-l border-white/10 flex items-center gap-4">
            <div className="text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Battery</div>
              <div className="text-sm font-bold text-neon-green">{Math.round(metrics.currentSoC)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stop Progress Overlay (Bottom Left) */}
      <div className="absolute bottom-32 left-8 w-64 animate-in slide-in-from-left duration-500">
        <div className="glass-card bg-midnight/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-20">
            <Zap className="w-12 h-12 text-neon-blue" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest">Next Stop</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                <span className="text-[9px] font-bold text-gray-400 uppercase">En Route</span>
              </div>
            </div>

            <h4 className="text-sm font-bold text-white mb-1 truncate">{nextStation?.title || 'Destination'}</h4>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-2xl font-black text-white italic">
                {Math.max(1, Math.round(metrics.milesRemaining * 0.4))}
              </span>
              <span className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase">Miles to Stop</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-bold">
                <span className="text-gray-400 uppercase">Distance Progress</span>
                <span className="text-neon-blue">{Math.round((metrics.progress % 0.3) / 0.3 * 100)}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-blue to-neon-purple shadow-[0_0_8px_rgba(0,210,255,0.4)] transition-all duration-1000"
                  style={{ width: `${(metrics.progress % 0.3) / 0.3 * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-neon-blue" />
                <span className="text-[10px] font-bold text-white">ETA: {Math.round(metrics.milesRemaining * 0.45)}m</span>
              </div>
              <div className="text-[9px] font-black text-neon-green uppercase italic">Optimal Speed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Telemetry Sidebar */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 space-y-4">
        <div className="glass-card bg-midnight/60 backdrop-blur-md border-white/5 p-3 md:p-4 rounded-2xl w-28 md:w-32 space-y-4 shadow-xl">
          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3 text-neon-blue" /> Speed
            </div>
            <div className="text-xl font-black text-white italic">
              {metrics.speed}<span className="text-[10px] font-normal ml-1 not-italic opacity-40">MPH</span>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> Efficiency
            </div>
            <div className="text-sm font-bold text-white">
              {metrics.efficiency.toFixed(2)}<span className="text-[8px] font-normal ml-1 opacity-40">kWh/mi</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <div className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Remaining</div>
            <div className="text-xs font-bold text-white">{Math.round(metrics.milesRemaining)} miles</div>
          </div>
        </div>
      </div>
    </div>
  );
}
