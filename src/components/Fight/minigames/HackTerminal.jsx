// Terminal de hacker PRÉSENTATIONNEL réutilisable (aucune logique de partie).
// Utilisé par : (a) HackDuel tactile (split-screen, interactif), (b) HackDuelView
// (téléphone/client du duelliste, interactif), (c) HackDuelStage (scène TV,
// lecture seule). Rendu à partir de { lines, blanks, filled, cur, breach, … }.
//
// IMPORTANT : le découpage des trous (`§N`) est fait ICI, localement — on NE
// dépend PAS du moteur (logic/hackPuzzle) pour le rendu. Le store publie déjà
// lines + blanks + filled + cur ; l'affichage se recompose à partir de ça.
import TeamAvatar from '../../TeamAvatar';

// Métadonnées d'affichage par langage : logo court, extension de fichier, teinte.
export const LANGS = {
  python: { logo: 'PY', ext: 'py', color: '#4b8bbe' },
  javascript: { logo: 'JS', ext: 'js', color: '#e0c341' },
  bash: { logo: '$_', ext: 'sh', color: '#5fbf5f' },
  sql: { logo: 'DB', ext: 'sql', color: '#d97b3f' },
  c: { logo: 'C', ext: 'c', color: '#8f8fd6' },
  php: { logo: '<?', ext: 'php', color: '#a389c9' },
};
export const langMeta = (lang) =>
  LANGS[lang] || { logo: (lang || '?').slice(0, 2).toUpperCase(), ext: 'txt', color: '#4be08a' };

export const MONO = "'Consolas','SF Mono','Fira Code',ui-monospace,monospace";

export const HACK_CSS = `
@keyframes hack-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@keyframes hack-glitch { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-2px,1px)} 40%{transform:translate(2px,-1px)} 60%{transform:translate(-1px,-1px)} 80%{transform:translate(1px,1px)} }
@keyframes hack-flash { 0%{box-shadow:0 0 0 0 rgba(74,224,138,0)} 30%{box-shadow:0 0 40px 4px rgba(74,224,138,0.7)} 100%{box-shadow:0 0 0 0 rgba(74,224,138,0)} }
`;

// Découpe les `lines` en segments pour le rendu (trous `§N` → morceaux blank).
// filled = tokens déjà validés (index = N), cur = index du trou courant.
function toSegments(lines, filled, cur) {
  return (lines || []).map((line) => {
    const parts = [];
    const re = /§(\d+)/g;
    let last = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push({ type: 'text', value: line.slice(last, m.index) });
      const index = Number(m[1]);
      const done = index < (filled?.length || 0);
      parts.push({
        type: 'blank',
        index,
        filled: done,
        value: done ? filled[index] : undefined,
        current: index === cur,
      });
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push({ type: 'text', value: line.slice(last) });
    return parts;
  });
}

/**
 * Menu de choix du langage pour un camp (grille de boutons logo/couleur).
 * Présentationnel : `chosen` (langage déjà choisi ou null), `interactive`,
 * `onPick(lang)`. En lecture seule (TV), affiche « choisit son langage… ».
 */
export function HackLangChooser({ team, langs, chosen, interactive = true, onPick, T }) {
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
      ) : !interactive ? (
        <div style={{ fontFamily: MONO, fontSize: 14, color: 'rgba(150,255,195,0.75)', textAlign: 'center' }}>
          <span style={{ animation: 'hack-caret 1s step-end infinite' }}>▮</span> {T('fight.hack.choosingLang')}
        </div>
      ) : (
        <>
          <div style={{ fontFamily: MONO, fontSize: 15, color: '#8effc0', textShadow: '0 0 8px rgba(74,224,138,0.5)' }}>
            &gt; {T('fight.hack.chooseLang')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 300 }}>
            {(langs || []).map((lang) => {
              const m = langMeta(lang);
              return (
                <button
                  key={lang}
                  onPointerDown={() => onPick && onPick(lang)}
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
 * Un terminal de hacker (un camp), PRÉSENTATIONNEL. Props :
 *   { lang, title, lines, blanks, filled, cur, breach, solved, locked, denySeq,
 *     interactive, onPick(token), team, roundNo, T }
 * - `lines`/`blanks`/`filled`/`cur` viennent du store (ou du moteur pour le
 *   tactile) — le rendu se recompose à partir d'eux (aucune dépendance logique).
 * - `breach` : % d'intrusion (fourni). Si absent, calculé filled/blanks.
 * - `denySeq` : entier — quand il CHANGE, joue l'animation « ACCÈS REFUSÉ »
 *   (glitch + bandeau) pendant ~1.2 s. Robuste au StrictMode.
 * - interactive=false → TV/spectateur (pas de tap, tokens grisés).
 */
import { useEffect, useRef, useState } from 'react';

export default function HackTerminal({
  lang, title, lines = [], blanks = [], filled = [], cur = 0,
  breach, solved = false, locked = false, denySeq = 0,
  interactive = false, onPick, team = {}, roundNo = 1, T,
}) {
  const meta = langMeta(lang);
  const segments = toSegments(lines, filled, cur);
  const blank = blanks[cur] || null;
  const pct = typeof breach === 'number'
    ? breach
    : (blanks.length ? Math.round((filled.length / blanks.length) * 100) : 0);

  // Animation « ACCÈS REFUSÉ » déclenchée par un changement de denySeq (l'hôte
  // signale une erreur). Auto-éteinte après 1.2 s. StrictMode-safe.
  const [denied, setDenied] = useState(false);
  const prevDeny = useRef(denySeq);
  useEffect(() => {
    if (denySeq === prevDeny.current) return undefined;
    prevDeny.current = denySeq;
    setDenied(true);
    const t = setTimeout(() => setDenied(false), 1200);
    return () => clearTimeout(t);
  }, [denySeq]);

  const granted = !!solved;
  const dim = locked && !granted;

  return (
    <div
      style={{
        flex: 1, minWidth: 0, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
        borderRadius: 12, overflow: 'hidden',
        border: `2px solid ${team.color || '#4be08a'}`,
        background: '#05080a',
        boxShadow: granted ? undefined : `0 0 18px ${team.color || '#4be08a'}33`,
        animation: granted ? 'hack-flash 0.9s ease-out' : denied ? 'hack-glitch 0.25s linear 3' : 'none',
        opacity: dim ? 0.82 : 1,
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
        <span style={{ color: team.color, fontFamily: 'var(--font-display)' }}>{team.name}</span>
        {title ? <> — <em style={{ color: '#8effc0' }}>{title}</em></> : null}
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
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: 'linear-gradient(90deg,#2fae5f,#8effc0)', boxShadow: '0 0 10px rgba(120,255,180,0.7)', transition: 'width 300ms ease' }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: '#8effc0', minWidth: 92, textAlign: 'right' }}>
          {T('fight.hack.breach', { n: pct })}
        </span>
      </div>

      {/* Tokens du trou courant (interactifs seulement côté duelliste) */}
      <div style={{ padding: '0 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(blank?.choices || []).map((tok, i) => (
          <button
            key={i}
            onPointerDown={interactive && !locked && !granted ? () => onPick && onPick(tok) : undefined}
            disabled={!interactive || locked || granted}
            style={{
              padding: '12px 8px', borderRadius: 8,
              cursor: interactive && !locked && !granted ? 'pointer' : 'default',
              background: 'rgba(10,20,14,0.95)', border: '1.5px solid rgba(74,224,138,0.5)',
              color: '#c9ffe0', fontFamily: MONO, fontSize: 16, fontWeight: 700,
              opacity: interactive ? 1 : 0.7,
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
