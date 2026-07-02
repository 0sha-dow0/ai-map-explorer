import React from 'react';

const CATEGORY_STYLES = {
  museum: { text: 'text-purple-800', bg: 'bg-purple-500/10', badge: '#9C6BB3' },
  park: { text: 'text-emerald-800', bg: 'bg-emerald-500/10', badge: '#5E8C5A' },
  landmark: { text: 'text-gold', bg: 'bg-gold/10', badge: '#C99A38' },
  food: { text: 'text-orange-800', bg: 'bg-orange-500/10', badge: '#C95B38' },
  culture: { text: 'text-pink-800', bg: 'bg-pink-500/10', badge: '#C26188' },
  nature: { text: 'text-teal-800', bg: 'bg-teal-500/10', badge: '#3E7C6B' },
  shopping: { text: 'text-indigo-800', bg: 'bg-indigo-500/10', badge: '#5B6FA8' },
  nightlife: { text: 'text-violet-800', bg: 'bg-violet-500/10', badge: '#7D5BA6' },
  default: { text: 'text-terracotta-bright', bg: 'bg-terracotta/10', badge: '#C2562F' },
};

export default function PlacesList({ intro, places, selectedPlace, onSelectPlace }) {
  if (!places || places.length === 0) {
    return (
      <div className="px-6 py-4">
        <p className="text-sm text-moss-dim italic font-display">
          This area is better known for its wider regional character than for a small list of attractions.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 pb-2">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-terracotta flex-shrink-0" />
        <h3 className="text-[11px] font-bold uppercase tracking-caps text-moss">Places to Visit</h3>
        <div className="route-rule flex-1" />
      </div>

      {intro && <p className="text-[13px] text-ink/60 mb-3.5 font-display italic">{intro}</p>}

      <div className="space-y-2.5">
        {places.map((place, idx) => {
          const style = CATEGORY_STYLES[place.category] || CATEGORY_STYLES.default;
          const isSelected = selectedPlace?.name === place.name;

          return (
            <button
              key={`${place.name}-${idx}`}
              onClick={() => onSelectPlace(place)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 ${
                isSelected
                  ? 'border-terracotta/60 bg-terracotta/10 shadow-glow'
                  : 'border-line hover:border-line-strong bg-surface/60 hover:bg-surface hover:shadow-card hover:-translate-y-px'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ring-2 ring-paper"
                  style={{ background: style.badge }}
                >
                  <span className="text-paper text-xs font-bold">{idx + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-ink truncate">{place.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`text-[9.5px] font-bold uppercase tracking-caps ${style.text} ${style.bg} px-2 py-0.5 rounded-full`}>
                      {place.category}
                    </span>
                    {place.free && (
                      <span className="text-[9.5px] font-bold uppercase tracking-caps text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Free
                      </span>
                    )}
                    {place.setting && place.setting !== 'both' && (
                      <span className="text-[10px] text-moss-dim capitalize">{place.setting}</span>
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
