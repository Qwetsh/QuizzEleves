import { useState, useEffect, useRef, useMemo } from 'react';
import { createHackState, fillBlank, breachPct, renderTokens, languagesOf, pickPuzzle } from '../../../logic/hackPuzzle.js';
import { soundCorrect, soundWrong, soundClick } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';
import hackData from '../../../data/hackPuzzles.json';

// ── « Cyber-duel » (Hacking) — thème informatique_numerique, surface TACTILE ──
// Deux terminaux de hacker côte à côte. CHAQUE camp CHOISIT SON LANGAGE au début
// du duel (une seule fois → moteur persistant), puis reçoit SES propres énigmes
// dans cette langue, difficulté appariée par manche. On COMPLÈTE LES TROUS d'un
// extrait d'exploit : à chaque trou, choisir le bon token parmi 4 ; chaque bonne
// réponse illumine la ligne et fait monter la « barre de hack » (breach %).
// Premier à finir l'exploit → « ACCÈS ACCORDÉ » et remporte la manche.

// Métadonnées d'affichage par langage : logo court, extension de fichier, teinte.
const LANGS = {
  python: { logo: 'PY', ext: 'py', color: '#4b8bbe' },
  javascript: { logo: 'JS', ext: 'js', color: '#e0c341' },
  bash: { logo: '$_', ext: 'sh', color: '#5fbf5f' },
  sql: { logo: 'DB', ext: 'sql', color: '#d97b3f' },
  c: { logo: 'C', ext: 'c', color: '#8f8fd6' },
  php: { logo: '<?', ext: 'php', color: '#a389c9' },
};
const langMeta = (lang) => LANGS[lang] || { logo: (lang || '?').slice(0, 2).toUpperCase(), ext: 'txt', color: '#4be08a' };

// Anti-répétition PAR CAMP, module-level (survit aux remontages internes) : une
// clé par (camp+langage) pour ne pas mélanger les compteurs entre deux joueurs
// qui auraient pris le même langage. Reset à la 1re monte de chaque instance.
const servedByKey = new Map();
const servedFor = (side, lang) => {
  const k = `${side}:${lang}`;
  let s = servedByKey.get(k);
  if (!s) { s = new Set(); servedByKey.set(k, s); }
  return s;
};

const CSS = `
@keyframes hack-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@keyframes hack-scan { 0%{background-position:0 0} 100%{background-position:0 4px} }
@keyframes hack-glitch { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-2px,1px)} 40%{transform:translate(2px,-1px)} 60%{transform:translate(-1px,-1px)} 80%{transform:translate(1px,1px)} }
@keyframes hack-flash { 0%{box-shadow:0 0 0 0 rgba(74,224,138,0)} 30%{box-shadow:0 0 40px 4px rgba(74,224,138,0.7)} 100%{box-shadow:0 0 0 0 rgba(74,224,138,0)} }
`;

const MONO = "'Consolas','SF Mono','Fira Code',ui-monospace,monospace";

// Menu de choix du langage pour un camp (grille de boutons logo/couleur).
function LangChooser({ team, side, langs, chosen, onPick, T }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TeamAvatar team={team} size={30} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: team.color }}>{team.name}</span>
      </div>
      {chosen ? (
        <div style={{ fontFamily: MONO, fontSize: 15, color: '#4be08a', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>{langMeta(chosen).logo}</div>
          <div style={{ marginTop: 8, color: 'rgba(150,255,190,0.8)' }}>{T('fight.hack.waiting')}</div>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: MONO, fontSize: 15, color: '#8effc0', textShadow: '0 0 8px rgba(74,224,138,0.5)' }}>
            &gt; {T('fight.hack.chooseLang')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 300 }}>
            {langs.map((lang) => {
              const m = langMeta(lang);
              return (
                <button
                  key={lang}
                  onPointerDown={() => onPick(side, lang)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '12px 6px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(10,16,12,0.9)', border: `2px solid ${m.color}`,
                    color: m.color, fontFamily: MONO, touchAction: 'manipulation',
                    boxShadow: `0 0 12px ${m.color}44`,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{m.logo}</span>
                  <span style={{ fontSize: 11, color: 'rgba(220,255,235,0.8)' }}>.{m.ext}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Un terminal de hacker (un camp) : fenêtre sombre à chasse fixe, code ligne par
 * ligne, trou courant surligné avec curseur ▮, trous remplis en vert, barre de
 * hack, et sous le code les 4 tokens du trou courant. Gère sa propre énigme,
 * son état de remplissage et son verrou (StrictMode-safe).
 */
function Terminal({ team, side, lang, roundNo, onSolved, T }) {
  // Un puzzle par manche, tiré à la 1re monte de cette manche (mémoïsé sur
  // roundNo → pas de Math.random au rendu). Difficulté : manche 1→lvl1, 2→lvl2,
  // 3+→lvl3, appariée par camp via son propre `served`.
  const puzzle = useMemo(() => {
    const level = roundNo <= 1 ? 1 : roundNo === 2 ? 2 : 3;
    return pickPuzzle(hackData.puzzles || [], { lang, level, served: servedFor(side, lang) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNo, lang, side]);

  const stateRef = useRef(null);
  if (!stateRef.current || stateRef.current.puzzle !== puzzle) {
    stateRef.current = puzzle ? createHackState(puzzle) : null;
  }

  const [, force] = useState(0);
  const [locked, setLocked] = useState(false);
  const [denied, setDenied] = useState(false);
  const [granted, setGranted] = useState(false);

  const dead = useRef(false);
  const timers = useRef([]);
  useEffect(() => {
    dead.current = false; // StrictMode : réarme dans le CORPS de l'effet
    return () => { dead.current = true; timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);
  const after = (ms, fn) => { const t = setTimeout(() => { if (!dead.current) fn(); }, ms); timers.current.push(t); };

  const meta = langMeta(lang);

  // Repli propre si ce langage n'a aucune énigme (ne devrait pas arriver — le
  // menu ne propose que des langages présents). Bouton pour ne pas bloquer.
  if (!puzzle || !stateRef.current) {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', color: '#8effc0', fontFamily: MONO, padding: 20, textAlign: 'center' }}>
        <div>
          {T('fight.hack.noPuzzle')}
          <div>
            <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={onSolved}>{T('fight.hack.access')}</button>
          </div>
        </div>
      </div>
    );
  }

  const state = stateRef.current;
  const segments = renderTokens(puzzle, state.filled, state.cur);
  const blank = puzzle.blanks[state.cur];
  const breach = breachPct(state);
  const title = T.lang === 'en' ? (puzzle.titleEn || puzzle.title) : puzzle.title;

  const choose = (token) => {
    if (locked || granted || !blank) return;
    const verdict = fillBlank(state, token);
    if (verdict.correct) {
      soundClick();
      force((n) => n + 1);
      if (verdict.solved) {
        soundCorrect();
        setGranted(true);
        after(900, () => { if (!dead.current) onSolved(); });
      }
    } else {
      soundWrong();
      setLocked(true);
      setDenied(true);
      after(1200, () => { setLocked(false); setDenied(false); });
    }
  };

  return (
    <div
      style={{
        flex: 1, minWidth: 0, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
        borderRadius: 12, overflow: 'hidden',
        border: `2px solid ${team.color}`,
        background: '#05080a',
        boxShadow: granted ? undefined : `0 0 18px ${team.color}33`,
        animation: granted ? 'hack-flash 0.9s ease-out' : denied ? 'hack-glitch 0.25s linear 3' : 'none',
        opacity: locked ? 0.82 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {/* Barre de titre du terminal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'linear-gradient(180deg,#12181a,#0a0e10)', borderBottom: '1px solid rgba(74,224,138,0.25)' }}>
        <TeamAvatar team={team} size={20} />
        <span style={{ fontFamily: MONO, fontSize: 12, color: meta.color, fontWeight: 800 }}>{meta.logo}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: '#7fe0a8', letterSpacing: '0.04em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ██ EXPLOIT.{meta.ext}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(120,230,170,0.7)' }}>{T('fight.hack.round', { n: roundNo })}</span>
      </div>

      {/* En-tête scénario */}
      <div style={{ padding: '0 12px', fontFamily: MONO, fontSize: 12, color: 'rgba(150,255,195,0.75)' }}>
        <span style={{ color: team.color, fontFamily: 'var(--font-display)' }}>{team.name}</span> — <em style={{ color: '#8effc0' }}>{title}</em>
      </div>

      {/* Écran de code (scanlines discrètes) */}
      <div
        className="scroll-hidden"
        style={{
          flex: 1, minHeight: 0, overflow: 'auto', margin: '0 10px', padding: '8px 10px',
          borderRadius: 8, background: '#04070a',
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(74,224,138,0.05) 0 1px, transparent 1px 4px)',
          fontFamily: MONO, fontSize: 15, lineHeight: 1.65, color: '#3ddc84',
          textShadow: '0 0 6px rgba(61,220,132,0.35)', whiteSpace: 'pre',
        }}
      >
        {segments.map((line, li) => (
          <div key={li} style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ color: 'rgba(74,224,138,0.35)', userSelect: 'none', width: 22, flexShrink: 0, textAlign: 'right', marginRight: 10 }}>{li + 1}</span>
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {line.map((part, pi) => {
                if (part.type === 'text') return <span key={pi} style={{ color: '#7fe0a8' }}>{part.value}</span>;
                if (part.filled) {
                  return <span key={pi} style={{ color: '#9bff6d', background: 'rgba(120,255,110,0.14)', padding: '0 3px', borderRadius: 3, fontWeight: 700 }}>{part.value}</span>;
                }
                const isCur = part.current;
                return (
                  <span
                    key={pi}
                    style={{
                      display: 'inline-block', minWidth: 18, padding: '0 4px', borderRadius: 3,
                      color: isCur ? '#04070a' : '#e0c341',
                      background: isCur ? '#f3d64a' : 'rgba(224,195,65,0.12)',
                      border: isCur ? 'none' : '1px dashed rgba(224,195,65,0.5)',
                      fontWeight: 800,
                      boxShadow: isCur ? '0 0 12px rgba(243,214,74,0.8)' : 'none',
                    }}
                  >
                    {isCur ? <span style={{ animation: 'hack-caret 1s step-end infinite' }}>▮</span> : '▮'}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>

      {/* Barre de hack / breach % */}
      <div style={{ margin: '0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'rgba(74,224,138,0.12)', border: '1px solid rgba(74,224,138,0.3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${breach}%`, borderRadius: 6, background: 'linear-gradient(90deg,#2fae5f,#8effc0)', boxShadow: '0 0 10px rgba(120,255,180,0.7)', transition: 'width 300ms ease' }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: '#8effc0', minWidth: 92, textAlign: 'right' }}>
          {T('fight.hack.breach', { n: breach })}
        </span>
      </div>

      {/* Tokens du trou courant */}
      <div style={{ padding: '0 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(blank?.choices || []).map((tok, i) => (
          <button
            key={i}
            onPointerDown={() => choose(tok)}
            disabled={locked || granted}
            style={{
              padding: '12px 8px', borderRadius: 8, cursor: locked || granted ? 'default' : 'pointer',
              background: 'rgba(10,20,14,0.95)', border: '1.5px solid rgba(74,224,138,0.5)',
              color: '#c9ffe0', fontFamily: MONO, fontSize: 16, fontWeight: 700,
              touchAction: 'manipulation', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {tok}
          </button>
        ))}
      </div>

      {/* Bandeau d'état (ACCÈS ACCORDÉ / REFUSÉ) */}
      {(granted || denied) && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', background: granted ? 'rgba(4,20,10,0.35)' : 'rgba(30,4,4,0.35)' }}>
          <span style={{
            fontFamily: MONO, fontSize: 22, fontWeight: 800, letterSpacing: '0.08em',
            padding: '8px 20px', borderRadius: 8,
            color: granted ? '#04140a' : '#fff',
            background: granted ? '#8effc0' : 'rgba(210,50,40,0.95)',
            boxShadow: granted ? '0 0 24px rgba(120,255,180,0.9)' : '0 0 18px rgba(210,50,40,0.7)',
            textShadow: granted ? 'none' : '0 0 8px rgba(255,80,60,0.8)',
          }}>
            {granted ? T('fight.hack.access') : T('fight.hack.denied')}
          </span>
        </div>
      )}
    </div>
  );
}

export default function HackDuel({ attacker, defender, round, onRoundWin }) {
  const T = useT();

  // Langages disponibles (menu) — stable.
  const langs = useMemo(() => languagesOf(hackData.puzzles || []), []);

  // Choix de langage PERSISTANT pour tout le duel (fait une seule fois).
  const [picked, setPicked] = useState({ attacker: null, defender: null });
  const bothPicked = picked.attacker && picked.defender;

  // Compteur de manche interne : le moteur est persistant (pas remonté entre
  // manches), donc on incrémente à CHAQUE victoire pour apparier la difficulté.
  const [roundNo, setRoundNo] = useState(1);

  const pickLang = (side, lang) => {
    soundClick();
    setPicked((p) => (p[side] ? p : { ...p, [side]: lang }));
  };

  const handleSolved = (side) => {
    setRoundNo((n) => n + 1); // manche suivante → nouvelles énigmes, difficulté ++
    onRoundWin(side);
  };

  // Repli global : aucune énigme du tout (ne devrait pas arriver — garde-fou
  // isPlayable). Bouton pour ne pas bloquer le duel.
  if (!langs.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#8effc0', fontFamily: MONO }}>
        {T('fight.hack.noPuzzle')}
        <div>
          <button className="btn btn--ghost" style={{ marginTop: 14 }} onClick={() => onRoundWin('defender')}>{T('fight.quick.roundToDefender')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <style>{CSS}</style>

      {!bothPicked ? (
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          <LangChooser team={attacker} side="attacker" langs={langs} chosen={picked.attacker} onPick={pickLang} T={T} />
          <div style={{ width: 1, background: 'rgba(74,224,138,0.25)' }} />
          <LangChooser team={defender} side="defender" langs={langs} chosen={picked.defender} onPick={pickLang} T={T} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* key = camp+manche+langage : nouvelle énigme fraîche à chaque manche. */}
          <Terminal key={`att-${roundNo}`} team={attacker} side="attacker" lang={picked.attacker} roundNo={roundNo} onSolved={() => handleSolved('attacker')} T={T} />
          <Terminal key={`def-${roundNo}`} team={defender} side="defender" lang={picked.defender} roundNo={roundNo} onSolved={() => handleSolved('defender')} T={T} />
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(150,255,195,0.75)', fontFamily: MONO }}>
        {T('fight.hack.hint')}
      </div>
    </div>
  );
}
