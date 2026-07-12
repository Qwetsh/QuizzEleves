import { useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import PlacementDuel from './PlacementDuel.jsx';
import { GEO_PLACES, GEO_CAPITALS, lonLatToXY, haversineKm } from './placementData.jsx';
import { shuffle } from '../../../data/fightData';
import TeamAvatar from '../../TeamAvatar';
import worldMap from '../../../assets/world-equirect.jpg';
import { useT } from '../../../i18n';

// Photos des lieux (Wikimedia Commons, credits dans src/data/placePhotoCredits.json),
// chargees a la demande par le navigateur — pas d'impact sur le bundle JS.
const PHOTO_URLS = import.meta.glob('../../../assets/places/*.jpg', {
  eager: true, query: '?url', import: 'default',
});

function photoUrl(slug) {
  return slug ? PHOTO_URLS[`../../../assets/places/${slug}.jpg`] : undefined;
}

// --- Scoring facon GeoGuessr ---
// Course a 10 000 pts : 2 manches parfaites (<=100 km = 5000 pts) suffisent,
// les matchs restent courts.
export const GEO_TARGET_SCORE = 10000;

// 5000 pts a moins de 100 km, puis decroissance exponentielle
export function geoPoints(km) {
  if (km <= 100) return 5000;
  return Math.round(5000 * Math.exp(-(km - 100) / 2000));
}

function metric(a, b) {
  return haversineKm(a, b);
}

// Fabrique un formateur de distance localisé (la locale numérique suit la langue).
function makeFormatDistance(T) {
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';
  return (a, b) => {
    const km = haversineKm(a, b);
    return km < 1 ? T('fight.geo.pileDessus') : T('fight.geo.km', { n: km.toLocaleString(numLocale) });
  };
}

function makeRenderScene(T) {
  return () => (
    <img
      src={worldMap}
      alt={T('fight.geo.worldMapAlt')}
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', userSelect: 'none' }}
    />
  );
}

function ScoreBar({ team, score, align }) {
  const T = useT();
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';
  const ratio = Math.min(1, score / GEO_TARGET_SCORE);
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

/**
 * Tour du monde (géographie) — façon GeoGuessr : photo d'un lieu célèbre
 * SANS son nom, chaque équipe plante son drapeau (commit-reveal), et
 * marque des points selon la distance (≤100 km = 5 000 pts, dégressif).
 * PREMIER À 10 000 POINTS = victoire directe du combat.
 */
export default function GeoDuel({ attacker, defender, onRoundWin }) {
  const T = useT();
  const fightMatchWin = useGameStore((s) => s.fightMatchWin);
  const [scores, setScores] = useState({ attacker: 0, defender: 0 });
  const [geoRound, setGeoRound] = useState(1);
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';
  const formatDistance = makeFormatDistance(T);
  const renderScene = makeRenderScene(T);

  // Alterne : manche impaire = PHOTO d'un lieu, manche paire = NOM d'une capitale
  // à placer (pas de photo → PlacementDuel affiche « Place : <capitale> »).
  const pickTarget = (usedIds) => {
    const isCapital = geoRound % 2 === 0;
    const source = isCapital ? GEO_CAPITALS : GEO_PLACES;
    const remaining = source.filter((p) => !usedIds.includes(p.name));
    const pool = remaining.length ? remaining : source;
    const place = shuffle(pool)[0];
    const { x, y } = lonLatToXY(place.lon, place.lat);
    if (isCapital) return { id: place.name, label: place.name, x, y };
    return { id: place.name, label: place.name, x, y, photo: photoUrl(place.photo), showName: place.showName };
  };

  const handleRoundEnd = ({ pA, pB }) => {
    const next = { attacker: scores.attacker + (pA || 0), defender: scores.defender + (pB || 0) };
    setScores(next);
    if (next.attacker >= GEO_TARGET_SCORE || next.defender >= GEO_TARGET_SCORE) {
      // Les deux peuvent franchir la barre au meme tour : le plus haut total gagne
      if (next.attacker !== next.defender) {
        fightMatchWin(next.attacker > next.defender ? 'attacker' : 'defender');
        return;
      }
    }
    setGeoRound((r) => r + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Tableau de score : course a 10 000 points */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '6px 14px', borderRadius: 12,
        background: 'rgba(255,254,251,0.10)',
        border: '1px solid rgba(243,201,105,0.3)',
      }}>
        <ScoreBar team={attacker} score={scores.attacker} align="left" />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center', whiteSpace: 'nowrap' }}>
          {'\u{1F3C1}'} {T('fight.geo.points', { n: GEO_TARGET_SCORE.toLocaleString(numLocale) })}
        </div>
        <ScoreBar team={defender} score={scores.defender} align="right" />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <PlacementDuel
          attacker={attacker}
          defender={defender}
          round={geoRound}
          onRoundWin={onRoundWin}
          onRoundEnd={handleRoundEnd}
          scoreFn={geoPoints}
          pickTarget={pickTarget}
          renderScene={renderScene}
          aspect={2}
          metric={metric}
          formatDistance={formatDistance}
        />
      </div>
    </div>
  );
}
