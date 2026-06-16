import { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { logText, logDetail, signed } from '../../../logic/logFormat';

// Une entrée : texte + éventuel détail dépliable (facteurs d'un gain/recul).
function LogEntry({ entry }) {
  const text = logText(entry);
  const detail = logDetail(entry);
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        padding: '5px 0',
        borderBottom: '1px dashed rgba(122, 94, 58, 0.18)',
        lineHeight: 1.4,
        fontSize: 13,
      }}
    >
      {detail ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={open ? 'Masquer le détail' : 'Voir le détail du calcul'}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 5, width: '100%',
            background: 'none', border: 'none', padding: 0, margin: 0,
            font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0, marginTop: 1, fontSize: 10, color: 'var(--ink-400)',
              transition: 'transform 140ms', transform: open ? 'rotate(90deg)' : 'none',
            }}
          >
            {'▶'}
          </span>
          <span>{text}</span>
        </button>
      ) : (
        <span>{text}</span>
      )}

      {detail && open && (
        <div style={{ margin: '4px 0 2px 15px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {detail.map((d, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
                fontSize: 12, color: 'var(--ink-600)',
              }}
            >
              <span style={{ minWidth: 0 }}>{d.label}{d.note ? ` ${d.note}` : ''}</span>
              {d.amount != null && (
                <span style={{ fontFamily: 'var(--font-display)', flexShrink: 0, color: (Number(d.amount) || 0) < 0 ? '#a33215' : 'var(--ink-700)' }}>
                  {signed(d.amount)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
      {log.length === 0 && <div style={{ color: 'var(--ink-400)' }}>{"La partie démarre…"}</div>}
      {log.map((entry, i) => (
        <LogEntry key={`log-${i}-${logText(entry).slice(0, 20)}`} entry={entry} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
