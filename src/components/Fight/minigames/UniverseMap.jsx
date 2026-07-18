import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { characterById } from '../../../data/characters';
import { spotImageUrl } from '../../../data/universes';

/**
 * Carte d'univers Curioscope — Leaflet en CRS.Simple, deux modes selon
 * `universe.map` :
 * - image (défaut) : { src, aspect } — une seule image (imageOverlay).
 * - tiles : { type:'tiles', path, w, h, maxNativeZoom } — pyramide de tuiles
 *   {z}/{x}/{y}.webp (rendu « satellite » zoomable, cf. make-tiles.mjs) ;
 *   `path` est relatif au bucket quete-spots.
 * Dans les deux cas l'API externe est en coordonnées NORMALISÉES 0..1.
 *
 * Props : universe, interactive, onPlace({x,y}), pins [{team,pos}], target,
 * lines [{from,to,color}], badges [{pos,label,color}], fit [{x,y},...].
 *
 * NOTE tests : ce fichier importe Leaflet (qui exige un DOM) — il doit rester
 * chargé en LAZY (Curioscope.jsx / CurioChallengeModal) pour ne jamais être
 * évalué sous vitest/node.
 */

// Espace carte interne du mode image : hauteur fixe 1000.
const MAP_H = 1000;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Adaptateur de coordonnées : normalisé 0..1 ↔ latlng CRS.Simple.
// Mode tiles : latlng = pixels pleine résolution / 2^Z (grille de tuiles
// standard origine haut-gauche, lat négatif vers le bas).
function makeSpace(mapDef) {
  if (mapDef?.type === 'tiles') {
    const { w, h, maxNativeZoom: Z } = mapDef;
    const s = 2 ** Z;
    return {
      tiled: true, Z,
      bounds: L.latLngBounds([[-h / s, 0], [0, w / s]]),
      toLatLng: (p) => [-(p.y * h) / s, (p.x * w) / s],
      fromLatLng: (ll) => ({ x: clamp01((ll.lng * s) / w), y: clamp01((-ll.lat * s) / h) }),
    };
  }
  const W = MAP_H * (mapDef?.aspect ?? 1);
  return {
    tiled: false,
    bounds: L.latLngBounds([[0, 0], [MAP_H, W]]),
    toLatLng: (p) => [(1 - p.y) * MAP_H, p.x * W],
    fromLatLng: (ll) => ({ x: clamp01(ll.lng / W), y: clamp01(1 - ll.lat / MAP_H) }),
  };
}

// Épingle « goutte » à l'effigie de l'équipe (même design que PlacementDuel) :
// sprite du personnage si défini, sinon emoji. HTML construit SANS texte libre
// (pas de nom d'équipe) — couleur/emoji/sprite uniquement.
function pinIcon(team) {
  const char = characterById(team.character);
  const inner = char?.body
    ? `<img src="${char.body}" style="width:22px;height:22px;object-fit:contain;image-rendering:pixelated;display:block" alt=""/>`
    : `<span style="font-size:17px;line-height:1">${team.emoji || ''}</span>`;
  return L.divIcon({
    className: '',
    iconSize: [34, 42],
    iconAnchor: [17, 40], // pointe de la goutte
    html: `<div style="position:relative;width:34px;height:42px;filter:drop-shadow(0 3px 3px rgba(0,0,0,0.45))">
      <div style="position:absolute;left:1px;top:1px;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${team.color};border:2.5px solid #fffefb;display:flex;align-items:center;justify-content:center">
        <span style="transform:rotate(45deg);display:flex">${inner}</span>
      </div>
    </div>`,
  });
}

function targetIcon() {
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div style="font-size:26px;line-height:34px;text-align:center;filter:drop-shadow(0 0 6px rgba(243,201,105,0.9))">⭐</div>`,
  });
}

function badgeIcon(label, color) {
  const safe = String(label).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(255,254,251,0.95);border:2px solid ${color};font-family:var(--font-display);font-size:13px;color:var(--ink-900);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${safe}</div>`,
  });
}

export default function UniverseMap({
  universe, interactive = false, onPlace,
  pins = [], target = null, lines = [], badges = [], fit = null,
}) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);
  const spaceRef = useRef(null);
  const onPlaceRef = useRef(onPlace);
  const interactiveRef = useRef(interactive);
  const fitKeyRef = useRef('');
  onPlaceRef.current = onPlace;
  interactiveRef.current = interactive;

  // Création / destruction de la carte (une par univers affiché).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const space = makeSpace(universe.map);
    spaceRef.current = space;
    const { bounds } = space;
    const map = L.map(el, {
      crs: L.CRS.Simple,
      attributionControl: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: -6,
      maxBounds: bounds.pad(0.12),
      maxBoundsViscosity: 1.0,
      inertia: false,
    });
    if (space.tiled) {
      L.tileLayer(`${spotImageUrl(universe.map.path)}/{z}/{x}/{y}.webp`, {
        tileSize: 256,
        minNativeZoom: 0,
        maxNativeZoom: space.Z,
        bounds,
        noWrap: true,
        keepBuffer: 4,
        className: 'curio-tiles',
      }).addTo(map);
    } else {
      L.imageOverlay(universe.map.src, bounds).addTo(map);
    }
    layersRef.current = L.layerGroup().addTo(map);
    map.on('click', (e) => {
      if (!interactiveRef.current || !onPlaceRef.current) return;
      onPlaceRef.current(spaceRef.current.fromLatLng(e.latlng));
    });
    mapRef.current = map;

    // Cadre initial + bornes de zoom : calculés quand le conteneur a une taille
    // (il peut être à 0 au premier rendu dans un layout flex).
    let fitted = false;
    const fitInitial = () => {
      if (fitted || el.clientWidth < 40 || el.clientHeight < 40) return;
      fitted = true;
      map.invalidateSize();
      const fz = map.getBoundsZoom(bounds, true);
      map.setMinZoom(fz);
      // ≈ ×11 de zoom linéaire minimum ; en tuiles, jamais moins que le zoom
      // natif + 1 (les pyramides basse résolution gardent un sur-zoom flou
      // mais utile pour viser au pixel).
      map.setMaxZoom(Math.max(fz + 3.5, space.tiled ? space.Z + 1 : -Infinity));
      map.fitBounds(bounds);
    };
    fitInitial();
    const ro = new ResizeObserver(() => { map.invalidateSize(); fitInitial(); });
    ro.observe(el);

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; layersRef.current = null; spaceRef.current = null; };
  }, [universe.id]);

  // Curseur : viseur quand on peut poser, main sinon (Leaflet gère le pan).
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getContainer().style.cursor = interactive ? 'crosshair' : '';
  }, [interactive, universe.id]);

  // Synchronisation des couches (pins / cible / traits / badges).
  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    const space = spaceRef.current;
    if (!map || !group || !space) return;
    group.clearLayers();
    for (const ln of lines) {
      L.polyline([space.toLatLng(ln.from), space.toLatLng(ln.to)], {
        color: ln.color, weight: 2.5, dashArray: '7 6', interactive: false,
      }).addTo(group);
    }
    if (target) L.marker(space.toLatLng(target), { icon: targetIcon(), interactive: false, zIndexOffset: 400 }).addTo(group);
    for (const p of pins) {
      if (p.pos) L.marker(space.toLatLng(p.pos), { icon: pinIcon(p.team), interactive: false, zIndexOffset: 500 }).addTo(group);
    }
    for (const b of badges) {
      L.marker(space.toLatLng(b.pos), { icon: badgeIcon(b.label, b.color), interactive: false, zIndexOffset: 600 }).addTo(group);
    }
    // Révélation : cadrer la vue sur pins + cible (une fois par jeu de points).
    if (fit && fit.length) {
      const key = fit.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join('|');
      if (key !== fitKeyRef.current) {
        fitKeyRef.current = key;
        const fb = L.latLngBounds(fit.map((p) => space.toLatLng(p))).pad(0.35);
        map.fitBounds(fb);
      }
    }
  });

  return (
    <div
      ref={boxRef}
      style={{
        width: '100%', height: '100%',
        background: '#101c26',
        borderRadius: 'inherit',
        overflow: 'hidden',
        // Leaflet pose ses propres z-index : isoler son contexte d'empilement
        // pour ne pas passer au-dessus des overlays de la modale de duel.
        position: 'relative', zIndex: 0, isolation: 'isolate',
      }}
    />
  );
}
