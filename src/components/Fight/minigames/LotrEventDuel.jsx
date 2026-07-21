import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { LOTR_EVENTS } from '../../../data/lotrEvents';
import { getUniverse } from '../../../data/universes';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

/**
 * « Chroniques de la Terre du Milieu » — duel LIEU → ÉVÉNEMENT, surface TACTILE.
 * Un LIEU s'illumine sur la carte (marqueur pulsant) ; chaque camp voit les 4
 * MÊMES événements (ordres mélangés indépendamment) et doit toucher le plus vite
 * celui qui s'est déroulé À CET ENDROIT. Premier au bon événement gagne la
 * manche ; une erreur verrouille brièvement ce camp. Moteur `persistent:false`
 * (remonté par manche) → best-of-3 NORMAL via onRoundWin.
 *
 * Données : LOTR_EVENTS = [{ place, x, y, event, eventEn }] (x,y normalisés
 * 0..1 sur la carte terre_du_milieu_atlas). Aucune dépendance DB : bundlé.
 */

// Leaflet exige un DOM : chargé en LAZY pour rester absent des tests node.
const UniverseMap = lazy(() => import('./UniverseMap.jsx'));

const WRONG_LOCK_MS = 1400;

// Anti-répétition module-level : lieux déjà servis (par `place`). Survit aux
// remontages entre manches ; on repart de zéro quand le pool est épuisé.
const servedPlaces = new Set();

/**
 * Tire une manche : un lieu cible + 3 distracteurs (événements d'AUTRES lieux),
 * mélangés. Logique PURE et testable (pas de React, pas de rendu).
 *   - `events` : pool [{ place, x, y, event, eventEn }].
 *   - `served` : Set des `place` déjà servis (anti-répétition). Muté ici.
 *   - `rng` : générateur 0..1 (défaut Math.random) — permet un tirage
 *     déterministe dans les tests.
 * Retourne { target, choices } où `choices` = 4 entrées distinctes (dont la
 * cible), mélangées ; ou null si moins de 4 lieux disponibles.
 */
export function drawRound(events, served = servedPlaces, rng = Math.random) {
  const pool = Array.isArray(events) ? events.filter((e) => e && e.place && e.event) : [];
  if (pool.length < 4) return null;

  // Anti-répétition : repartir de zéro si tous les lieux ont été servis.
  if (served.size >= pool.length) served.clear();
  const fresh = pool.filter((e) => !served.has(e.place));
  const target = fresh[Math.floor(rng() * fresh.length)] || pool[Math.floor(rng() * pool.length)];
  served.add(target.place);

  // 3 distracteurs = événements d'AUTRES lieux (jamais la cible elle-même).
  const others = pool.filter((e) => e.place !== target.place);
  // Fisher-Yates partiel avec le rng fourni pour tirer 3 distincts.
  const bag = others.slice();
  const decoys = [];
  for (let i = 0; i < 3 && bag.length; i++) {
    const j = Math.floor(rng() * bag.length);
    decoys.push(bag.splice(j, 1)[0]);
  }
  const choices = shuffle([target, ...decoys]);
  return { target, choices };
}

export default function LotrEventDuel({ attacker, defender, round, onRoundWin }) {
  const T = useT();
  const lang = T.lang;
  const universe = useMemo(() => getUniverse('terre_du_milieu_atlas'), []);

  const [draw, setDraw] = useState(null);
  const [locked, setLocked] = useState({ attacker: false, defender: false });
  const [resolved, setResolved] = useState(null); // null | 'attacker' | 'defender'
  const timersRef = useRef([]);
  const dead = useRef(false);

  const label = (e) => (e ? (lang === 'en' ? (e.eventEn || e.event) : e.event) : '');

  // Nouveau tirage à chaque manche (mémoïsé par `round`) ; pas de Math.random au
  // rendu (tirage dans l'effet de montage/manche uniquement).
  useEffect(() => {
    dead.current = false; // StrictMode : reset dans le CORPS de l'effet
    setDraw(drawRound(LOTR_EVENTS));
    setLocked({ attacker: false, defender: false });
    setResolved(null);
    return () => {
      dead.current = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [round]);

  // Ordres d'affichage INDÉPENDANTS par camp (anti-triche : pas la même
  // disposition des deux côtés). Recalculés à chaque nouveau tirage.
  const orders = useMemo(() => {
    if (!draw) return null;
    const idx = draw.choices.map((_, i) => i);
    return { attacker: shuffle(idx.slice()), defender: shuffle(idx.slice()) };
  }, [draw]);

  // Repli propre : pool insuffisant (données absentes/incomplètes) — pas de
  // soft-lock, on offre un bouton pour attribuer la manche.
  if (!draw || !orders) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        {T('fight.lotrevent.empty')}
        <button className="btn btn--ghost" style={{ marginTop: 14 }} onClick={() => onRoundWin('defender')}>
          {T('fight.quick.roundToDefender')}
        </button>
      </div>
    );
  }

  const handleTap = (side, choiceIdx) => {
    if (resolved || locked[side]) return;
    const chosen = draw.choices[choiceIdx];
    if (chosen && chosen.place === draw.target.place) {
      setResolved(side);
      soundCorrect();
      const t = setTimeout(() => { if (!dead.current) onRoundWin(side); }, 800);
      timersRef.current.push(t);
    } else {
      soundWrong();
      setLocked((prev) => ({ ...prev, [side]: true }));
      const t = setTimeout(() => {
        if (!dead.current) setLocked((prev) => ({ ...prev, [side]: false }));
      }, WRONG_LOCK_MS);
      timersRef.current.push(t);
    }
  };

  const target = draw.target;
  // Marqueur PULSANT à la cible + cadrage serré sur ce point (fit = un seul
  // point → UniverseMap zoome dessus). Halo animé via badge personnalisé ci-bas.
  const mapFallback = <div style={{ width: '100%', height: '100%', background: '#101c26' }} />;

  const renderSide = (side, team) => {
    const isLocked = locked[side];
    const isWinner = resolved === side;
    return (
      <div
        style={{
          flex: 1, minWidth: 0, position: 'relative',
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '12px 14px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
          opacity: isLocked && !resolved ? 0.55 : 1,
          transition: 'opacity 200ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <TeamAvatar team={team} size={28} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
        </div>
        {isLocked && !resolved && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 20, color: '#c9472f',
            background: 'rgba(255,255,255,0.5)', borderRadius: 16, zIndex: 2, pointerEvents: 'none',
          }}>
            {T('fight.lotrevent.wrong')}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, justifyContent: 'center' }}>
          {orders[side].map((choiceIdx) => {
            const choice = draw.choices[choiceIdx];
            const isCorrect = choice.place === target.place;
            const showResult = resolved && isCorrect;
            return (
              <button
                key={choiceIdx}
                onPointerDown={() => handleTap(side, choiceIdx)}
                disabled={!!resolved || isLocked}
                style={{
                  padding: '11px 12px', borderRadius: 12,
                  border: showResult ? '3px solid #5b8c3a' : '2px solid rgba(122,94,58,0.25)',
                  background: showResult ? '#d1f0b8' : (isWinner ? '#fffefb' : '#fffefb'),
                  fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500,
                  textAlign: 'left', cursor: resolved || isLocked ? 'default' : 'pointer',
                  touchAction: 'manipulation', lineHeight: 1.25,
                }}
              >
                {label(choice)}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Le « spectacle » : la carte avec le lieu qui pulse */}
      <div style={{ position: 'relative', flex: '1 1 42%', minHeight: 0, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
        {universe ? (
          <Suspense fallback={mapFallback}>
            <UniverseMap
              key="lotrevent-map"
              universe={universe}
              pins={[]}
              badges={[{ pos: { x: target.x, y: target.y }, label: '★', color: '#f3c969' }]}
              target={{ x: target.x, y: target.y }}
              fit={[
                { x: Math.max(0, target.x - 0.12), y: Math.max(0, target.y - 0.12) },
                { x: Math.min(1, target.x + 0.12), y: Math.min(1, target.y + 0.12) },
              ]}
            />
          </Suspense>
        ) : mapFallback}
        {/* Halo pulsant surimposé (indépendant de Leaflet, toujours visible) */}
        <div
          aria-hidden
          style={{
            position: 'absolute', left: `${target.x * 100}%`, top: `${target.y * 100}%`,
            width: 46, height: 46, marginLeft: -23, marginTop: -23,
            borderRadius: '50%', border: '3px solid #f3c969',
            boxShadow: '0 0 18px 6px rgba(243,201,105,0.7)',
            pointerEvents: 'none', zIndex: 3,
            animation: 'lotrPulse 1.4s ease-out infinite',
          }}
        />
        <style>{'@keyframes lotrPulse{0%{transform:scale(0.7);opacity:1}70%{transform:scale(1.5);opacity:0.25}100%{transform:scale(0.7);opacity:1}}'}</style>
        {/* Bandeau énoncé */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 22px', borderRadius: 12, textAlign: 'center', maxWidth: '90%',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
          boxShadow: '0 3px 10px rgba(0,0,0,0.35)', zIndex: 4,
        }}>
          {T('fight.lotrevent.prompt')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flex: '1 1 58%', minHeight: 0 }}>
        {renderSide('attacker', attacker)}
        {renderSide('defender', defender)}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.lotrevent.hint')}
      </div>
    </div>
  );
}
