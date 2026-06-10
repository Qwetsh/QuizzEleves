import { useGameStore } from '../../store/gameStore';
import { EVENTS } from '../../data/events';

export default function EventsChecklist() {
  const enabledEvents = useGameStore((s) => s.enabledEvents);
  const toggleEvent = useGameStore((s) => s.toggleEvent);
  const setAllEvents = useGameStore((s) => s.setAllEvents);

  const allKeys = Object.keys(EVENTS);
  const allChecked = enabledEvents.length === allKeys.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="field-label" style={{ marginBottom: 0 }}>
          {`\u00c9v\u00e9nements (${enabledEvents.length}/${allKeys.length})`}
        </div>
        <button
          onClick={() => setAllEvents(!allChecked)}
          style={{ fontSize: 12, color: 'var(--gold-600)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
        >
          {allChecked ? 'Tout d\u00e9cocher' : 'Tout cocher'}
        </button>
      </div>
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.icon} {ev.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, marginTop: 1 }}>
                  {ev.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
