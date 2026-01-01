import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserTrips, updateTripFavorite, updateTripName, deleteTrip, type UserTrip } from '../lib/localStorage';
import { Star, Trash2, Pencil, Check, X, Navigation, Battery } from 'lucide-react';

interface Props {
  onClose?: () => void;
  onReplan?: (trip: UserTrip) => void;
  onViewDetails?: (trip: UserTrip) => void;
}

export default function TripHistory({ onClose, onReplan, onViewDetails }: Props) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = getUserTrips(user.id, favoritesOnly);
        setTrips(data || []);
      } catch (err) {
        console.error("Failed to load trips", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, favoritesOnly]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(t =>
      (t.trip_name || '').toLowerCase().includes(q) ||
      t.origin_address.toLowerCase().includes(q) ||
      t.destination_address.toLowerCase().includes(q)
    );
  }, [trips, search]);

  const toggleFavorite = async (trip: UserTrip) => {
    if (!trip.id || !user) return;
    const updated = updateTripFavorite(trip.id, user.id, !trip.is_favorite);
    if (updated) {
      setTrips(prev => prev.map(t => t.id === trip.id ? updated : t));
    }
  };

  const startEdit = (trip: UserTrip) => {
    setEditingId(trip.id || null);
    setEditingName(trip.trip_name || '');
  };

  const saveEdit = async () => {
    if (!editingId || !user) return;
    const updated = updateTripName(editingId, user.id, editingName);
    if (updated) {
      setTrips(prev => prev.map(t => t.id === editingId ? updated : t));
      setEditingId(null);
      setEditingName('');
    }
  };

  const removeTrip = async (trip: UserTrip) => {
    if (!trip.id || !user) return;
    if (confirm('Are you sure you want to delete this trip from your history?')) {
      deleteTrip(trip.id, user.id);
      setTrips(prev => prev.filter(t => t.id !== trip.id));
    }
  };

  return (
    <div className="glass-card border border-white/5 bg-surface/90 backdrop-blur-xl p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 rounded-full blur-[60px] pointer-events-none"></div>

      <div className="flex items-center justify-between mb-6 relative z-10">
        <h2 className="text-xl font-bold text-white tracking-tight">Trip History</h2>
        {onClose && (
          <button onClick={onClose} className="text-color-text-secondary hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 relative z-10">
        <div className="relative flex-1 w-full">
          <input
            placeholder="Search trips..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-modern py-2.5"
          />
        </div>
        <label className="flex items-center gap-3 text-sm font-medium text-color-text-secondary cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={e => setFavoritesOnly(e.target.checked)}
            className="w-4 h-4 rounded border-white/10 bg-white/5 text-neon-purple focus:ring-neon-purple/50"
          />
          Favorites only
        </label>
      </div>

      {loading ? (
        <div className="text-color-text-secondary flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-purple"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-color-text-secondary text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
          No trips found matching your criteria.
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-auto pr-2 custom-scrollbar relative z-10">
          {filtered.map(trip => (
            <div key={trip.id} className="glass-card bg-surface-highlight/40 border border-white/5 p-4 hover:border-white/20 transition-all duration-300 group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editingId === trip.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="input-modern py-1.5 text-sm"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        placeholder="Trip name"
                        autoFocus
                      />
                      <button onClick={saveEdit} className="p-2 rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20 transition-all"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-color-text-tertiary hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="text-base font-bold text-white truncate group-hover:text-neon-blue transition-colors">
                      {trip.trip_name || `${trip.origin_address.split(',')[0]} → ${trip.destination_address.split(',')[0]}`}
                    </div>
                  )}
                  <div className="text-[10px] text-color-text-tertiary mt-1 font-medium flex items-center gap-1.5">
                    <ClockIcon className="w-3 h-3" />
                    {new Date(trip.created_at || '').toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => toggleFavorite(trip)} className="p-2 text-color-text-tertiary hover:text-white transition-colors">
                    {trip.is_favorite ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : <Star className="w-4 h-4" />}
                  </button>
                  <button onClick={() => startEdit(trip)} className="p-2 text-color-text-tertiary hover:text-white transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => removeTrip(trip)} className="p-2 text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[10px] font-bold text-color-text-tertiary mt-4 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Battery className="w-3 h-3 text-neon-green" />
                  <span>Charge: {trip.starting_battery_percent}%</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <CarIcon className="w-3 h-3 text-neon-purple" />
                  <span className="truncate">EV: {trip.ev_model_id}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                {onViewDetails && (
                  <button
                    onClick={() => onViewDetails(trip)}
                    className="flex-1 btn-secondary !py-2 !rounded-xl text-xs font-bold"
                  >
                    Details
                  </button>
                )}
                {onReplan && (
                  <button
                    onClick={() => onReplan(trip)}
                    className="flex-[2] btn-primary !py-2 !rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" /> Re-route Trip
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}

function CarIcon({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg>
}
