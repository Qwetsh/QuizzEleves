import { useState, useRef, useEffect } from 'react';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong, soundClick } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';
import MemoryBoard from './MemoryBoard';

/**
 * Memory (paires) — moteur GÉNÉRIQUE de duel, plateau partagé tour-par-tour.
 * 12 cartes = 6 paires tirées du contenu du thème. À son tour, l'équipe active
 * retourne 2 cartes : paire trouvée → +1 et elle REJOUE ; sinon les cartes se
 * retournent et c'est à l'autre. Quand les 6 paires sont trouvées, l'équipe qui
 * en a le plus gagne la manche (égalité → on rejoue un plateau).
 *
 * Plateau PARTAGÉ (les deux voient les mêmes cartes) : voir les retournements de
 * l'adversaire fait partie du jeu → anti-triche naturel, pas besoin de 2 plateaux.
 *
 * Contenu (forme `memory`) : [{ a, b, id? }] — a/b = deux faces liées d'une paire
 * (mot↔traduction, acteur↔rôle, jeu↔studio…). Texte des deux côtés pour l'instant.
 */
const PAIRS_PER_BOARD = 6;
const MATCH_HOLD_MS = 650;
const FLIP_BACK_MS = 1150;

const pairKey = (p) => p.id || `${p.a}|${p.b}`;

function dealBoard(content, usedRef) {
  const all = Array.isArray(content) ? content : [];
  let pool = all.filter((p) => !usedRef.current.includes(pairKey(p)));
  if (pool.length < PAIRS_PER_BOARD) { usedRef.current = []; pool = all; }
  const chosen = shuffle(pool).slice(0, PAIRS_PER_BOARD);
  chosen.forEach((p) => usedRef.current.push(pairKey(p)));
  const cards = [];
  chosen.forEach((p, pi) => {
    cards.push({ key: `${pi}a`, pairId: pi, text: p.a });
    cards.push({ key: `${pi}b`, pairId: pi, text: p.b });
  });
  return shuffle(cards);
}

export default function MemoryGame({ attacker, defender, onRoundWin, content }) {
  const T = useT();
  const usedRef = useRef([]);
  const [cards, setCards] = useState(() => dealBoard(content, usedRef));
  const [flipped, setFlipped] = useState([]);   // indices face visible (en cours)
  const [matched, setMatched] = useState({});    // pairId -> 'attacker'|'defender'
  const [activeSide, setActiveSide] = useState('attacker');
  const [scores, setScores] = useState({ attacker: 0, defender: 0 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);        // 'attacker'|'defender'|'tie'
  const reported = useRef(false);

  const team = activeSide === 'attacker' ? attacker : defender;

  const reset = () => {
    setCards(dealBoard(content, usedRef));
    setFlipped([]); setMatched({}); setScores({ attacker: 0, defender: 0 });
    setActiveSide('attacker'); setBusy(false); setDone(null);
    reported.current = false;
  };

  const handleFlip = (idx) => {
    if (busy || done) return;
    const card = cards[idx];
    if (matched[card.pairId] != null || flipped.includes(idx) || flipped.length >= 2) return;
    soundClick();
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length < 2) return;

    setBusy(true);
    const [i, j] = next;
    if (cards[i].pairId === cards[j].pairId) {
      soundCorrect();
      const side = activeSide;
      setTimeout(() => {
        setMatched((m) => ({ ...m, [cards[i].pairId]: side }));
        setScores((s) => ({ ...s, [side]: s[side] + 1 }));
        setFlipped([]); setBusy(false); // paire trouvée → même équipe rejoue
      }, MATCH_HOLD_MS);
    } else {
      soundWrong();
      setTimeout(() => {
        setFlipped([]); setBusy(false);
        setActiveSide((s) => (s === 'attacker' ? 'defender' : 'attacker'));
      }, FLIP_BACK_MS);
    }
  };

  // Fin de plateau : toutes les paires trouvées → vainqueur (ou égalité = rejoue).
  useEffect(() => {
    const total = cards.length / 2;
    if (Object.keys(matched).length < total || reported.current) return;
    reported.current = true;
    const { attacker: a, defender: d } = scores;
    if (a === d) { setDone('tie'); setTimeout(reset, 1900); }
    else { const w = a > d ? 'attacker' : 'defender'; setDone(w); setTimeout(() => onRoundWin(w), 1500); }
  }, [matched]); // eslint-disable-line react-hooks/exhaustive-deps

  const sideScore = (side, tm) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: activeSide === side || done ? 1 : 0.55 }}>
      <TeamAvatar team={tm} size={30} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: tm.color }}>{tm.name}</span>
      <span style={{ minWidth: 30, textAlign: 'center', padding: '2px 10px', borderRadius: 999, background: '#fffefb', border: `1px solid ${tm.color}66`, fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-900)' }}>
        {scores[side]}
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Bandeau : score + tour actif */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: 14, background: 'rgba(255,254,251,0.95)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
        {sideScore('attacker', attacker)}
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-600)' }}>
          {done === 'tie'
            ? T('fight.memory.tie')
            : <><span style={{ display: 'block', fontSize: 11, color: 'var(--ink-400)' }}>{T('fight.memory.turn')}</span><strong style={{ color: team.color, fontFamily: 'var(--font-display)', fontSize: 15 }}>{team.emoji} {team.name}</strong></>}
        </div>
        {sideScore('defender', defender)}
      </div>

      {/* Plateau 4×3 — cartes à retournement 3D (visuel partagé MemoryBoard) */}
      <MemoryBoard
        cards={cards.map((card, idx) => ({
          key: card.key,
          text: card.text,
          owner: matched[card.pairId] || null,
          faceUp: flipped.includes(idx),
        }))}
        attacker={attacker}
        defender={defender}
        onFlip={handleFlip}
        locked={busy || !!done}
      />

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.memory.hint')}
      </div>
    </div>
  );
}
