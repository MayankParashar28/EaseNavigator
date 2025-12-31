import { AlertTriangle, Clock, Construction, X, RefreshCw, Navigation } from 'lucide-react';
import { TrafficAlert, TrafficData } from '../lib/trafficService';

interface TrafficAlertsProps {
  alerts: TrafficAlert[];
  trafficData: TrafficData;
  onDismissAlert: (alertId: string) => void;
  onViewAlternatives: () => void;
  onRefreshTraffic: () => void;
}

export default function TrafficAlerts({
  alerts,
  trafficData,
  onDismissAlert,
  onViewAlternatives,
  onRefreshTraffic
}: TrafficAlertsProps) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'error':
        return <Construction className="w-4 h-4" />;
      case 'info':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/20 text-white';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/20 text-white';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/20 text-white';
      case 'low':
        return 'bg-blue-500/10 border-blue-500/20 text-white';
      default:
        return 'bg-white/5 border-white/10 text-white';
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-green-800">All Clear!</h4>
              <p className="text-sm text-green-600">No traffic alerts at this time</p>
            </div>
          </div>
          <button
            onClick={onRefreshTraffic}
            className="bg-green-500/20 hover:bg-green-500/30 text-green-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>
        <div className="text-xs text-green-500 mt-3">
          Last updated: {new Date(trafficData.lastUpdated).toLocaleTimeString()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Traffic Alerts Header */}
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-orange-800">Traffic Alerts</h4>
              <p className="text-sm text-orange-600">{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onRefreshTraffic}
            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>
      </div>

      {/* Traffic Alerts */}
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border rounded - 2xl p - 6 shadow - lg ${getAlertColor(alert.severity)} `}
        >
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 mt-1">
              <div className={`w - 10 h - 10 rounded - xl flex items - center justify - center ${alert.severity === 'critical' ? 'bg-red-500/20' :
                alert.severity === 'high' ? 'bg-orange-500/20' :
                  alert.severity === 'medium' ? 'bg-yellow-500/20' :
                    'bg-blue-500/20'
                } `}>
                {getAlertIcon(alert.type)}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-semibold">{alert.title}</h4>
                {alert.dismissible && (
                  <button
                    onClick={() => onDismissAlert(alert.id)}
                    className="text-color-text-tertiary hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <p className="text-base mb-4 leading-relaxed">{alert.message}</p>

              {alert.action && (
                <button
                  onClick={onViewAlternatives}
                  className="inline-flex items-center space-x-2 text-sm font-medium hover:underline bg-surface-highlight px-4 py-2 rounded-lg transition-all duration-200 hover:bg-white/10 border border-white/5"
                >
                  <Navigation className="w-4 h-4" />
                  <span>{alert.action}</span>
                </button>
              )}

              {alert.expiresAt && (
                <div className="text-xs mt-3 opacity-75 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Expires: {new Date(alert.expiresAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
