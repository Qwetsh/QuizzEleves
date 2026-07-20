import { useState, useEffect, useRef, useMemo } from 'react';
import { createHackState, fillBlank, breachPct, languagesOf, pickPuzzle } from '../../../logic/hackPuzzle.js';
import { soundCorrect, soundWrong, soundClick } from '../../../logic/sounds';
import { useT } from '../../../i18n';
import hackData from '../../../data/hackPuzzles.json';
import HackTerminal, { HackLangChooser, HACK_CSS, MONO } from './HackTerminal';

// ── « Cyber-duel » (Hacking) — thème informatique_numerique, surface TACTILE ──
// Deux terminaux de hacker côte à côte. CHAQUE camp CHOISIT SON LANGAGE au début
// du duel (une seule fois → moteur persistant), puis reçoit SES propres énigmes
// dans cette langue, difficulté appariée par manche. On COMPLÈTE LES TROUS d'un
// extrait d'exploit : à chaque trou, choisir le bon token parmi 4 ; chaque bonne
// réponse illumine la ligne et fait monter la « barre de hack » (breach %).
// Premier à finir l'exploit → « ACCÈS ACCORDÉ » et remporte la manche.
//
// Le RENDU des terminaux et du menu de langage est délégué aux composants
// présentationnels partagés (HackTerminal / HackLangChooser), aussi utilisés par
// la vue téléphone (HackDuelView) et la scène TV (HackDuelStage). Ici, seule la
// LOGIQUE locale (tirage d'énigme, remplissage, verrou) vit encore.

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

/**
 * Un terminal de hacker (un camp) sur le TACTILE : gère sa propre énigme, son
 * état de remplissage et son verrou (StrictMode-safe), et délègue le RENDU au
 * HackTerminal partagé. Émet un `denySeq` incrémenté à chaque erreur.
 */
function TerminalTactile({ team, side, lang, roundNo, onSolved, T }) {
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
  const [denySeq, setDenySeq] = useState(0);
  const [granted, setGranted] = useState(false);

  const dead = useRef(false);
  const timers = useRef([]);
  useEffect(() => {
    dead.current = false; // StrictMode : réarme dans le CORPS de l'effet
    return () => { dead.current = true; timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);
  const after = (ms, fn) => { const t = setTimeout(() => { if (!dead.current) fn(); }, ms); timers.current.push(t); };

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
  const title = T.lang === 'en' ? (puzzle.titleEn || puzzle.title) : puzzle.title;

  const choose = (token) => {
    if (locked || granted) return;
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
      setDenySeq((n) => n + 1);
      after(1200, () => { setLocked(false); });
    }
  };

  return (
    <HackTerminal
      lang={lang}
      title={title}
      lines={puzzle.lines}
      blanks={puzzle.blanks}
      filled={state.filled}
      cur={state.cur}
      breach={breachPct(state)}
      solved={granted}
      locked={locked}
      denySeq={denySeq}
      interactive
      onPick={choose}
      team={team}
      roundNo={roundNo}
      T={T}
    />
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
      <style>{HACK_CSS}</style>

      {!bothPicked ? (
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          <HackLangChooser team={attacker} langs={langs} chosen={picked.attacker} onPick={(lang) => pickLang('attacker', lang)} T={T} />
          <div style={{ width: 1, background: 'rgba(74,224,138,0.25)' }} />
          <HackLangChooser team={defender} langs={langs} chosen={picked.defender} onPick={(lang) => pickLang('defender', lang)} T={T} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* key = camp+manche : nouvelle énigme fraîche à chaque manche. */}
          <TerminalTactile key={`att-${roundNo}`} team={attacker} side="attacker" lang={picked.attacker} roundNo={roundNo} onSolved={() => handleSolved('attacker')} T={T} />
          <TerminalTactile key={`def-${roundNo}`} team={defender} side="defender" lang={picked.defender} roundNo={roundNo} onSolved={() => handleSolved('defender')} T={T} />
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(150,255,195,0.75)', fontFamily: MONO }}>
        {T('fight.hack.hint')}
      </div>
    </div>
  );
}
