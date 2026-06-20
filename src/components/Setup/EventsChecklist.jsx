import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { EVENTS } from '../../data/events';
import { EVENT_IMG } from '../../data/eventAssets';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';

// `embedded` (refonte Setup) : rend uniquement la grille, sans en-t\u00eate repliable
// ni bouton \u00ab tout cocher \u00bb \u2014 c'est d\u00e9sormais SetupSection qui fournit le pli, le
// r\u00e9sum\u00e9 et l'action. Mode legacy (autonome) conserv\u00e9 pour compat.
export default function EventsChecklist({ embedded = false }) {
  const T = useT();
  const enabledEvents = useGameStore((s) => s.enabledEvents);
  const toggleEvent = useGameStore((s) => s.toggleEvent);
  const setAllEvents = useGameStore((s) => s.setAllEvents);
  const [open, setOpen] = useState(false);

  const allKeys = Object.keys(EVENTS);
  const allChecked = enabledEvents.length === allKeys.length;

  const grid = (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {allKeys.map((key) => {
          const ev = EVENTS[key];
          const on = enabledEvents.includes(key);
          return (
            <div
              key={key}
              onClick={() => toggleEvent(key)}
              className="flex items-start gap-2.5 cursor-pointer select-none"
              style={{
                padding: '6px 8px',
                borderRadius: 8,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(232, 169, 88, 0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div
                style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: on ? 'var(--gold-600)' : '#fffefb',
                  border: `2px solid ${on ? 'var(--gold-700)' : 'var(--ink-400)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {on ? '\u2713' : ''}
              </div>
              <div className="min-w-0">
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {EVENT_IMG[key]
                    ? <img src={EVENT_IMG[key]} alt="" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
                    : <span>{ev.icon}</span>}
                  <span>{locName(ev)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, marginTop: 1 }}>
                  {locDesc(ev)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
  );

  if (embedded) {
    return (
      <div>
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setAllEvents(!allChecked)}
            style={{ fontSize: 12, color: 'var(--gold-600)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
          >
            {allChecked ? T('setup.eventsUncheckAll') : T('setup.eventsCheckAll')}
          </button>
        </div>
        {grid}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="field-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-400)', transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>{'▶'}</span>
          {T('setup.eventsTitle', { n: enabledEvents.length, total: allKeys.length })}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAllEvents(!allChecked); }}
          style={{ fontSize: 12, color: 'var(--gold-600)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
        >
          {allChecked ? T('setup.eventsUncheckAll') : T('setup.eventsCheckAll')}
        </button>
      </div>
      {open && grid}
    </div>
  );
}
