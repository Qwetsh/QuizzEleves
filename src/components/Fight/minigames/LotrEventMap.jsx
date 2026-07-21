import { lazy, Suspense, useMemo } from 'react';
import { getUniverse } from '../../../data/universes';

/**
 * Carte + marqueur PULSANT réutilisable — extrait du duel tactile
 * (LotrEventDuel). Affiche la carte d'un univers (`terre_du_milieu_atlas`…)
 * cadrée/zoomée sur le point (x,y), avec un halo doré qui pulse par-dessus.
 *
 * Réemployé sur les 3 surfaces du duel « lieu → événement » :
 *   - LotrEventDuel (tactile, grand, 2 colonnes) ;
 *   - MapeventDuelStage (écran partagé / TV, grand) ;
 *   - MapeventDuelView (téléphone / client en ligne, `compact`).
 *
 * Props : { universe, x, y, compact? }.
 *   - `universe` : id (chaîne) OU objet univers déjà résolu.
 *   - `x`,`y` : coordonnées normalisées 0..1 du lieu à marquer.
 *   - `compact` : réduit le halo (vue téléphone).
 *
 * Le marqueur (halo pulsant + étoile) est un VRAI marqueur Leaflet (prop `pulse`
 * / `target` d'UniverseMap) : il est ANCRÉ à la coordonnée et suit donc le
 * pan/zoom de la carte. (Un overlay CSS positionné en % du conteneur, lui,
 * resterait fixe à l'écran et « glisserait » quand on déplace la carte.)
 *
 * Robustesse : UniverseMap importe Leaflet (DOM requis) → chargé en LAZY et
 * enveloppé dans Suspense pour rester absent des tests node. Si l'univers est
 * introuvable ou la carte tarde, un repli sombre est rendu.
 */
const UniverseMap = lazy(() => import('./UniverseMap.jsx'));

export default function LotrEventMap({ universe, x, y, compact = false }) {
  // Accepte un id (chaîne) ou un objet univers déjà résolu.
  const uni = useMemo(
    () => (universe && typeof universe === 'object' ? universe : getUniverse(universe)),
    [universe],
  );

  // Coordonnées défensives : sans cible valide, on centre au milieu (le halo
  // reste rendu, jamais de crash).
  const px = typeof x === 'number' ? x : 0.5;
  const py = typeof y === 'number' ? y : 0.5;

  const mapFallback = <div style={{ width: '100%', height: '100%', background: '#101c26' }} />;

  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden' }}>
      {uni ? (
        <Suspense fallback={mapFallback}>
          <UniverseMap
            key="lotrevent-map"
            universe={uni}
            pins={[]}
            target={{ x: px, y: py }}
            pulse={{ pos: { x: px, y: py }, color: '#f3c969', size: compact ? 30 : 44 }}
            fit={[
              { x: Math.max(0, px - 0.12), y: Math.max(0, py - 0.12) },
              { x: Math.min(1, px + 0.12), y: Math.min(1, py + 0.12) },
            ]}
          />
        </Suspense>
      ) : mapFallback}
    </div>
  );
}
