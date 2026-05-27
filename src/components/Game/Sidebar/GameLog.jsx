import { useRef, useEffect } from 'react';
import { useGameStore } from '../../../store/gameStore';

export default function GameLog() {
  const log = useGameStore((s) => s.log);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div
      style={{
        fontSize: 13, color: 'var(--ink-700)',
        flex: 1, minHeight: 0,
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      {log.length === 0 && <div style={{ color: 'var(--ink-400)' }}>{"La partie d\u00e9marre\u2026"}</div>}
      {log.map((msg, i) => (
        <div
          key={i}
          style={{
            padding: '5px 0',
            borderBottom: '1px dashed rgba(122, 94, 58, 0.18)',
            lineHeight: 1.4,
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
