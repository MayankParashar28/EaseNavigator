import { MapPinOff, Navigation, Zap } from 'lucide-react';

interface MapUnavailableProps {
  reason: 'missing-key' | 'invalid-key';
  origin: string;
  destination: string;
  stationCount: number;
}

/** Shown in place of the map when Google Maps can't load. */
export default function MapUnavailable({ reason, origin, destination, stationCount }: MapUnavailableProps) {
  const message = reason === 'missing-key'
    ? 'The interactive map needs a Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY to turn it on.'
    : "Google Maps didn't accept the API key. Check that the key is valid and allowed for this website.";

  return (
    <div role="status" className="h-full w-full flex flex-col items-center justify-center gap-6 bg-surface p-6 text-center">
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
        <MapPinOff className="w-8 h-8 text-color-text-tertiary" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-2">
        <h3 className="text-lg font-bold text-white">Map unavailable</h3>
        <p className="text-sm text-color-text-secondary leading-relaxed">{message}</p>
      </div>
      <div className="w-full max-w-sm space-y-2 text-left">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 px-4 py-3">
          <Navigation className="w-4 h-4 shrink-0 text-neon-blue" aria-hidden="true" />
          <span className="text-sm text-white truncate">{origin} → {destination}</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 px-4 py-3">
          <Zap className="w-4 h-4 shrink-0 text-neon-green" aria-hidden="true" />
          <span className="text-sm text-white">
            {stationCount > 0 ? `${stationCount} charging stations along your route (see the charging plan)` : 'No charging stations found along this route'}
          </span>
        </div>
      </div>
    </div>
  );
}
