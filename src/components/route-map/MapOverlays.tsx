import React from 'react';
import { Info, X } from 'lucide-react';

export function MapTooltip({
  content,
  position
}: {
  content: string | React.ReactNode,
  position: { x: number, y: number } | null
}) {
  if (!position) return null;
  return (
    <div
      className="fixed pointer-events-none z-[100] px-3 py-2 bg-midnight/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl transition-opacity animate-in fade-in zoom-in duration-200"
      style={{
        left: position.x + 15,
        top: position.y - 15,
      }}
    >
      <div className="text-[11px] font-bold text-white whitespace-nowrap">
        {content}
      </div>
    </div>
  );
}

export function MapLegend({ onClose }: { onClose: () => void }) {
  const legendItems = [
    { icon: <div className="w-3 h-3 rounded-full bg-green-500" />, label: 'Origin' },
    { icon: <div className="w-3 h-3 rounded-full bg-red-500" />, label: 'Destination' },
    { icon: <div className="w-3 h-3 rounded-full bg-yellow-500" />, label: 'Charging Stop' },
    { icon: <div className="w-8 h-1 bg-green-500 rounded-full" />, label: 'Active Route' },
    { icon: <div className="w-8 h-1 bg-gray-400 rounded-full" />, label: 'Alternative Route' },
    { icon: <div className="w-8 h-1 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] rounded-full" />, label: 'Heavy Traffic' },
  ];

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 glass-card bg-midnight/80 backdrop-blur-xl border-white/10 p-5 rounded-3xl shadow-2xl w-64 z-20 animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Info className="w-4 h-4 text-neon-blue" /> Map Legend
        </h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {legendItems.map((item, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-8 flex justify-center">
              {item.icon}
            </div>
            <span className="text-[11px] font-medium text-gray-300">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
