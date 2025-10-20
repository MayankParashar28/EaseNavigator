import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, EVModel, getUserPreferences, upsertUserPreferences } from '../lib/supabase';

interface Props {
  onClose?: () => void;
}

export default function UserPreferences({ onClose }: Props) {
  const { user } = useAuth();
  const [evModels, setEvModels] = useState<EVModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    preferred_ev_model_id: '' as string,
    default_battery_buffer_percent: 20 as number,
    prefer_scenic_routes: false as boolean,
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('ev_models').select('*').order('manufacturer, model_name');
      setEvModels(data || []);
      if (!user) return;
      const prefs = await getUserPreferences(user.id);
      if (prefs) {
        setForm({
          preferred_ev_model_id: prefs.preferred_ev_model_id || '',
          default_battery_buffer_percent: prefs.default_battery_buffer_percent ?? 20,
          prefer_scenic_routes: !!prefs.prefer_scenic_routes,
        });
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await upsertUserPreferences(user.id, form);
      if (onClose) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Preferences</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Default EV Model</label>
          <select
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            value={form.preferred_ev_model_id}
            onChange={(e) => setForm({ ...form, preferred_ev_model_id: e.target.value })}
          >
            <option value="">Select a model</option>
            {evModels.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.manufacturer} {ev.model_name} ({ev.year})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Battery Buffer (%)</label>
          <input
            type="range"
            min={0}
            max={50}
            value={form.default_battery_buffer_percent}
            onChange={(e) => setForm({ ...form, default_battery_buffer_percent: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="text-sm text-gray-700 mt-1">{form.default_battery_buffer_percent}%</div>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="scenic"
            type="checkbox"
            checked={form.prefer_scenic_routes}
            onChange={(e) => setForm({ ...form, prefer_scenic_routes: e.target.checked })}
            className="h-4 w-4"
          />
          <label htmlFor="scenic" className="text-sm text-gray-800">Prefer scenic routes</label>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}


