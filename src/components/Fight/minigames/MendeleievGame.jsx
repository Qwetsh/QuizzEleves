import { useState, useEffect } from 'react';
import { ELEMENTS, ELEMENT_CATS, KNOWN_ELEMENTS } from '../../../data/periodicTable';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';
import { getLang } from '../../../i18n/lang';

// Anti-répétition des cibles (module-level : survit aux remontages entre manches).
const served = new Set();
function pickTarget() {
  if (served.size >= KNOWN_ELEMENTS.length) served.clear();
  const free = KNOWN_ELEMENTS.filter((e) => !served.has(e.z));
  const t = free[Math.floor(Math.random() * free.length)];
  served.add(t.z);
  return t;
}

const CELL_GAP = 2;

/**
 * « Le Tableau de Mendeleïev » (chimie) — écran scindé tactile. Le nom d'un
 * élément CONNU s'affiche (« Sodium ») ; chaque côté a son tableau périodique
 * complet (118 cases colorées par famille) : le premier à toucher le bon
 * SYMBOLE gagne la manche. Erreur = case flashée en rouge + côté verrouillé ;
 * deux verrous = révélation sans vainqueur puis nouvel élément.
 */
export default function MendeleievGame({ attacker, defender, round, onRoundWin }) {
  const T = useT();
  const lang = getLang();

  const [target, setTarget] = useState(null);
  const [locked, setLocked] = useState({ attacker: false, defender: false });
  // null = en jeu · 'attacker'/'defender' = vainqueur · 'nobody' = double erreur
  const [resolved, setResolved] = useState(null);
  const [wrongFlash, setWrongFlash] = useState({}); // { side: z } dernière erreur

  const newTarget = () => {
    setTarget(pickTarget());
    setLocked({ attacker: false, defender: false });
    setResolved(null);
    setWrongFlash({});
  };

  useEffect(() => { newTarget(); }, [round]);

  if (!target) return null;
  const targetName = lang === 'en' ? target.en : target.name;
  const revealed = !!resolved;

  const handleTap = (side, el) => {
    if (revealed || locked[side]) return;
    if (el.z === target.z) {
      soundCorrect();
      setResolved(side);
      setTimeout(() => onRoundWin(side), 1600); // laisse voir la case révélée
    } else {
      soundWrong();
      setWrongFlash((w) => ({ ...w, [side]: el.z }));
      const next = { ...locked, [side]: true };
      setLocked(next);
      if (next.attacker && next.defender) {
        setResolved('nobody');
        setTimeout(newTarget, 2000);
      }
    }
  };

  // Renvois « 57-71 » / « 89-103 » du tableau principal (cases non cliquables).
  const placeholders = [
    { key: 'lant', g: 3, p: 6, label: '57-71', cat: 'lanthanide' },
    { key: 'act', g: 3, p: 7, label: '89-103', cat: 'actinide' },
  ];

  const renderTable = (side, team) => {
    const isLocked = locked[side];
    return (
      <div
        style={{
          flex: 1, minWidth: 0, position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '10px 12px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
          opacity: isLocked && !revealed ? 0.6 : 1,
          transition: 'opacity 200ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <TeamAvatar team={team} size={26} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: team.color }}>{team.name}</span>
        </div>
        {isLocked && !revealed && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 22, color: '#c9472f',
            background: 'rgba(255,255,255,0.45)', borderRadius: 16, zIndex: 2, pointerEvents: 'none',
          }}>
            {T('fight.quick.locked')}
          </div>
        )}
        <div
          style={{
            flex: 1, minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(18, 1fr)',
            gridTemplateRows: 'repeat(7, 1fr) 8px repeat(2, 1fr)', // écart avant lanthanides
            gap: CELL_GAP,
          }}
        >
          {[...ELEMENTS.map((el) => {
            const isTarget = revealed && el.z === target.z;
            const isWrong = wrongFlash[side] === el.z;
            // lignes 8/9 (lanthanides/actinides) affichées APRÈS la rangée d'écart
            const gridRow = el.p <= 7 ? el.p : el.p + 1;
            return (
              <button
                key={el.z}
                onPointerDown={() => handleTap(side, el)}
                title={el.s}
                style={{
                  gridColumn: el.g, gridRow,
                  padding: 0, minWidth: 0, minHeight: 0,
                  border: isTarget
                    ? '2px solid #2f7d1f'
                    : isWrong ? '2px solid #c9472f' : '1px solid rgba(0,0,0,0.25)',
                  borderRadius: 3,
                  background: isTarget ? '#9be67f' : isWrong ? '#f7b0b0' : ELEMENT_CATS[el.cat],
                  color: '#25303a',
                  fontFamily: 'var(--font-ui)', fontWeight: 700,
                  fontSize: 'clamp(7px, 0.95vw, 15px)', lineHeight: 1,
                  cursor: revealed || isLocked ? 'default' : 'pointer',
                  touchAction: 'manipulation',
                  transform: isTarget ? 'scale(1.35)' : 'none',
                  zIndex: isTarget ? 3 : 1,
                  boxShadow: isTarget ? '0 0 14px rgba(155,230,127,0.9)' : 'none',
                  transition: 'transform 250ms cubic-bezier(.2,1.4,.4,1), background 150ms ease',
                }}
              >
                {el.s}
              </button>
            );
          }),
          ...placeholders.map((ph) => (
            <div
              key={ph.key}
              style={{
                gridColumn: ph.g, gridRow: ph.p,
                border: '1px dashed rgba(0,0,0,0.3)', borderRadius: 3,
                background: `${ELEMENT_CATS[ph.cat]}55`,
                color: 'rgba(37,48,58,0.8)', display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-ui)', fontSize: 'clamp(5px, 0.6vw, 10px)', fontWeight: 700,
              }}
            >
              {ph.label}
            </div>
          ))]}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Cible : le NOM de l'élément (le symbole est la réponse) */}
      <div
        style={{
          alignSelf: 'center', padding: '10px 30px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-display)', color: 'var(--ink-900)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--ink-500)', fontFamily: 'var(--font-ui)' }}>
          {T('fight.mendeleiev.find')}{' '}
        </span>
        <span style={{ fontSize: 26 }}>
          {revealed
            ? `${targetName} = ${target.s} (Z=${target.z})`
            : targetName}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {renderTable('attacker', attacker)}
        {renderTable('defender', defender)}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.mendeleiev.hint')}
      </div>
    </div>
  );
}
