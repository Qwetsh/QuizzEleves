import { useState, useEffect, useRef } from 'react';
import { soundCorrect, soundWrong } from '../../../logic/sounds';

const ROUND_SECONDS = 60;
const BIG_PLATES = [25, 50, 75, 100];
const OPS = ['+', '−', '×', '÷'];

function randInt(n) {
  return Math.floor(Math.random() * n);
}

/** Applique une opération ; retourne null si elle est interdite. */
function applyOp(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b > 0 ? a - b : null;
    case '×': return a * b;
    case '÷': return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

/**
 * Génère un tirage : 1 grande plaque + 5 petites (1-10, max 2 fois chacune)
 * et une cible GARANTIE atteignable (construite en appliquant 2 à 4
 * opérations valides sur les plaques tirées, résultat entre 21 et 499).
 */
function generateDraw() {
  for (let attempt = 0; attempt < 400; attempt++) {
    const smallPool = [];
    for (let v = 1; v <= 10; v++) smallPool.push(v, v);
    const plates = [BIG_PLATES[randInt(BIG_PLATES.length)]];
    for (let i = 0; i < 5; i++) {
      plates.push(smallPool.splice(randInt(smallPool.length), 1)[0]);
    }

    const opCount = 2 + randInt(3); // 2 à 4 opérations
    let work = [...plates];
    let value = null;
    let ok = true;
    for (let k = 0; k < opCount; k++) {
      const i1 = randInt(work.length);
      let i2 = randInt(work.length - 1);
      if (i2 >= i1) i2++;
      const a = work[i1];
      const b = work[i2];
      // On écarte les opérations sans effet (×1, ÷1…) pour une cible intéressante
      const validOps = OPS.filter((op) => {
        const r = applyOp(a, b, op);
        return r !== null && r !== a && r !== b;
      });
      if (validOps.length === 0) { ok = false; break; }
      value = applyOp(a, b, validOps[randInt(validOps.length)]);
      work = work.filter((_, idx) => idx !== i1 && idx !== i2);
      work.push(value);
    }

    if (!ok || value === null) continue;
    if (!Number.isInteger(value) || value < 21 || value > 499) continue;
    if (plates.includes(value)) continue; // cible déjà dans le tirage = trivial
    return { target: value, plates };
  }
  // Filet de sécurité (statistiquement jamais atteint) : 25 × 4 + 7 = 107
  return { target: 107, plates: [25, 4, 7, 3, 8, 2] };
}

function makeSideState(draw) {
  return {
    tiles: draw.plates.map((value, i) => ({ id: `p${i}`, value, used: false })),
    ops: [],                      // pile { aId, bId, resultId, text }
    sel: { tileId: null, op: null },
    bestDiff: Math.min(...draw.plates.map((v) => Math.abs(v - draw.target))),
  };
}

/**
 * Le Compte est Bon (maths) — écran scindé tactile.
 * Tirage commun (cible + 6 plaques) ; chaque équipe combine SES plaques
 * de son côté : plaque → opérateur → plaque = nouvelle plaque.
 * Cible atteinte = victoire immédiate. Sinon, au gong (60 s), le plus
 * petit écart gagne. Égalité parfaite = nouveau tirage.
 */
export default function CompteEstBon({ attacker, defender, round, onRoundWin }) {
  const [draw, setDraw] = useState(null);
  const [sides, setSides] = useState(null);   // { attacker, defender }
  const [invalid, setInvalid] = useState({ attacker: false, defender: false });
  const [winner, setWinner] = useState(null); // 'attacker' | 'defender'
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [finished, setFinished] = useState(false);
  const [tie, setTie] = useState(false);
  const reported = useRef(false);
  const idCounter = useRef(0);

  const startRound = () => {
    const d = generateDraw();
    setDraw(d);
    setSides({ attacker: makeSideState(d), defender: makeSideState(d) });
    setInvalid({ attacker: false, defender: false });
    setWinner(null);
    setTimeLeft(ROUND_SECONDS);
    setFinished(false);
    setTie(false);
    reported.current = false;
  };

  // Nouveau tirage à chaque manche (le composant est aussi remonté)
  useEffect(() => { startRound(); }, [round]);

  // Compte à rebours
  useEffect(() => {
    if (finished || winner || !draw) return;
    if (timeLeft <= 0) { setFinished(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, finished, winner, draw]);

  // Gong : compare les meilleurs écarts
  useEffect(() => {
    if (!finished || winner || reported.current || !sides) return;
    const da = sides.attacker.bestDiff;
    const dd = sides.defender.bestDiff;
    if (da < dd) {
      reported.current = true;
      setTimeout(() => onRoundWin('attacker'), 1400);
    } else if (dd < da) {
      reported.current = true;
      setTimeout(() => onRoundWin('defender'), 1400);
    } else {
      setTie(true);
      setTimeout(startRound, 1800);
    }
  }, [finished]);

  if (!draw || !sides) return null;

  const updateSide = (side, next) => setSides((prev) => ({ ...prev, [side]: next }));
  const setSel = (side, sel) => updateSide(side, { ...sides[side], sel });

  const flashInvalid = (side) => {
    soundWrong();
    setInvalid((p) => ({ ...p, [side]: true }));
    setTimeout(() => setInvalid((p) => ({ ...p, [side]: false })), 500);
  };

  const handleTileTap = (side, tileId) => {
    if (finished || winner) return;
    const s = sides[side];
    const tile = s.tiles.find((t) => t.id === tileId);
    if (!tile || tile.used) return;
    const { tileId: firstId, op } = s.sel;

    if (firstId === null) { setSel(side, { tileId, op: null }); return; }
    if (firstId === tileId) { setSel(side, { tileId: null, op: null }); return; }
    if (!op) { setSel(side, { tileId, op: null }); return; }

    // plaque + opérateur + plaque → calcul
    const first = s.tiles.find((t) => t.id === firstId);
    const result = applyOp(first.value, tile.value, op);
    if (result === null) {
      flashInvalid(side);
      setSel(side, { tileId: null, op: null });
      return;
    }

    idCounter.current += 1;
    const resultId = `r${idCounter.current}`;
    const tiles = s.tiles.map((t) =>
      t.id === firstId || t.id === tileId ? { ...t, used: true } : t
    );
    tiles.push({ id: resultId, value: result, used: false });
    updateSide(side, {
      ...s,
      tiles,
      ops: [...s.ops, { aId: firstId, bId: tileId, resultId, text: `${first.value} ${op} ${tile.value} = ${result}` }],
      sel: { tileId: null, op: null },
      bestDiff: Math.min(s.bestDiff, Math.abs(result - draw.target)),
    });

    // Victoire immédiate si la cible est atteinte
    if (result === draw.target && !reported.current) {
      reported.current = true;
      setWinner(side);
      soundCorrect();
      setTimeout(() => onRoundWin(side), 800);
    }
  };

  const handleOpTap = (side, op) => {
    if (finished || winner) return;
    const s = sides[side];
    if (s.sel.tileId === null) return; // il faut d'abord choisir une plaque
    setSel(side, { ...s.sel, op: s.sel.op === op ? null : op });
  };

  const handleUndo = (side) => {
    if (finished || winner) return;
    const s = sides[side];
    if (s.ops.length === 0) return;
    const last = s.ops[s.ops.length - 1];
    const tiles = s.tiles
      .filter((t) => t.id !== last.resultId)
      .map((t) => (t.id === last.aId || t.id === last.bId ? { ...t, used: false } : t));
    updateSide(side, { ...s, tiles, ops: s.ops.slice(0, -1), sel: { tileId: null, op: null } });
  };

  const handleRestart = (side) => {
    if (finished || winner) return;
    const fresh = makeSideState(draw);
    fresh.bestDiff = Math.min(fresh.bestDiff, sides[side].bestDiff); // le meilleur écart reste acquis
    updateSide(side, fresh);
  };

  const renderSide = (side, team) => {
    const s = sides[side];
    const isWinner = winner === side;
    return (
      <div
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '10px 12px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
          position: 'relative',
        }}
      >
        {isWinner && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 26, color: '#5b8c3a',
            background: 'rgba(209,240,184,0.85)', borderRadius: 16, zIndex: 2,
            textAlign: 'center',
          }}>
            🎯 Le compte est bon !
          </div>
        )}

        {/* En-tête équipe + meilleur écart */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{team.emoji}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
          <span
            style={{
              marginLeft: 8, padding: '2px 12px', borderRadius: 999,
              background: '#fffefb', border: '1px solid rgba(122,94,58,0.3)',
              fontFamily: 'var(--font-display)', fontSize: 14,
              color: s.bestDiff === 0 ? '#5b8c3a' : 'var(--ink-900)',
            }}
          >
            {s.bestDiff === 0 ? '🎯 0' : `Écart : ${s.bestDiff}`}
          </span>
        </div>

        {/* Plaques */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', alignContent: 'flex-start' }}>
          {s.tiles.map((tile) => {
            const selected = s.sel.tileId === tile.id;
            return (
              <button
                key={tile.id}
                onPointerDown={() => handleTileTap(side, tile.id)}
                disabled={tile.used}
                style={{
                  minWidth: 64, minHeight: 50, padding: '6px 12px',
                  borderRadius: 12,
                  border: selected ? `3px solid ${team.color}` : '2px solid rgba(122,94,58,0.25)',
                  background: selected ? `${team.color}33` : '#fffefb',
                  boxShadow: selected ? `0 0 10px ${team.color}88` : 'none',
                  opacity: tile.used ? 0.3 : 1,
                  fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-900)',
                  cursor: tile.used ? 'default' : 'pointer',
                  touchAction: 'manipulation',
                  transition: 'opacity 150ms ease',
                }}
              >
                {tile.value}
              </button>
            );
          })}
        </div>

        {/* Opérateurs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {OPS.map((op) => {
            const active = s.sel.op === op && s.sel.tileId !== null;
            return (
              <button
                key={op}
                onPointerDown={() => handleOpTap(side, op)}
                style={{
                  width: 48, height: 48, borderRadius: 12,
                  border: active ? `3px solid ${team.color}` : '2px solid rgba(122,94,58,0.3)',
                  background: active ? team.color : '#fffefb',
                  color: active ? '#fff' : 'var(--ink-900)',
                  fontFamily: 'var(--font-display)', fontSize: 24,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  opacity: s.sel.tileId === null ? 0.55 : 1,
                }}
              >
                {op}
              </button>
            );
          })}
        </div>

        {/* Feedback opération impossible */}
        <div style={{
          textAlign: 'center', minHeight: 16,
          fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: '#c9472f',
          opacity: invalid[side] ? 1 : 0, transition: 'opacity 150ms ease',
        }}>
          ✋ Opération impossible !
        </div>

        {/* Annuler / Recommencer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onPointerDown={() => handleUndo(side)}
            disabled={s.ops.length === 0}
            style={{
              padding: '8px 14px', borderRadius: 10,
              border: '2px solid rgba(122,94,58,0.3)', background: '#fffefb',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)',
              cursor: s.ops.length === 0 ? 'default' : 'pointer',
              opacity: s.ops.length === 0 ? 0.45 : 1,
              touchAction: 'manipulation',
            }}
          >
            ↩️ Annuler
          </button>
          <button
            onPointerDown={() => handleRestart(side)}
            disabled={s.ops.length === 0}
            style={{
              padding: '8px 14px', borderRadius: 10,
              border: '2px solid rgba(122,94,58,0.3)', background: '#fffefb',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)',
              cursor: s.ops.length === 0 ? 'default' : 'pointer',
              opacity: s.ops.length === 0 ? 0.45 : 1,
              touchAction: 'manipulation',
            }}
          >
            🔄 Recommencer
          </button>
        </div>

        {/* Historique des opérations */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', textAlign: 'center' }}>
          {s.ops.map((o, i) => (
            <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-600, #6b5640)' }}>
              {o.text}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const timerRatio = timeLeft / ROUND_SECONDS;
  const statusText = tie
    ? '⚖️ Égalité ! Nouveau tirage…'
    : winner
      ? '🎯 Le compte est bon !'
      : finished
        ? `Temps écoulé ! Écarts : ${sides.attacker.bestDiff} contre ${sides.defender.bestDiff}`
        : 'Atteins la CIBLE en combinant tes plaques !';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Bandeau tirage commun : cible + plaques + timer */}
      <div
        style={{
          padding: '8px 20px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--ink-500)' }}>
              CIBLE
            </span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 44, lineHeight: 1,
              color: 'var(--ink-900)', textShadow: '0 2px 0 rgba(122,94,58,0.2)',
            }}>
              {draw.target}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {draw.plates.map((v, i) => (
              <span
                key={i}
                style={{
                  minWidth: 38, padding: '6px 8px', borderRadius: 10,
                  background: '#f4ead5', border: '1px solid rgba(122,94,58,0.3)',
                  fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--ink-700, #4a3a26)', marginTop: 4 }}>
          {statusText}
        </div>
        <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${timerRatio * 100}%`,
              background: timerRatio > 0.3 ? 'linear-gradient(90deg, #5b8c3a, #8bc34a)' : '#c9472f',
              transition: 'width 1s linear', borderRadius: 3,
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{timeLeft}s</div>
      </div>

      {/* Panneaux des deux équipes */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {renderSide('attacker', attacker)}
        {renderSide('defender', defender)}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        Touche une plaque, un opérateur, puis une autre plaque. Cible exacte = victoire immédiate !
      </div>
    </div>
  );
}
