import { Navigation, Clock, MapPin, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TrafficRoute } from '../lib/trafficService';

interface AlternativeRoutesProps {
  routes: TrafficRoute[];
  selectedRouteId?: string;
  onSelectRoute: (routeId: string) => void;
  onGetDirections: (route: TrafficRoute) => void;
}

export default function AlternativeRoutes({
  routes,
  selectedRouteId,
  onSelectRoute,
  onGetDirections
}: AlternativeRoutesProps) {
  if (routes.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
        <Navigation className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600">No alternative routes available</p>
      </div>
    );
  }

  const getCongestionColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'severe':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCongestionIcon = (level: string) => {
    switch (level) {
      case 'low':
        return '🟢';
      case 'medium':
        return '🟡';
      case 'high':
        return '🟠';
      case 'severe':
        return '🔴';
      default:
        return '⚪';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Alternative Routes</h3>
        <span className="text-sm text-slate-500">{routes.length} options</span>
      </div>

      {routes.map((route) => (
        <div
          key={route.id}
          className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedRouteId === route.id
            ? 'border-emerald-500 bg-emerald-50 shadow-md'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
            }`}
          onClick={() => onSelectRoute(route.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h4 className="font-semibold text-slate-900">{route.name}</h4>
                {selectedRouteId === route.id && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCongestionColor(route.congestionLevel)}`}>
                  {getCongestionIcon(route.congestionLevel)} {(route.congestionLevel || 'unknown').charAt(0).toUpperCase() + (route.congestionLevel || 'unknown').slice(1)}
                </span>
              </div>

              <p className="text-sm text-slate-600 mb-3">{route.summary}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-slate-500">Duration</div>
                    <div className="font-semibold text-slate-900">{route.duration} min</div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-slate-500">Distance</div>
                    <div className="font-semibold text-slate-900">{route.distance} mi</div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-slate-500">Delay</div>
                    <div className="font-semibold text-slate-900">{route.delay} min</div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <Zap className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-slate-500">Efficiency</div>
                    <div className="font-semibold text-slate-900">
                      {Math.round((route.distance / route.duration) * 60)} mph
                    </div>
                  </div>
                </div>
              </div>

              {(route.warnings || []).length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-500 mb-1">Warnings:</div>
                  <div className="flex flex-wrap gap-1">
                    {(route.warnings || []).map((warning, index) => (
                      <span
                        key={index}
                        className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs"
                      >
                        {warning}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="ml-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGetDirections(route);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded text-sm font-medium flex items-center space-x-1 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                <span>Directions</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
