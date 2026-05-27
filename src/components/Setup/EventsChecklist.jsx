import { useGameStore } from '../../store/gameStore';
import { EVENTS } from '../../data/events';

export default function EventsChecklist() {
  const enabledEvents = useGameStore((s) => s.enabledEvents);
  const toggleEvent = useGameStore((s) => s.toggleEvent);
  const setAllEvents = useGameStore((s) => s.setAllEvents);

  const allKeys = Object.keys(EVENTS);
  const allChecked = enabledEvents.length === allKeys.length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-[var(--muted)]">
          {`\u00c9v\u00e9nements (${enabledEvents.length}/${allKeys.length})`}
        </label>
        <button
          onClick={() => setAllEvents(!allChecked)}
          className="text-xs text-blue-600 hover:underline"
        >
          {allChecked ? 'Tout d\u00e9cocher' : 'Tout cocher'}
        </button>
      </div>
      <div className="bg-white rounded-lg border border-[var(--border)] p-3 grid grid-cols-2 gap-1">
        {allKeys.map((key) => {
          const ev = EVENTS[key];
          const checked = enabledEvents.includes(key);
          return (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer text-sm py-0.5 hover:bg-gray-50 rounded px-1"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleEvent(key)}
                className="accent-blue-500"
              />
              <span>{ev.icon} {ev.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
