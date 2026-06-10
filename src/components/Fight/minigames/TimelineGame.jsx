import { useState, useRef } from 'react';
import { TIMELINE_EVENTS, shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';

function formatYear(y) {
  return y < 0 ? `${-y} av. J.-C.` : `${y}`;
}

/**
 * Timeline (histoire) — tour par tour, une seule frise partagée.
 * Chaque équipe place à son tour une carte événement (sans la date) au bon
 * endroit de la frise. Erreur = manche perdue (l'adversaire marque) ; la
 * carte est replacée au bon endroit et on continue. La frise persiste sur
 * tout le combat (le composant n'est pas réinitialisé entre les manches).
 */
export default function TimelineGame({ attacker, defender, onRoundWin }) {
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

  const team = activeSide === 'attacker' ? attacker : defender;
  const otherSide = activeSide === 'attacker' ? 'defender' : 'attacker';

  const drawNext = () => {
    const card = deckRef.current[0] || null;
    deckRef.current = deckRef.current.slice(1);
    return card;
  };

  const handleSlot = (slotIndex) => {
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
    }, 1600);
  };

  if (!current) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        Plus de cartes ! Égalité décidée au prochain duel de rapidité…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Carte a placer */}
      <div
        style={{
          alignSelf: 'center',
          padding: '12px 26px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.97)',
          border: `3px solid ${team.color}`,
          boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 14px ${team.color}55`,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--ink-500)', fontFamily: 'var(--font-ui)' }}>
          {team.emoji} <strong style={{ color: team.color }}>{team.name}</strong> — place cet événement sur la frise :
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-900)', marginTop: 4 }}>
          {current.name}
        </div>
        {feedback && (
          <div
            style={{
              marginTop: 6, fontFamily: 'var(--font-display)', fontSize: 16,
              color: feedback.ok ? '#5b8c3a' : '#c9472f',
            }}
          >
            {feedback.ok ? `✔ Bien joué ! ${formatYear(feedback.year)}` : `✘ Raté ! C'était en ${formatYear(feedback.year)}`}
          </div>
        )}
      </div>

      {/* Frise */}
      <div
        className="scroll-hidden"
        style={{
          flex: 1, minHeight: 0,
          display: 'flex', alignItems: 'center', gap: 4,
          overflowX: 'auto', padding: '10px 16px',
        }}
      >
        {placed.map((card, i) => {
          const isNew = feedback && feedback.index === i;
          return (
            <div key={`${card.year}-${card.name}`} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {/* Slot avant la carte i */}
              <SlotButton onTap={() => handleSlot(i)} disabled={busy} />
              <div
                style={{
                  width: 130, padding: '10px 8px', borderRadius: 12,
                  background: isNew
                    ? (feedback.ok ? '#d1f0b8' : '#f7c8c8')
                    : 'rgba(255,254,251,0.95)',
                  border: isNew
                    ? `2px solid ${feedback.ok ? '#5b8c3a' : '#c9472f'}`
                    : '2px solid rgba(122,94,58,0.3)',
                  textAlign: 'center',
                  boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--gold-700, #6e4e10)' }}>
                  {formatYear(card.year)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-700)', fontFamily: 'var(--font-ui)', lineHeight: 1.25, marginTop: 3 }}>
                  {card.name}
                </div>
              </div>
            </div>
          );
        })}
        {/* Slot final */}
        <SlotButton onTap={() => handleSlot(placed.length)} disabled={busy} />
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        Touche un ➕ pour placer la carte entre deux dates. Une erreur = manche perdue !
      </div>
    </div>
  );
}

function SlotButton({ onTap, disabled }) {
  return (
    <button
      onPointerDown={onTap}
      disabled={disabled}
      style={{
        width: 34, height: 56, borderRadius: 10, flexShrink: 0,
        border: '2px dashed rgba(243, 201, 105, 0.8)',
        background: 'rgba(243, 201, 105, 0.15)',
        color: '#f3c969', fontSize: 18, fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        touchAction: 'manipulation',
      }}
    >
      +
    </button>
  );
}
