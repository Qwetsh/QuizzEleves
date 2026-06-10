import PlacementDuel from './PlacementDuel.jsx';
import { GEO_PLACES, lonLatToXY, haversineKm } from './placementData.jsx';
import { shuffle } from '../../../data/fightData';
import worldMap from '../../../assets/world-equirect.jpg';

function metric(a, b) {
  return haversineKm(a, b);
}

function formatDistance(a, b) {
  const km = haversineKm(a, b);
  return km < 1 ? 'pile dessus !' : `${km.toLocaleString('fr-FR')} km`;
}

function renderScene() {
  return (
    <img
      src={worldMap}
      alt="Carte du monde"
      draggable={false}
      style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', userSelect: 'none' }}
    />
  );
}

/**
 * GeoGuessr (géographie) — un lieu célèbre à localiser sur la carte du
 * monde (projection équirectangulaire : lat/lon -> x/y linéaire).
 * Moteur PlacementDuel commit-reveal ; le plus proche en km gagne.
 * V1 : le lieu est annoncé par son nom — les photos (validées par
 * l'enseignant) prendront le relais via le champ photo des données.
 */
export default function GeoDuel({ attacker, defender, round, onRoundWin }) {
  const pickTarget = (usedIds) => {
    const remaining = GEO_PLACES.filter((p) => !usedIds.includes(p.name));
    const pool = remaining.length ? remaining : GEO_PLACES;
    const place = shuffle(pool)[0];
    const { x, y } = lonLatToXY(place.lon, place.lat);
    return { id: place.name, label: place.name, x, y, photo: place.photo };
  };

  return (
    <PlacementDuel
      attacker={attacker}
      defender={defender}
      round={round}
      onRoundWin={onRoundWin}
      pickTarget={pickTarget}
      renderScene={renderScene}
      aspect={2}
      metric={metric}
      formatDistance={formatDistance}
    />
  );
}
