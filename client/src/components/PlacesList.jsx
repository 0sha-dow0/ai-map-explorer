import React from 'react';

const CATEGORY_COLORS = {
  museum: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  park: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  landmark: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  food: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  culture: { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  nature: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  shopping: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  nightlife: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  default: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
};

export default function PlacesList({ intro, places, selectedPlace, onSelectPlace }) {
  if (!places || places.length === 0) {
    return (
      <div className="px-5 py-4">
        <p className="text-sm text-muted italic">
          This area is better known for its wider regional character than for a small list of attractions.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 pb-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">📍</span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Places to Visit</h3>
      </div>

      {intro && <p className="text-sm text-ink/70 mb-3">{intro}</p>}

      <div className="space-y-2">
        {places.map((place, idx) => {
          const colors = CATEGORY_COLORS[place.category] || CATEGORY_COLORS.default;
          const isSelected = selectedPlace?.name === place.name;

          return (
            <button
              key={`${place.name}-${idx}`}
              onClick={() => onSelectPlace(place)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? 'border-accent/40 bg-accent-light/30 shadow-card-hover'
                  : 'border-border hover:border-border-strong hover:shadow-card bg-surface'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-7 h-7 rounded-full ${colors.dot} flex items-center justify-center mt-0.5`}>
                  <span className="text-white text-xs font-bold">{idx + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-ink truncate">{place.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text} ${colors.bg} px-1.5 py-0.5 rounded`}>
                      {place.category}
                    </span>
                    {place.free && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">FREE</span>
                    )}
                    {place.setting && place.setting !== 'both' && (
                      <span className="text-[10px] text-muted/60 capitalize">{place.setting}</span>
                    )}
                  </div>

                  <p className="text-xs text-ink/60 leading-relaxed">{place.whyVisit}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
