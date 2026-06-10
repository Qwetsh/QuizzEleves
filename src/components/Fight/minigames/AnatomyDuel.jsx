import { useMemo } from 'react';
import PlacementDuel from './PlacementDuel.jsx';
import { ANATOMY_SCENES } from './placementData.jsx';
import { shuffle } from '../../../data/fightData';

// Distance euclidienne normalisee (la scene est carree, aspect 1)
function metric(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatDistance(a, b) {
  return `${Math.round(metric(a, b) * 100)} % de la scène`;
}

/**
 * L'Anatomiste (SVT) — place l'élément demandé sur la silhouette
 * (corps humain, fleur, paysage). Moteur PlacementDuel commit-reveal.
 * Une silhouette est tirée pour tout le combat ; les cibles changent
 * à chaque manche sans se répéter.
 */
export default function AnatomyDuel({ attacker, defender, round, onRoundWin }) {
  // Silhouette choisie une fois pour tout le combat
  const scene = useMemo(
    () => ANATOMY_SCENES[Math.floor(Math.random() * ANATOMY_SCENES.length)],
    []
  );

  const pickTarget = (usedIds) => {
    const remaining = scene.targets.filter((t) => !usedIds.includes(t.id));
    const pool = remaining.length ? remaining : scene.targets;
    return shuffle(pool)[0];
  };

  return (
    <PlacementDuel
      attacker={attacker}
      defender={defender}
      round={round}
      onRoundWin={onRoundWin}
      pickTarget={pickTarget}
      renderScene={() => <scene.Scene />}
      aspect={1}
      metric={metric}
      formatDistance={formatDistance}
    />
  );
}
