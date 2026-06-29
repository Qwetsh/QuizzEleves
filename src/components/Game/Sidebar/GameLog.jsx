import { useRef, useEffect, useState, useMemo, memo } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { logText, logDetail, signed } from '../../../logic/logFormat';
import { tokenizeText, getGlossaryIndex } from '../../../logic/glossary';
import Keyword from '../Keyword';
import { useT } from '../../../i18n';
import '../../../styles/info-card.css';

// Rend un texte de journal en segments : texte brut + mots-clés cliquables
// (objets, pouvoirs, sets, matières, termes de mécanique) repérés par le glossaire.
function LogText({ text, index }) {
  // L'index ne change pas en cours de partie (langue/catalogue stables) : on
  // mémoïse la tokenisation par entrée pour éviter de re-tokeniser tout
  // l'historique à chaque nouvelle ligne de journal.
  const segs = useMemo(() => tokenizeText(text, index), [text, index]);
  return (
    <>
      {segs.map((s, i) => (s.type
        ? <Keyword key={i} descriptor={{ type: s.type, key: s.key }}>{s.text}</Keyword>
        : <span key={i}>{s.text}</span>
      ))}
    </>
  );
}

// Une entrée : texte (mots-clés cliquables) + éventuel détail dépliable.
// Mémoïsée (memo) : entry/index étant stables par référence, une nouvelle ligne
// ne re-rend pas (ni ne re-tokenise) les entrées existantes.
const LogEntry = memo(function LogEntry({ entry, index }) {
  const text = logText(entry);
  const detail = logDetail(entry);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ padding: '5px 0', borderBottom: '1px dashed rgba(122, 94, 58, 0.18)', lineHeight: 1.4, fontSize: 13 }}>
      <div
        onClick={detail ? () => setOpen((o) => !o) : undefined}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 5,
          cursor: detail ? 'pointer' : 'default',
        }}
      >
        {detail && (
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0, marginTop: 1, fontSize: 10, color: 'var(--ink-400)',
              transition: 'transform 140ms', transform: open ? 'rotate(90deg)' : 'none',
            }}
          >
            {'▶'}
          </span>
        )}
        <span><LogText text={text} index={index} /></span>
      </div>

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
});

export default function GameLog() {
  const T = useT();
  const log = useGameStore((s) => s.log);
  const itemsVersion = useGameStore((s) => s.itemsVersion);
  const endRef = useRef(null);
  // Index de glossaire reconstruit selon la langue + le catalogue d'objets
  // (mémoïsé dans glossary.js → recalcul seulement si l'un change).
  const index = getGlossaryIndex(T.lang, itemsVersion);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div
      data-log-scroll
      style={{
        fontSize: 13, color: 'var(--ink-700)',
        flex: 1, minHeight: 0,
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      {log.length === 0 && <div style={{ color: 'var(--ink-400)' }}>{T('game.gameStarting')}</div>}
      {log.map((entry, i) => (
        <LogEntry key={`log-${i}-${logText(entry).slice(0, 20)}`} entry={entry} index={index} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
