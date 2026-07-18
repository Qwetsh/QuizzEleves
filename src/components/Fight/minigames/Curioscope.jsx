import { lazy, Suspense, useRef, useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import PlacementDuel from './PlacementDuel.jsx';
import {
  getUniverse, universeMetric, universeScore, pickSpot, CURIO_TARGET_SCORE, spotPhoto,
} from '../../../data/universes.js';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

/**
 * Curioscope — moteur « guessr » MULTI-UNIVERS (successeur du GeoDuel) :
 * une image (photo d'un lieu) ou un nom à placer, chaque équipe pose son pin
 * sur la carte ZOOMABLE de l'univers (Leaflet), points à la distance
 * (barème exponentiel de l'univers). PREMIER À 10 000 POINTS = victoire.
 *
 * `content` (depuis THEME_MINIGAMES) : { universes: ['monde_reel', ...],
 * target? } — plusieurs univers = rotation une manche sur N. L'anti-répétition
 * inter-parties (curioSeen, persisté par sauvegarde) est appliquée au tirage.
 */

// Leaflet exige un DOM : chargé en LAZY pour rester absent des tests node
// (qui importent le registre des mini-jeux) et du bundle initial.
const UniverseMap = lazy(() => import('./UniverseMap.jsx'));

// Résolution des photos de spots : déplacée dans universes.js (le moteur de
// duel côté store en a besoin pour les surfaces téléphone/en ligne) —
// ré-exportée ici pour les consommateurs existants (CurioChallengeModal).
export { spotPhoto } from '../../../data/universes.js';

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function ScoreBar({ team, score, target, align }) {
  const T = useT();
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';
  const ratio = Math.min(1, score / target);
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)',
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
      }}>
        <TeamAvatar team={team} size={28} />
        <span style={{ fontSize: 13, color: '#fff' }}>{team.name}</span>
        <span style={{ fontSize: 16, color: '#f3c969' }}>{T('fight.geo.points', { n: score.toLocaleString(numLocale) })}</span>
      </div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden', transform: align === 'right' ? 'scaleX(-1)' : 'none' }}>
        <div style={{
          height: '100%', width: `${ratio * 100}%`,
          background: `linear-gradient(90deg, ${team.color}, #f3c969)`,
          borderRadius: 4, transition: 'width 500ms ease',
        }} />
      </div>
    </div>
  );
}

export default function Curioscope({ attacker, defender, onRoundWin, content }) {
  const T = useT();
  const fightMatchWin = useGameStore((s) => s.fightMatchWin);
  // Rotation UNIQUEMENT parmi les univers qui ont des spots chargés (banques
  // remplies au fil de l'eau : un continent peut être vide avant son seed).
  const declared = content?.universes?.length ? content.universes : ['monde_reel'];
  const withSpots = declared.filter((id) => (getUniverse(id)?.spots() || []).length > 0);
  const universeIds = withSpots.length ? withSpots : ['monde_reel'];
  const targetScore = content?.target ?? CURIO_TARGET_SCORE;
  const [scores, setScores] = useState({ attacker: 0, defender: 0 });
  const [roundNo, setRoundNo] = useState(1);
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';

  // Univers de la manche EN COURS : les props metric/scoreFn/formatDistance de
  // PlacementDuel sont fixes — elles lisent cette ref, mise à jour au tirage.
  const uRef = useRef(getUniverse(universeIds[0]) || getUniverse('monde_reel'));

  const formatDistance = (a, b) => {
    const u = uRef.current;
    const d = universeMetric(u, a, b);
    if (d < 1) return T('fight.geo.pileDessus');
    const key = u.unit === 'km' ? 'fight.geo.km' : 'curio.dist.lieues';
    return T(key, { n: d.toLocaleString(numLocale) });
  };

  // Tirage : rotation des univers (si plusieurs) + anti-répétition LRU
  // inter-parties (curioSeen du store, marqué immédiatement — un spot affiché
  // au TBI est grillé pour toute la classe).
  const pickTarget = (usedIds) => {
    const uid = universeIds[(roundNo - 1) % universeIds.length];
    const u = getUniverse(uid) || getUniverse('monde_reel');
    uRef.current = u;
    const st = useGameStore.getState();
    const seen = (st.curioSeen || {})[u.id] || {};
    const spot = pickSpot(u, seen, roundNo, new Set(usedIds));
    if (!spot) return null;
    st.curioMarkSeen(u.id, spot.id);
    return {
      id: spot.id, label: spot.label, x: spot.x, y: spot.y,
      photo: spotPhoto(spot), showName: spot.showName,
    };
  };

  const handleRoundEnd = ({ pA, pB }) => {
    const next = { attacker: scores.attacker + (pA || 0), defender: scores.defender + (pB || 0) };
    setScores(next);
    if (next.attacker >= targetScore || next.defender >= targetScore) {
      // Les deux peuvent franchir la barre au même tour : le plus haut gagne
      if (next.attacker !== next.defender) {
        fightMatchWin(next.attacker > next.defender ? 'attacker' : 'defender');
        return;
      }
    }
    setRoundNo((r) => r + 1);
  };

  const mapFallback = <div style={{ width: '100%', height: '100%', background: '#101c26' }} />;

  const renderBoard = (ctx) => {
    const u = uRef.current;
    if (ctx.phase === 'place') {
      return (
        <Suspense fallback={mapFallback}>
          <UniverseMap
            key={`${u.id}-${ctx.side}`}
            universe={u}
            interactive={!ctx.disabled}
            onPlace={ctx.onPlace}
            pins={ctx.mark ? [{ team: ctx.team, pos: ctx.mark }] : []}
          />
        </Suspense>
      );
    }
    const { marks, target } = ctx;
    return (
      <Suspense fallback={mapFallback}>
        <UniverseMap
          key={`${u.id}-reveal`}
          universe={u}
          pins={[{ team: attacker, pos: marks.attacker }, { team: defender, pos: marks.defender }]}
          target={target}
          lines={[
            { from: marks.attacker, to: target, color: attacker.color },
            { from: marks.defender, to: target, color: defender.color },
          ]}
          badges={[
            { pos: mid(marks.attacker, target), label: formatDistance(marks.attacker, target), color: attacker.color },
            { pos: mid(marks.defender, target), label: formatDistance(marks.defender, target), color: defender.color },
          ]}
          fit={[marks.attacker, marks.defender, target]}
        />
      </Suspense>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Tableau de score : course aux points */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '6px 14px', borderRadius: 12,
        background: 'rgba(255,254,251,0.10)',
        border: '1px solid rgba(243,201,105,0.3)',
      }}>
        <ScoreBar team={attacker} score={scores.attacker} target={targetScore} align="left" />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center', whiteSpace: 'nowrap' }}>
          {'\u{1F3C1}'} {T('fight.geo.points', { n: targetScore.toLocaleString(numLocale) })}
        </div>
        <ScoreBar team={defender} score={scores.defender} target={targetScore} align="right" />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <PlacementDuel
          attacker={attacker}
          defender={defender}
          round={roundNo}
          onRoundWin={onRoundWin}
          onRoundEnd={handleRoundEnd}
          scoreFn={(d) => universeScore(uRef.current, d)}
          pickTarget={pickTarget}
          metric={(a, b) => universeMetric(uRef.current, a, b)}
          formatDistance={formatDistance}
          renderBoard={renderBoard}
        />
      </div>
    </div>
  );
}
