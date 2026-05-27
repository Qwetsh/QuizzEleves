import { useRef, useEffect } from 'react';
import { useGameStore } from '../../../store/gameStore';

export default function GameLog() {
  const log = useGameStore((s) => s.log);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div className="mt-3">
      <h3 className="text-xs font-bold uppercase text-[var(--muted)] mb-1">Journal</h3>
      <div className="bg-white rounded-lg border border-[var(--border)] p-2 h-40 overflow-y-auto text-xs space-y-0.5">
        {log.map((msg, i) => (
          <div key={i} className="text-[var(--ink)]">{msg}</div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
