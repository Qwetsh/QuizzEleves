import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FRENCH_WORDS } from '../../../data/frenchWords';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import { useT } from '../../../i18n';

const ROUND_SECONDS = 45;
const RACK_SIZE = 9;
const TILE = 44;
const DROP_RADIUS = 60;

// Valeurs Scrabble français
const LETTER_VALUES = {
  A: 1, E: 1, I: 1, L: 1, N: 1, O: 1, R: 1, S: 1, T: 1, U: 1,
  D: 2, G: 2, M: 2,
  B: 3, C: 3, P: 3,
  F: 4, H: 4, V: 4,
  J: 8, Q: 8,
  K: 10, W: 10, X: 10, Y: 10, Z: 10,
};

// Distribution des tuiles du Scrabble français (pondération du tirage)
const LETTER_COUNTS = {
  E: 15, A: 9, I: 8, N: 6, O: 6, R: 6, S: 6, T: 6, U: 6, L: 5,
  D: 3, M: 3, B: 2, C: 2, F: 2, G: 2, H: 2, P: 2, V: 2,
  J: 1, K: 1, Q: 1, W: 1, X: 1, Y: 1, Z: 1,
};
const VOWELS = ['A', 'E', 'I', 'O', 'U'];

const VOWEL_BAG = [];
const CONSONANT_BAG = [];
Object.entries(LETTER_COUNTS).forEach(([letter, count]) => {
  const bag = VOWELS.includes(letter) ? VOWEL_BAG : CONSONANT_BAG;
  for (let i = 0; i < count; i++) bag.push(letter);
});

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tirage commun : 9 lettres pondérées Scrabble, avec 3 ou 4 voyelles garanties
function drawLetters() {
  const vowelCount = 3 + Math.floor(Math.random() * 2);
  return shuffleArr([
    ...shuffleArr(VOWEL_BAG).slice(0, vowelCount),
    ...shuffleArr(CONSONANT_BAG).slice(0, RACK_SIZE - vowelCount),
  ]);
}

// Dictionnaire : Set construit une seule fois, à la première utilisation
let DICT = null;
function getDict() {
  if (!DICT) DICT = new Set(FRENCH_WORDS.split('\n'));
  return DICT;
}

function wordScore(word) {
  return [...word].reduce((sum, ch) => sum + (LETTER_VALUES[ch] || 0), 0);
}

// Tuile de lettre façon Scrabble (lettre grande + valeur en indice)
function TileFace({ letter, size = TILE }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 8,
        background: '#fffef0',
        border: '1px solid rgba(122,94,58,0.4)',
        boxShadow: '0 2px 0 rgba(122,94,58,0.25)',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: Math.round(size * 0.5),
        color: 'var(--ink-900)', userSelect: 'none',
      }}
    >
      {letter}
      <span
        style={{
          position: 'absolute', right: 3, bottom: 1,
          fontSize: Math.max(9, Math.round(size * 0.24)),
          fontFamily: 'var(--font-ui)', fontWeight: 700, color: 'var(--ink-500)',
        }}
      >
        {LETTER_VALUES[letter]}
      </span>
    </div>
  );
}

/**
 * Le Mot le Plus Long (français) — écran scindé tactile.
 * Tirage COMMUN de 9 lettres (pondéré Scrabble, 3-4 voyelles garanties).
 * Chaque équipe compose un mot sur son chevalet (glisser-déposer ou toucher),
 * puis VALIDE : le mot est verrouillé et caché (anti-copiage). Au gong (45 s)
 * ou quand les deux ont validé, révélation : vérification dictionnaire et
 * score Scrabble. Le plus haut score gagne la manche. Égalité = nouveau tirage.
 */
export default function MotLePlusLong({ attacker, defender, subject, round, onRoundWin }) {
  const T = useT();
  const [letters, setLetters] = useState(null);                 // tirage commun (9 lettres)
  // boards[side][slotIdx] = index de tuile du chevalet (0-8) ou null
  const [boards, setBoards] = useState({ attacker: [], defender: [] });
  const [validated, setValidated] = useState({ attacker: false, defender: false });
  // Horodatage de validation (ms) par équipe : départage les ÉGALITÉS de score
  // (même mot / même nombre de points) → le premier à avoir validé gagne.
  const [validatedAt, setValidatedAt] = useState({ attacker: null, defender: null });
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [phase, setPhase] = useState('play');                   // 'play' | 'reveal'
  const [results, setResults] = useState(null);                 // { side: { word, valid, score } }
  const [winner, setWinner] = useState(null);                   // 'attacker' | 'defender' | 'tie'
  const [tieBreak, setTieBreak] = useState(false);              // égalité départagée à la vitesse
  const reported = useRef(false);     // garde anti-double onRoundWin
  const revealed = useRef(false);     // garde anti-double révélation
  const slotRefs = useRef({ attacker: [], defender: [] });
  const didDrag = useRef({});         // distingue tap et drag par tuile

  const startRound = () => {
    setLetters(drawLetters());
    setBoards({
      attacker: Array(RACK_SIZE).fill(null),
      defender: Array(RACK_SIZE).fill(null),
    });
    setValidated({ attacker: false, defender: false });
    setValidatedAt({ attacker: null, defender: null });
    setTimeLeft(ROUND_SECONDS);
    setPhase('play');
    setResults(null);
    setWinner(null);
    setTieBreak(false);
    reported.current = false;
    revealed.current = false;
    didDrag.current = {};
  };

  // Remonté à chaque manche par FightModal, mais reset par sécurité
  useEffect(() => { startRound(); }, [round]);

  // Compte à rebours
  useEffect(() => {
    if (phase !== 'play' || !letters || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase, letters]);

  // Révélation : au gong, ou dès que les deux équipes ont validé
  useEffect(() => {
    if (phase !== 'play' || !letters || revealed.current) return;
    const gong = timeLeft <= 0;
    const bothLocked = validated.attacker && validated.defender;
    if (!gong && !bothLocked) return;
    revealed.current = true;

    const res = {};
    ['attacker', 'defender'].forEach((side) => {
      const word = boards[side].filter((ri) => ri != null).map((ri) => letters[ri]).join('');
      const valid = word.length >= 2 && getDict().has(word);
      res[side] = { word, valid, score: valid ? wordScore(word) : 0 };
    });
    setResults(res);
    setPhase('reveal');

    // Gagnant : score le plus élevé ; en cas d'ÉGALITÉ de points (≥1, ex. même
    // mot), le PREMIER à avoir validé l'emporte. Aucun mot valide des deux
    // côtés (0-0) ou égalité sans aucune validation → nouveau tirage.
    let side = null;
    if (res.attacker.score !== res.defender.score) {
      side = res.attacker.score > res.defender.score ? 'attacker' : 'defender';
    } else if (res.attacker.score > 0) {
      const ta = validatedAt.attacker;
      const td = validatedAt.defender;
      if (ta != null && td != null) { side = ta <= td ? 'attacker' : 'defender'; setTieBreak(true); }
      else if (ta != null) { side = 'attacker'; setTieBreak(true); }
      else if (td != null) { side = 'defender'; setTieBreak(true); }
      // sinon (égalité sans aucune validation) : side reste null → nouveau tirage
    }

    if (side) {
      setWinner(side);
      soundCorrect();
      if (!reported.current) {
        reported.current = true;
        setTimeout(() => onRoundWin(side), 2500);
      }
    } else {
      setWinner('tie');
      soundWrong();
      setTimeout(startRound, 3000);
    }
  }, [timeLeft, validated, validatedAt, phase, letters, boards]);

  if (!letters) return null;

  const canEdit = (side) => phase === 'play' && !validated[side];

  const placeTile = (side, rackIdx, slotIdx) => {
    setBoards((prev) => {
      if (prev[side][slotIdx] != null || prev[side].includes(rackIdx)) return prev;
      const next = [...prev[side]];
      next[slotIdx] = rackIdx;
      return { ...prev, [side]: next };
    });
  };

  // Toucher une tuile du chevalet → premier emplacement libre
  const tapRackTile = (side, rackIdx) => {
    if (!canEdit(side) || boards[side].includes(rackIdx)) return;
    const free = boards[side].indexOf(null);
    if (free >= 0) placeTile(side, rackIdx, free);
  };

  // Toucher une tuile posée → retour au chevalet
  const tapSlot = (side, slotIdx) => {
    if (!canEdit(side) || boards[side][slotIdx] == null) return;
    setBoards((prev) => {
      const next = [...prev[side]];
      next[slotIdx] = null;
      return { ...prev, [side]: next };
    });
  };

  // Fin de glisser : pose sur l'emplacement libre le plus proche, sinon retour
  const handleDrop = (side, rackIdx, event, info) => {
    if (!canEdit(side)) return;
    const dist = Math.hypot(info.offset.x, info.offset.y);
    if (dist < 12) { tapRackTile(side, rackIdx); return; }
    const px = event.clientX != null ? event.clientX : info.point.x;
    const py = event.clientY != null ? event.clientY : info.point.y;
    let best = -1;
    let bestDist = Infinity;
    slotRefs.current[side].forEach((el, i) => {
      if (!el || boards[side][i] != null) return;
      const r = el.getBoundingClientRect();
      const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best >= 0 && bestDist < DROP_RADIUS) placeTile(side, rackIdx, best);
    // sinon dragSnapToOrigin ramène la tuile au chevalet
  };

  const validate = (side) => {
    if (!canEdit(side)) return;
    if (boards[side].filter((ri) => ri != null).length < 2) return;
    setValidated((prev) => ({ ...prev, [side]: true }));
    // Mémorise l'instant de validation (1re fois) pour départager les égalités.
    setValidatedAt((prev) => (prev[side] != null ? prev : { ...prev, [side]: Date.now() }));
  };

  const renderPlaySide = (side, team) => {
    const board = boards[side];
    const placedCount = board.filter((ri) => ri != null).length;
    const liveScore = board.reduce((s, ri) => (ri == null ? s : s + LETTER_VALUES[letters[ri]]), 0);
    const isLocked = validated[side];

    return (
      <div
        key={side}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '12px 14px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{team.emoji}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
          <span
            style={{
              marginLeft: 8, padding: '2px 12px', borderRadius: 999,
              background: '#fffefb', border: '1px solid rgba(122,94,58,0.3)',
              fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-900)',
            }}
          >
            {isLocked ? '🔒' : `${liveScore} pts`}
          </span>
        </div>

        {isLocked ? (
          <div
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <div style={{ fontSize: 40 }}>🔒</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-900)' }}>
              {T('fight.mot.wordValidated', { n: placedCount })}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-500)' }}>
              {T('fight.mot.revealAtEnd')}
            </div>
          </div>
        ) : (
          <>
            {/* Emplacements pour composer le mot */}
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {board.map((rackIdx, slotIdx) => (
                <div
                  key={slotIdx}
                  ref={(el) => { slotRefs.current[side][slotIdx] = el; }}
                  onPointerDown={() => tapSlot(side, slotIdx)}
                  style={{
                    width: TILE, height: TILE, borderRadius: 8,
                    border: rackIdx == null ? '2px dashed rgba(122,94,58,0.35)' : 'none',
                    background: rackIdx == null ? 'rgba(255,255,255,0.4)' : 'transparent',
                    cursor: rackIdx == null ? 'default' : 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  {rackIdx != null && <TileFace letter={letters[rackIdx]} />}
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--ink-500)' }}>
              {T('fight.mot.yourWordYourRack')}
            </div>

            {/* Chevalet : tuiles glissables ou touchables */}
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {letters.map((letter, rackIdx) => {
                const placed = board.includes(rackIdx);
                if (placed) {
                  return (
                    <div
                      key={rackIdx}
                      style={{
                        width: TILE, height: TILE, borderRadius: 8,
                        border: '2px dashed rgba(122,94,58,0.2)',
                      }}
                    />
                  );
                }
                const dragId = `${side}-${rackIdx}`;
                return (
                  <motion.div
                    key={rackIdx}
                    drag
                    dragSnapToOrigin
                    dragMomentum={false}
                    dragElastic={0.15}
                    whileDrag={{ scale: 1.18, zIndex: 60 }}
                    onDragStart={() => { didDrag.current[dragId] = true; }}
                    onDragEnd={(event, info) => {
                      handleDrop(side, rackIdx, event, info);
                      setTimeout(() => { didDrag.current[dragId] = false; }, 60);
                    }}
                    onTap={() => {
                      if (didDrag.current[dragId]) return;
                      tapRackTile(side, rackIdx);
                    }}
                    style={{
                      touchAction: 'none', cursor: 'grab',
                      position: 'relative', zIndex: 1,
                    }}
                  >
                    <TileFace letter={letter} />
                  </motion.div>
                );
              })}
            </div>

            <button
              onPointerDown={() => validate(side)}
              disabled={placedCount < 2}
              style={{
                alignSelf: 'center', marginTop: 'auto',
                padding: '10px 28px', borderRadius: 12, border: 'none',
                fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 1,
                color: '#fff',
                background: placedCount >= 2 ? team.color : 'rgba(122,94,58,0.3)',
                boxShadow: placedCount >= 2 ? '0 3px 8px rgba(0,0,0,0.25)' : 'none',
                cursor: placedCount >= 2 ? 'pointer' : 'default',
                touchAction: 'manipulation',
              }}
            >
              {T('fight.mot.validate')}
            </button>
          </>
        )}
      </div>
    );
  };

  const renderRevealSide = (side, team) => {
    const res = results[side];
    const isWinner = winner === side;
    return (
      <div
        key={side}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 12,
          alignItems: 'center', justifyContent: 'center',
          padding: '14px 16px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>{team.emoji}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: team.color }}>{team.name}</span>
        </div>

        {res.word.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[...res.word].map((ch, i) => <TileFace key={i} letter={ch} size={48} />)}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-ui)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-500)' }}>
            {T('fight.mot.noWord')}
          </div>
        )}

        {res.valid ? (
          <div
            style={{
              padding: '6px 18px', borderRadius: 999,
              background: '#d1f0b8', border: '2px solid #5b8c3a',
              fontFamily: 'var(--font-display)', fontSize: 18, color: '#33591e',
            }}
          >
            {T('fight.mot.points', { n: res.score })}
          </div>
        ) : (
          <div
            style={{
              padding: '6px 18px', borderRadius: 999,
              background: '#f7c8c8', border: '2px solid #c9472f',
              fontFamily: 'var(--font-display)', fontSize: 15, color: '#7c2417',
            }}
          >
            {T('fight.mot.zeroPoint', { reason: res.word.length < 2 ? T('fight.mot.noValidWord') : T('fight.mot.notInDict') })}
          </div>
        )}

        {isWinner && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.4 }}
            style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: team.color }}
          >
            {T('fight.mot.roundWon')}
          </motion.div>
        )}
      </div>
    );
  };

  const timerRatio = Math.max(0, timeLeft) / ROUND_SECONDS;
  const bothLocked = validated.attacker && validated.defender;

  let bannerText;
  if (phase === 'reveal') {
    if (winner === 'tie') bannerText = T('fight.mot.tie');
    else {
      const team = winner === 'attacker' ? attacker : defender;
      bannerText = tieBreak
        ? T('fight.mot.tieBreak', { emoji: team.emoji, name: team.name })
        : T('fight.mot.winsRound', { emoji: team.emoji, name: team.name });
    }
  } else {
    bannerText = T('fight.mot.goal');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Bandeau parcheminé : tirage commun + timer */}
      <div
        style={{
          padding: '10px 20px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-900)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {bannerText}
        {phase === 'play' && (
          <>
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 8 }}>
              {letters.map((ch, i) => <TileFace key={i} letter={ch} size={38} />)}
            </div>
            <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', width: `${timerRatio * 100}%`,
                  background: timerRatio > 0.3 ? 'linear-gradient(90deg, #5b8c3a, #8bc34a)' : '#c9472f',
                  transition: 'width 1s linear', borderRadius: 3,
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
              {bothLocked ? T('fight.mot.bothValidated') : `${Math.max(0, timeLeft)}s`}
            </div>
          </>
        )}
      </div>

      {/* Panneaux des deux équipes */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {phase === 'reveal' && results ? (
          <>
            {renderRevealSide('attacker', attacker)}
            {renderRevealSide('defender', defender)}
          </>
        ) : (
          <>
            {renderPlaySide('attacker', attacker)}
            {renderPlaySide('defender', defender)}
          </>
        )}
      </div>

      {phase === 'play' && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
          {T('fight.mot.hint')}
        </div>
      )}
    </div>
  );
}
