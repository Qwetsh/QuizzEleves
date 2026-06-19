import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TIMELINE_EVENTS, shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import { useT } from '../../../i18n';

function formatYear(y, T) {
  return y < 0 ? T('fight.timeline.bce', { n: -y }) : `${y}`;
}

const CARD_W = 150;

/**
 * Timeline (histoire) — tour par tour, une seule frise partagée.
 * La carte événement (sans la date) se place par GLISSER-DÉPOSER sur la
 * frise : pendant le survol, les cartes déjà posées s'écartent pour
 * montrer l'emplacement d'insertion. Erreur = manche perdue (l'adversaire
 * marque) ; la carte est replacée au bon endroit et on continue.
 * La frise persiste sur tout le combat (composant persistant).
 */
export default function TimelineGame({ attacker, defender, onRoundWin }) {
  const T = useT();
  // Etat initialise une seule fois pour tout le combat (initialiseur pur)
  const [init] = useState(() => {
    const deck = shuffle(TIMELINE_EVENTS);
    return { placed: [deck[0]], current: deck[1], rest: deck.slice(2) };
  });
  const deckRef = useRef(init.rest);

  const [placed, setPlaced] = useState(init.placed);
  const [current, setCurrent] = useState(init.current);
  const [activeSide, setActiveSide] = useState('attacker');
  const [feedback, setFeedback] = useState(null); // { ok, year, index }
  const [busy, setBusy] = useState(false);

  // Drag de la carte courante
  const [drag, setDrag] = useState(null);          // { dx, dy, startX, startY }
  const [hoverSlot, setHoverSlot] = useState(null); // index d'insertion survole
  const stripRef = useRef(null);
  const cardRefs = useRef({});

  const team = activeSide === 'attacker' ? attacker : defender;
  const otherSide = activeSide === 'attacker' ? 'defender' : 'attacker';

  const drawNext = () => {
    const card = deckRef.current[0] || null;
    deckRef.current = deckRef.current.slice(1);
    return card;
  };

  const handlePlace = (slotIndex) => {
    if (busy || !current) return;
    setBusy(true);

    const okLeft = slotIndex === 0 || placed[slotIndex - 1].year <= current.year;
    const okRight = slotIndex === placed.length || current.year <= placed[slotIndex].year;
    const ok = okLeft && okRight;

    // Position correcte reelle (premiere place valide)
    let correctIndex = placed.findIndex((c) => current.year <= c.year);
    if (correctIndex === -1) correctIndex = placed.length;

    const newPlaced = [...placed];
    newPlaced.splice(correctIndex, 0, current);
    setPlaced(newPlaced);
    setFeedback({ ok, year: current.year, index: correctIndex });

    if (ok) soundCorrect(); else soundWrong();

    setTimeout(() => {
      setFeedback(null);
      setCurrent(drawNext());
      setActiveSide(otherSide);
      setBusy(false);
      if (!ok) onRoundWin(otherSide);
    }, 1700);
  };

  // --- Drag & drop de la carte courante ---

  const computeHoverSlot = (clientX, clientY) => {
    const strip = stripRef.current;
    if (!strip) return null;
    const rect = strip.getBoundingClientRect();
    // Zone de depot : la bande de la frise, un peu elargie verticalement
    if (clientY < rect.top - 40 || clientY > rect.bottom + 20) return null;
    if (clientX < rect.left - 20 || clientX > rect.right + 20) return null;
    let idx = 0;
    for (const card of placed) {
      const el = cardRefs.current[`${card.year}-${card.name}`];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX > r.left + r.width / 2) idx++;
    }
    return idx;
  };

  const onCardPointerDown = (e) => {
    if (busy || !current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ dx: 0, dy: 0, startX: e.clientX, startY: e.clientY });
  };

  const onCardPointerMove = (e) => {
    if (!drag) return;
    setDrag({ ...drag, dx: e.clientX - drag.startX, dy: e.clientY - drag.startY });
    setHoverSlot(computeHoverSlot(e.clientX, e.clientY));
  };

  const onCardPointerUp = (e) => {
    if (!drag) return;
    const slot = computeHoverSlot(e.clientX, e.clientY);
    setDrag(null);
    setHoverSlot(null);
    if (slot !== null) handlePlace(slot);
  };

  if (!current) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        {T('fight.timeline.noMoreCards')}
      </div>
    );
  }

  const placedCard = (card, i) => {
    const isNew = feedback && feedback.index === i;
    return (
      <motion.div
        key={`${card.year}-${card.name}`}
        layout
        ref={(el) => { cardRefs.current[`${card.year}-${card.name}`] = el; }}
        transition={{ type: 'spring', damping: 22, stiffness: 240 }}
        style={{
          width: CARD_W, padding: '14px 10px', borderRadius: 14, flexShrink: 0,
          background: isNew
            ? (feedback.ok ? '#d1f0b8' : '#f7c8c8')
            : 'rgba(255,254,251,0.97)',
          border: isNew
            ? `3px solid ${feedback.ok ? '#5b8c3a' : '#c9472f'}`
            : '2px solid rgba(122,94,58,0.3)',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#6e4e10' }}>
          {formatYear(card.year, T)}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-700)', fontFamily: 'var(--font-ui)', lineHeight: 1.3, marginTop: 5 }}>
          {card.name}
        </div>
      </motion.div>
    );
  };

  // Espace d'insertion anime : s'ouvre entre les cartes pendant le survol
  const insertGap = (i) => (
    <AnimatePresence key={`gap-${i}`}>
      {hoverSlot === i && (
        <motion.div
          key="gap"
          layout
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: CARD_W * 0.75, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            alignSelf: 'stretch', flexShrink: 0,
            borderRadius: 14,
            border: `3px dashed ${team.color}`,
            background: `${team.color}1f`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: team.color, fontSize: 26, fontFamily: 'var(--font-display)',
          }}
        >
          ⬇
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Consigne */}
      <div
        style={{
          alignSelf: 'center', padding: '6px 22px', borderRadius: 999, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-700)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
        }}
      >
        {team.emoji} <strong style={{ color: team.color }}>{team.name}</strong> — {T('fight.timeline.consigneTail')}
      </div>

      {/* Carte courante a glisser (cachee pendant le feedback) */}
      <div style={{ minHeight: 112, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {!feedback ? (
          <div
            onPointerDown={onCardPointerDown}
            onPointerMove={onCardPointerMove}
            onPointerUp={onCardPointerUp}
            onPointerCancel={() => { setDrag(null); setHoverSlot(null); }}
            style={{
              width: CARD_W + 30, padding: '16px 12px', borderRadius: 16,
              background: 'rgba(255,254,251,0.98)',
              border: `3px solid ${team.color}`,
              boxShadow: drag
                ? `0 18px 36px rgba(0,0,0,0.45), 0 0 18px ${team.color}88`
                : `0 6px 18px rgba(0,0,0,0.35), 0 0 12px ${team.color}55`,
              textAlign: 'center',
              cursor: drag ? 'grabbing' : 'grab',
              touchAction: 'none',
              transform: drag ? `translate(${drag.dx}px, ${drag.dy}px) rotate(${Math.max(-8, Math.min(8, drag.dx / 30))}deg) scale(1.05)` : 'none',
              transition: drag ? 'none' : 'transform 250ms cubic-bezier(.34,1.56,.64,1)',
              position: 'relative', zIndex: 20,
              userSelect: 'none',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-900)', lineHeight: 1.25 }}>
              {current.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-ui)', marginTop: 6 }}>
              {T('fight.timeline.grabMe', { hand: '✋' })}
            </div>
          </div>
        ) : (
          <div
            style={{
              fontFamily: 'var(--font-display)', fontSize: 22, textAlign: 'center',
              color: feedback.ok ? '#9be36d' : '#ff9d8a',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {feedback.ok ? T('fight.timeline.correct', { year: formatYear(feedback.year, T) }) : T('fight.timeline.wrong', { year: formatYear(feedback.year, T) })}
          </div>
        )}
      </div>

      {/* Frise : grande, centree tant qu'elle tient, scrollable ensuite */}
      <div
        ref={stripRef}
        className="scroll-hidden"
        style={{
          flex: 1, minHeight: 0,
          display: 'flex', alignItems: 'center',
          overflowX: 'auto', padding: '10px 16px',
          background: hoverSlot !== null ? 'rgba(243,201,105,0.10)' : 'rgba(255,255,255,0.04)',
          borderRadius: 16,
          border: hoverSlot !== null ? '2px dashed rgba(243,201,105,0.6)' : '2px dashed rgba(255,255,255,0.12)',
          transition: 'background 150ms ease, border-color 150ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto' }}>
          {placed.map((card, i) => (
            [insertGap(i), placedCard(card, i)]
          ))}
          {insertGap(placed.length)}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.timeline.hint')}
      </div>
    </div>
  );
}
