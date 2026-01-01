
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EV_MODELS, type EVModel, getUserPreferences, upsertUserPreferences } from '../lib/localStorage';
import { Map, Car, X, Save, Battery, Gauge, Coffee, Wifi, ShoppingBag, Info } from 'lucide-react';

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
    battery_health_percent: 100 as number,
    prefer_scenic_routes: false as boolean,
    preferred_amenities: [] as string[],
  });

  useEffect(() => {
    const load = () => {
      setEvModels(EV_MODELS);
      if (!user) return;
      const prefs = getUserPreferences(user.id);
      if (prefs) {
        setForm({
          preferred_ev_model_id: prefs.preferred_ev_model_id || (EV_MODELS[0]?.id || ''),
          default_battery_buffer_percent: prefs.default_battery_buffer_percent ?? 20,
          battery_health_percent: prefs.battery_health_percent ?? 100,
          prefer_scenic_routes: !!prefs.prefer_scenic_routes,
          preferred_amenities: prefs.preferred_amenities || [],
        });
      } else if (EV_MODELS.length > 0) {
        setForm(prev => ({ ...prev, preferred_ev_model_id: EV_MODELS[0].id }));
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      upsertUserPreferences(user.id, form);
      if (onClose) onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectedModel = evModels.find(m => m.id === form.preferred_ev_model_id);
  const effectiveRange = selectedModel
    ? Math.round(selectedModel.range_miles * (form.battery_health_percent / 100))
    : 0;

  return (
    <div className="glass-card border border-white/5 bg-surface/90 backdrop-blur-xl w-full max-w-6xl mx-auto relative overflow-hidden flex flex-col md:flex-row">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-blue/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Left Column: My Garage Visual */}
      <div className="w-full md:w-5/12 bg-surface-highlight/50 p-6 md:p-8 flex flex-col relative overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
              <Car className="w-5 h-5 text-neon-blue" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">My Garage</h2>
          </div>

          {selectedModel ? (
            <div className="space-y-6">
              <div>
                <div className="text-neon-blue text-sm font-bold uppercase tracking-wider mb-1">{selectedModel.manufacturer}</div>
                <div className="text-3xl font-black text-white leading-tight mb-2">{selectedModel.model_name}</div>
                <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-gray-300">
                  {selectedModel.year} Edition
                </div>
              </div>

              <div className="py-8 flex justify-center relative">
                {/* Schematic Animation Container */}
                <div className="relative w-64 h-64 flex items-center justify-center">
                  {/* Rotating Rings */}
                  <div className="absolute inset-0 border border-neon-blue/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                  <div className="absolute inset-4 border border-neon-purple/20 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                  <div className="absolute inset-0 border-t border-neon-blue/40 rounded-full animate-[spin_3s_linear_infinite]"></div>

                  {/* Scanning Beam */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-blue/10 to-transparent animate-[pulse_2s_ease-in-out_infinite] opacity-50"></div>

                  {/* Central Car Icon */}
                  <div className="relative z-10 w-32 h-32 rounded-full bg-surface-highlight/80 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(127,90,240,0.3)]">
                    <Car className="w-16 h-16 text-white" />
                  </div>

                  {/* Axis Lines */}
                  <div className="absolute w-[120%] h-[1px] bg-white/5 top-1/2 left-1/2 -translate-x-1/2"></div>
                  <div className="absolute h-[120%] w-[1px] bg-white/5 left-1/2 top-1/2 -translate-y-1/2"></div>

                  {/* Tech Decorators */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-black border border-neon-blue/30 rounded text-[10px] text-neon-blue font-mono">SCANNING</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 uppercase font-bold mb-1">Factory Range</div>
                  <div className="text-xl font-bold text-white">{selectedModel.range_miles} <span className="text-xs font-normal text-gray-400">mi</span></div>
                </div>
                <div className="bg-black/20 p-3 rounded-xl border border-white/5 relative overflow-hidden">
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-neon-green/20">
                    <div className="h-full bg-neon-green" style={{ width: `${form.battery_health_percent}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-500 uppercase font-bold mb-1">Real Range</div>
                  <div className="text-xl font-bold text-neon-green">{effectiveRange} <span className="text-xs font-normal text-neon-green/60">mi</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a vehicle
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Settings */}
      <div className="flex-1 p-6 md:p-10 flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-lg font-bold text-white">Configuration</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {/* Vehicle Selection */}
          <div className="space-y-3">
            <label className="label-modern">Selected Vehicle</label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-surface-highlight border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/50 transition-all duration-200"
                value={form.preferred_ev_model_id}
                onChange={(e) => setForm({ ...form, preferred_ev_model_id: e.target.value })}
              >
                <option value="" className="bg-surface text-gray-400">Select a model</option>
                {evModels.map(ev => (
                  <option key={ev.id} value={ev.id} className="bg-surface text-white">
                    {ev.manufacturer} {ev.model_name} ({ev.year})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Battery Health Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="label-modern flex items-center gap-2">
                <Gauge className="w-4 h-4 text-neon-purple" />
                Battery Health
              </label>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{form.battery_health_percent}%</div>
                <div className="text-xs text-neon-purple">Degradation: -{100 - form.battery_health_percent}%</div>
              </div>
            </div>
            <input
              type="range"
              min={70}
              max={100}
              step={1}
              value={form.battery_health_percent}
              onChange={(e) => setForm({ ...form, battery_health_percent: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-neon-purple [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(127,90,240,0.5)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <p className="text-xs text-gray-500">
              Adjust this to match your car's actual maximum capacity. Lower health reduces effective range.
            </p>
          </div>

          {/* Buffer Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="label-modern flex items-center gap-2">
                <Battery className="w-4 h-4 text-neon-green" />
                Min. Buffer
              </label>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{form.default_battery_buffer_percent}%</div>
                <div className="text-xs text-neon-green">Safety Margin</div>
              </div>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={form.default_battery_buffer_percent}
              onChange={(e) => setForm({ ...form, default_battery_buffer_percent: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-neon-green [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(46,213,115,0.5)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
            />
          </div>

          {/* Scenic Toggle */}
          <div onClick={() => setForm({ ...form, prefer_scenic_routes: !form.prefer_scenic_routes })}
            className="flex items-center justify-between p-4 rounded-xl bg-surface-highlight border border-white/5 cursor-pointer hover:border-white/20 transition-all duration-200 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-surface/50 text-neon-blue border border-white/5 group-hover:border-neon-blue/30 group-hover:bg-neon-blue/10 transition-all">
                <Map className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-white group-hover:text-neon-blue transition-colors">Scenic Routes</div>
                <div className="text-xs text-gray-500">Prioritize views over speed</div>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${form.prefer_scenic_routes ? 'bg-neon-blue/20 border border-neon-blue/50' : 'bg-white/10 border border-white/10'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${form.prefer_scenic_routes ? 'translate-x-[22px] bg-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.5)]' : 'translate-x-0'}`}></div>
            </div>
          </div>

          {/* Amenity Preferences */}
          <div className="space-y-4">
            <label className="label-modern">Preferred Amenities</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'restrooms', label: 'Restrooms', icon: <Info className="w-4 h-4" /> },
                { id: 'food', label: 'Food & Drinks', icon: <Coffee className="w-4 h-4" /> },
                { id: 'shopping', label: 'Shopping', icon: <ShoppingBag className="w-4 h-4" /> },
                { id: 'wifi', label: 'Free WiFi', icon: <Wifi className="w-4 h-4" /> },
              ].map((amenity) => (
                <button
                  key={amenity.id}
                  onClick={() => {
                    const current = form.preferred_amenities;
                    const next = current.includes(amenity.id)
                      ? current.filter(id => id !== amenity.id)
                      : [...current, amenity.id];
                    setForm({ ...form, preferred_amenities: next });
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${form.preferred_amenities.includes(amenity.id)
                    ? 'bg-neon-purple/10 border-neon-purple/50 text-white'
                    : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                    }`}
                >
                  <div className={form.preferred_amenities.includes(amenity.id) ? 'text-neon-purple' : 'text-gray-500'}>
                    {amenity.icon}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">{amenity.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-8 mt-auto border-t border-white/5 flex gap-4">
          <button onClick={onClose} className="flex-1 btn-secondary !py-3 !rounded-xl text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] btn-primary !py-3 !rounded-xl flex items-center justify-center gap-2 font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
}
