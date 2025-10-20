import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserTrips, updateTripFavorite, updateTripName, deleteTrip, type UserTrip } from '../lib/supabase';
import { Star, StarOff, Trash2, Pencil, Check, X, Navigation } from 'lucide-react';

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
        const data = await getUserTrips(user.id, favoritesOnly);
        setTrips(data);
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
    if (!trip.id) return;
    const updated = await updateTripFavorite(trip.id, !trip.is_favorite);
    setTrips(prev => prev.map(t => t.id === trip.id ? updated : t));
  };

  const startEdit = (trip: UserTrip) => {
    setEditingId(trip.id || null);
    setEditingName(trip.trip_name || '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const updated = await updateTripName(editingId, editingName);
    setTrips(prev => prev.map(t => t.id === editingId ? updated : t));
    setEditingId(null);
    setEditingName('');
  };

  const removeTrip = async (trip: UserTrip) => {
    if (!trip.id) return;
    await deleteTrip(trip.id);
    setTrips(prev => prev.filter(t => t.id !== trip.id));
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Trip History</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">Close</button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          placeholder="Search trips by name or location"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)} />
          Favorites only
        </label>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-600">No trips found.</div>
      ) : (
        <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
          {filtered.map(trip => (
            <div key={trip.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {editingId === trip.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="px-3 py-2 border border-gray-300 rounded-lg flex-1"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        placeholder="Trip name"
                      />
                      <button onClick={saveEdit} className="p-2 rounded bg-emerald-600 text-white"><Check className="w-4 h-4"/></button>
                      <button onClick={() => setEditingId(null)} className="p-2 rounded border"><X className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-gray-900">
                      {trip.trip_name || `${trip.origin_address} → ${trip.destination_address}`}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mt-1">
                    {new Date(trip.created_at || '').toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFavorite(trip)} className="p-2 rounded border">
                    {trip.is_favorite ? <Star className="w-4 h-4 text-amber-500"/> : <StarOff className="w-4 h-4"/>}
                  </button>
                  <button onClick={() => startEdit(trip)} className="p-2 rounded border"><Pencil className="w-4 h-4"/></button>
                  <button onClick={() => removeTrip(trip)} className="p-2 rounded border text-red-600"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-700 mt-3 flex-wrap">
                <span>Battery: {trip.starting_battery_percent}%</span>
                <span>EV: {trip.ev_model_id}</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {onViewDetails && (
                  <button onClick={() => onViewDetails(trip)} className="px-3 py-2 rounded bg-gray-100 text-gray-800 border">View details</button>
                )}
                {onReplan && (
                  <button onClick={() => onReplan(trip)} className="px-3 py-2 rounded bg-emerald-600 text-white flex items-center gap-2">
                    <Navigation className="w-4 h-4"/> Re-plan
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


