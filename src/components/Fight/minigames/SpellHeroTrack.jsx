import { useEffect, useRef, useState } from 'react';
import { HERO, comboMult } from '../../../logic/spellHero';
import { soundCorrect, soundWrong, soundSpell } from '../../../logic/sounds';
import './spellHero.css';

// Piste « Guitar Hero » des sorts — PRÉSENTATIONNELLE et RÉUTILISABLE (les 3
// surfaces la montent). Les événements du lore tombent vers la ligne de tir ; en
// bas, la « main » de 4 sorts de la vague courante. On tape le bon sort AU BON
// MOMENT. Le TIMING est jugé EN LOCAL (horloge locale, zéro lag) : au tap on capte
// la note la plus proche de la ligne et on émet onHit(noteId, spellIndex, dt).
// L'hôte valide le bon sort (clé secrète) + convertit dt en points → le verdict
// affiché (Parfait/Bien/Raté) vient de `wizard.last[mySide]` (autorité).
//
// Contrat lu (wizard) : { chart:{ waves:[{spells:[{incantation,nomFr}]}], notes:[{id,wave,t,label}], duration },
//   scores, combos, last:{ [side]:{ verdict, points, seq } }, winner }
//
// Réglages : les notes atteignent la ligne à `note.t` (ms depuis le départ local),
// après une chute de HERO.LEAD_MS. La fenêtre de CAPTURE (un peu > Bien) borne ce
// qu'un tap peut résoudre ; au-delà, tap dans le vide = ignoré (aucune pénalité —
// laisser filer une note n'est pas puni, cf. règle « Sort ET timing »).
const FALL_MS = HERO.LEAD_MS;     // durée de chute (apparition → ligne)
const CAPTURE_MS = 300;           // demi-fenêtre de capture d'un tap autour de la ligne
const PASS_TAIL_MS = 260;         // temps de survie d'une note après la ligne (visuel)
const LINE_PCT = 82;              // position verticale de la ligne (%)

export default function SpellHeroTrack({ wizard, mySide, me, onHit, compact = false }) {
  const chart = wizard?.chart;
  const over = !!wizard?.winner;
  const mine = wizard?.last?.[mySide] || null;

  // Horloge LOCALE : démarre au montage (indépendante de l'hôte → pas de synchro
  // d'horloge inter-machines ; chaque surface joue la même partition depuis son t0).
  const t0 = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    t0.current = performance.now();
    let raf = 0;
    const loop = () => { setElapsed(performance.now() - t0.current); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Notes déjà résolues EN LOCAL (tapées) → disparaissent, non retapables.
  const resolved = useRef(new Set());
  useEffect(() => { resolved.current = new Set(); }, [chart]);

  // Flash de verdict (piloté par l'autorité : nouveau seq de last[mySide]).
  const [flash, setFlash] = useState(null); // { verdict, id }
  const lastSeq = useRef(-1);
  useEffect(() => {
    if (!mine || mine.seq === lastSeq.current) return;
    lastSeq.current = mine.seq;
    const good = mine.points > 0;
    setFlash({ verdict: mine.verdict, id: mine.seq });
    if (good) soundCorrect(); else soundWrong();
    const to = setTimeout(() => setFlash((f) => (f && f.id === mine.seq ? null : f)), 620);
    return () => clearTimeout(to);
  }, [mine]);

  if (!chart) return null;
  const notes = chart.notes;

  // Phase de PRÉPARATION : tant que la 1re note n'est pas entrée à l'écran, on
  // laisse le temps de LIRE la main de 4 sorts (compte à rebours, rien ne tombe).
  const firstAppear = notes.length ? notes[0].t - FALL_MS : 0;
  const counting = !over && elapsed < firstAppear;
  const countNum = Math.max(1, Math.ceil((firstAppear - elapsed) / 1000));

  // Note CIBLE = la plus proche non résolue, encore captable ou à venir (n.t déjà
  // trop passé → laissée filer, exclue). Sert et à l'affichage de la main et au tap.
  let target = null;
  for (const n of notes) {
    if (resolved.current.has(n.id)) continue;
    if (n.t < elapsed - CAPTURE_MS) continue;      // passée sans tap → ratée, on laisse filer
    if (target === null || n.t < target.t) target = n;
  }

  // Main affichée = dernière vague dont la 1re note est ENTRÉE à l'écran (bascule
  // exactement quand une nouvelle vague commence à tomber ; l'ancienne est alors
  // déjà hors capture — la cible appartient donc toujours à cette main).
  let handWave = 0;
  for (const n of notes) if (n.t - FALL_MS <= elapsed) handWave = Math.max(handWave, n.wave);
  const hand = chart.waves[handWave]?.spells || [];

  const combo = wizard?.combos?.[mySide] || 0;
  const mult = comboMult(combo);
  const score = wizard?.scores?.[mySide] || 0;

  const handleTap = (spellIndex) => {
    if (over || !target) return;
    const dt = elapsed - target.t;
    if (Math.abs(dt) > CAPTURE_MS) return;          // trop loin de la ligne : tap dans le vide
    resolved.current.add(target.id);
    soundSpell();
    onHit && onHit(target.id, spellIndex, dt);
  };

  const accent = me?.color || '#c9a5ff';

  return (
    <div className={`sh-root${compact ? ' sh-root--compact' : ''}${over ? ' sh-root--over' : ''}`}>
      <div className="sh-hud">
        <span className="sh-score" style={{ color: accent }}>{score}</span>
        <span className={`sh-combo${combo >= 5 ? ' sh-combo--hot' : ''}`}>
          {combo > 1 ? `Combo ×${mult} · ${combo}` : `×${mult}`}
        </span>
      </div>

      <div className="sh-track">
        <div className="sh-line" />

        {notes.map((n) => {
          if (resolved.current.has(n.id)) return null;
          const appear = n.t - FALL_MS;
          if (elapsed < appear || elapsed > n.t + PASS_TAIL_MS) return null;
          const progress = (elapsed - appear) / FALL_MS; // 0 (haut) → 1 (ligne)
          const topPct = progress * LINE_PCT;
          const near = target && n.id === target.id && Math.abs(elapsed - n.t) <= CAPTURE_MS;
          return (
            <div
              key={n.id}
              className={`sh-note${near ? ' sh-note--near' : ''}`}
              style={{ top: `${topPct}%` }}
            >
              {n.label}
            </div>
          );
        })}

        {flash && !counting && (
          <div className={`sh-flash sh-flash--${flash.verdict === 'perfect' ? 'perfect' : flash.verdict === 'good' ? 'good' : 'miss'}`}>
            {flash.verdict === 'perfect' ? 'PARFAIT !'
              : flash.verdict === 'good' ? 'Bien !'
                : flash.verdict === 'wrong' ? 'Raté !' : 'Trop tard'}
          </div>
        )}

        {counting && (
          <div className="sh-ready">
            <div className="sh-ready__txt">Lisez vos sorts&nbsp;!</div>
            <div key={countNum} className="sh-ready__num">{countNum}</div>
          </div>
        )}
      </div>

      <div className={`sh-hand${counting ? ' sh-hand--ready' : ''}`}>
        {hand.map((s, i) => (
          <button
            key={`${handWave}-${i}`}
            type="button"
            className="sh-spell"
            style={{ borderColor: `${accent}88` }}
            onPointerDown={(e) => { e.preventDefault(); handleTap(i); }}
            disabled={over}
          >
            <span className="sh-spell__inc">{s.incantation}</span>
            {s.nomFr && s.nomFr !== s.incantation && <span className="sh-spell__fr">{s.nomFr}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
