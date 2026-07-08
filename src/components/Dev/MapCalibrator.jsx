// Outil DEV de calibration des continents (maps v2 espace) — route ?calibrate
//
// Charge l'image d'un continent (du bundle ou un fichier local pas encore
// intégré), puis : clic = poser une ancre du type sélectionné, drag = ajuster,
// double-clic = supprimer. Aperçu des socles/pion À L'ÉCHELLE DU JEU (le
// continent est rendu réduit par CONT_SCALE en jeu, les socles en taille
// absolue → ici les socles sont affichés à SOCLE_W / CONT_SCALE pixels d'asset).
// Export JSON au format de src/data/maps/espace.js (à coller dans le registre).
//
// Les ancres de voie s'insèrent intelligemment : un clic s'insère après le
// segment le plus proche de la polyligne (pas seulement en fin de route).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CONTINENT, CONTINENTS, SPACE_ASSET_DIMS, SOCLE_W, SOCLE_TOP_DY } from '../../data/maps/espace.js';
import { CONT_SCALE } from '../../logic/mapComposer.js';

const SPACE_ASSET_URLS = import.meta.glob('../../assets/space/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
const SPACE_ASSETS = Object.fromEntries(
  Object.entries(SPACE_ASSET_URLS).map(([p, url]) => [p.split('/').pop().replace(/\.(png|webp)$/, ''), url])
);
const CONTINENT_KEYS = Object.keys(SPACE_ASSETS).filter((k) => k.startsWith('continent') || k.startsWith('cont-')).sort();
const SOCLE_KEYS = Object.keys(SPACE_ASSETS).filter((k) => k.startsWith('socle'));

// Calibration existante d'un asset : registre thématique (cont-{theme}) sinon générique
const defForImg = (imgKey) =>
  (imgKey.startsWith('cont-') && CONTINENTS[imgKey.slice(5)]) || CONTINENT;

const ROUTE_COLOR = '#ffc83c';
// in/out = points de BRANCHEMENT avec l'espace (pas des cases : la traînée
// d'îlots s'y raccroche visuellement, le pion n'y passe pas de tour).
// jin/jout = première/dernière CASE jouable de la route (socle + pion).
const POINT_META = {
  in: { label: '⚓ Branchement OUEST (bout du ponton — pas une case)', short: 'IN', color: '#ffffff' },
  out: { label: '🚪 Branchement EST (seuil de la porte — pas une case)', short: 'OUT', color: '#ffffff' },
  jin: { label: '① 1re case de la route', short: '1RE CASE', color: '#ff5050' },
  jout: { label: '⑩ Dernière case de la route', short: 'DER. CASE', color: '#ff5050' },
};

const emptyDef = () => ({ in: null, out: null, jin: null, jout: null, route: [] });

function fromContinent(c) {
  return {
    in: { ...c.in }, out: { ...c.out }, jin: { ...c.jin }, jout: { ...c.jout },
    // rétro-compat : anciennes calibrations à 3 voies → on garde la voie centrale
    route: (c.route || c.lanes?.[1]?.anchors || c.lanes?.[0]?.anchors || []).map((a) => ({ ...a })),
  };
}

// Index d'insertion dans une polyligne : après le segment le plus proche du clic
function insertIndex(pts, p) {
  if (pts.length < 2) return pts.length;
  let best = pts.length - 1, bd = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (d < bd) { bd = d; best = i; }
  }
  // au-delà du dernier point → append
  const end = pts[pts.length - 1];
  if (Math.hypot(p.x - end.x, p.y - end.y) < bd) return pts.length;
  return best + 1;
}

export default function MapCalibrator() {
  const [imgKey, setImgKey] = useState(CONTINENT_KEYS[0] || '');
  const [localImg, setLocalImg] = useState(null); // { url, name }
  const [imgDims, setImgDims] = useState({ w: CONTINENT.w, h: CONTINENT.h });
  const [def, setDef] = useState(() => fromContinent(CONTINENT));
  const [tool, setTool] = useState('route');
  const [zoom, setZoom] = useState(0.55);
  const [showSocles, setShowSocles] = useState(true);
  const [showPawn, setShowPawn] = useState(false);
  const [jsonText, setJsonText] = useState('');
  // Point sélectionné (dernier posé ou touché) : { kind:'route', index } |
  // { kind:'point', key } | null — la touche Suppr l'efface.
  const [selected, setSelected] = useState(null);
  const dragRef = useRef(null); // { kind:'route'|'point', index, key }
  const svgRef = useRef(null);

  const imgUrl = localImg ? localImg.url : SPACE_ASSETS[imgKey];
  const imgName = localImg ? localImg.name.replace(/\.png$/i, '') : imgKey;

  // Coordonnées SVG depuis un événement pointeur (viewBox 0 0 w h, largeur CSS = w*zoom)
  const toSvg = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * (imgDims.w / rect.width)),
      y: Math.round((e.clientY - rect.top) * (imgDims.h / rect.height)),
    };
  };

  const onSvgClick = (e) => {
    if (dragRef.current?.moved) { dragRef.current = null; return; }
    const p = toSvg(e);
    setDef((d) => {
      if (tool === 'route') {
        const route = d.route.slice();
        const idx = insertIndex(route, p);
        route.splice(idx, 0, p);
        setSelected({ kind: 'route', index: idx });
        return { ...d, route };
      }
      setSelected({ kind: 'point', key: tool });
      return { ...d, [tool]: p };
    });
  };

  // Suppr/Backspace = effacer le point sélectionné, Échap = désélectionner.
  // (ignoré quand le focus est dans la zone JSON ou un champ de saisie)
  useEffect(() => {
    const onKey = (e) => {
      if (/^(TEXTAREA|INPUT|SELECT)$/.test(e.target?.tagName || '')) return;
      if (e.key === 'Escape') { setSelected(null); return; }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!selected) return;
      e.preventDefault();
      setDef((d) => {
        if (selected.kind === 'route') {
          const route = d.route.slice();
          route.splice(selected.index, 1);
          return { ...d, route };
        }
        return { ...d, [selected.key]: null };
      });
      setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const startDrag = (e, ref) => {
    e.stopPropagation();
    setSelected(ref.kind === 'route' ? { kind: 'route', index: ref.index } : { kind: 'point', key: ref.key });
    dragRef.current = { ...ref, moved: false };
    const move = (ev) => {
      dragRef.current.moved = true;
      const p = toSvg(ev);
      setDef((d) => {
        if (ref.kind === 'route') {
          const route = d.route.slice();
          route[ref.index] = p;
          return { ...d, route };
        }
        return { ...d, [ref.key]: p };
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setTimeout(() => { dragRef.current = null; }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const removePoint = (e, ref) => {
    e.stopPropagation();
    e.preventDefault();
    setDef((d) => {
      if (ref.kind === 'route') {
        const route = d.route.slice();
        route.splice(ref.index, 1);
        return { ...d, route };
      }
      return { ...d, [ref.key]: null };
    });
    setSelected(null);
  };

  const exportJson = () => {
    const out = {
      img: imgName,
      w: imgDims.w,
      h: imgDims.h,
      in: def.in, out: def.out, jin: def.jin, jout: def.jout,
      route: def.route,
    };
    const text = JSON.stringify(out, null, 2);
    setJsonText(text);
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const importJson = () => {
    try {
      const c = JSON.parse(jsonText);
      setDef({
        in: c.in || null, out: c.out || null, jin: c.jin || null, jout: c.jout || null,
        route: (c.route || c.lanes?.[1]?.anchors || []).map((a) => ({ ...a })),
      });
    } catch {
      alert('JSON invalide');
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLocalImg({ url: URL.createObjectURL(f), name: f.name });
    setDef(emptyDef());
  };

  // Socle rendu à l'échelle du jeu, transposée en pixels d'asset
  const socleW = SOCLE_W / CONT_SCALE;
  const socleKey = SOCLE_KEYS[0];
  const socleDims = SPACE_ASSET_DIMS[socleKey] || { w: 267, h: 187 };
  const socleH = (socleW * socleDims.h) / socleDims.w;
  const socleTopDy = SOCLE_TOP_DY * socleH;
  const pawnR = 24 / CONT_SCALE;

  const Socle = ({ p }) => (
    <image
      href={SPACE_ASSETS[socleKey]}
      x={p.x - socleW / 2} y={p.y - socleTopDy - socleH / 2}
      width={socleW} height={socleH}
      style={{ pointerEvents: 'none' }} opacity={0.92}
    />
  );

  const allCasePoints = useMemo(() => {
    const pts = [];
    if (def.jin) pts.push(def.jin);
    if (def.jout) pts.push(def.jout);
    pts.push(...def.route);
    return pts;
  }, [def]);

  const btn = (active) => ({
    padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    border: active ? '2px solid #ffd24a' : '1px solid #665', fontWeight: active ? 700 : 400,
    background: active ? '#4a3a12' : '#2a2438', color: '#eee',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#17102b', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      {/* Barre d'outils */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#221a3a', borderBottom: '1px solid #443a66' }}>
        <strong style={{ marginRight: 6 }}>🪐 MapCalibrator</strong>
        <select value={localImg ? '__local' : imgKey} onChange={(e) => {
          if (e.target.value === '__local') return;
          const k = e.target.value;
          setLocalImg(null);
          setImgKey(k);
          // charge la calibration connue de cet asset (dérivée ou affinée)
          const d = defForImg(k);
          setDef(fromContinent(d));
          setImgDims({ w: d.w, h: d.h });
        }}
          style={{ background: '#2a2438', color: '#eee', border: '1px solid #665', borderRadius: 8, padding: 6 }}>
          {CONTINENT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          {localImg && <option value="__local">{localImg.name} (local)</option>}
        </select>
        <label style={{ ...btn(false), display: 'inline-block' }}>
          📂 Image locale…
          <input type="file" accept="image/png" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <span style={{ width: 12 }} />
        <button onClick={() => setTool('route')} style={{ ...btn(tool === 'route'), borderColor: tool === 'route' ? ROUTE_COLOR : '#665' }}>
          ● <span style={{ color: ROUTE_COLOR }}>LA ROUTE</span> ({def.route.length})
        </button>
        {Object.entries(POINT_META).map(([k, m]) => (
          <button key={k} onClick={() => setTool(k)} title={m.label} style={btn(tool === k)}>
            {m.label.split('(')[0].trim()}{def[k] ? ' ✓' : ''}
          </button>
        ))}
        <span style={{ width: 12 }} />
        <label style={{ fontSize: 13 }}>Zoom <input type="range" min="0.2" max="1.2" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={showSocles} onChange={(e) => setShowSocles(e.target.checked)} /> socles</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={showPawn} onChange={(e) => setShowPawn(e.target.checked)} /> pion</label>
        <span style={{ flex: 1 }} />
        <button onClick={() => setDef(fromContinent(defForImg(localImg ? '' : imgKey)))} style={btn(false)}>↺ Charger calibration actuelle</button>
        <button onClick={() => setDef(emptyDef())} style={btn(false)}>🗑 Vider</button>
        <button onClick={exportJson} style={{ ...btn(false), background: '#1d4a2a', border: '1px solid #3c8' }}>📋 Exporter (presse-papiers)</button>
      </div>

      <div style={{ padding: '6px 14px', fontSize: 12, color: '#b9a' }}>
        Clic = poser une ancre de l'outil sélectionné (insertion après le segment le plus proche pour la route) ·
        glisser = ajuster · <strong>Suppr</strong> = effacer le point sélectionné (cerclé de blanc — le dernier posé/touché) ·
        double-clic = supprimer aussi · Échap = désélectionner. Socles affichés à l'échelle du jeu (CONT_SCALE {CONT_SCALE}).
      </div>

      {/* Zone image */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 180px)', border: '1px solid #443a66', margin: '0 14px' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${imgDims.w} ${imgDims.h}`}
          style={{ width: imgDims.w * zoom, display: 'block', background: '#241245', cursor: 'crosshair' }}
          onClick={onSvgClick}
        >
          {imgUrl && (
            <image
              href={imgUrl} x={0} y={0} width={imgDims.w} height={imgDims.h}
              onLoad={(e) => {
                const el = e.currentTarget;
                // dimensions réelles du fichier chargé (image locale notamment)
                const probe = new Image();
                probe.onload = () => setImgDims((d) => (d.w === probe.naturalWidth && d.h === probe.naturalHeight ? d : { w: probe.naturalWidth, h: probe.naturalHeight }));
                probe.src = el.getAttribute('href');
              }}
            />
          )}

          {/* Socles / pion (sous les marqueurs) */}
          {showSocles && allCasePoints.map((p, i) => <Socle key={`s${i}`} p={p} />)}
          {showPawn && allCasePoints[0] && (
            <g style={{ pointerEvents: 'none' }}>
              <circle cx={allCasePoints[0].x} cy={allCasePoints[0].y} r={pawnR} fill="white" stroke="#c9472f" strokeWidth={5 / CONT_SCALE / 2} />
              <text x={allCasePoints[0].x} y={allCasePoints[0].y + 2} textAnchor="middle" dominantBaseline="central" fontSize={pawnR * 1.15}>🦁</text>
            </g>
          )}

          {/* Polyligne + marqueurs de la route */}
          {def.route.length > 1 && (
            <polyline
              points={def.route.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={ROUTE_COLOR} strokeWidth={3} strokeDasharray="8 8" opacity={0.8}
              style={{ pointerEvents: 'none' }}
            />
          )}
          {def.route.map((p, i) => {
            const isSel = selected?.kind === 'route' && selected.index === i;
            return (
              <g key={i}
                onPointerDown={(e) => startDrag(e, { kind: 'route', index: i })}
                onDoubleClick={(e) => removePoint(e, { kind: 'route', index: i })}
                style={{ cursor: 'grab' }}>
                {isSel && <circle cx={p.x} cy={p.y} r={20} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="5 4" />}
                <circle cx={p.x} cy={p.y} r={13} fill={ROUTE_COLOR} stroke={isSel ? '#fff' : '#111'} strokeWidth={isSel ? 3 : 2} />
                <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight="bold" fill="#111" style={{ pointerEvents: 'none' }}>{i + 1}</text>
              </g>
            );
          })}

          {/* Points uniques in/out/jin/jout */}
          {Object.entries(POINT_META).map(([k, m]) => def[k] && (
            <g key={k}
              onPointerDown={(e) => startDrag(e, { kind: 'point', key: k })}
              onDoubleClick={(e) => removePoint(e, { kind: 'point', key: k })}
              style={{ cursor: 'grab' }}>
              {selected?.kind === 'point' && selected.key === k && (
                <circle cx={def[k].x} cy={def[k].y} r={21} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="5 4" />
              )}
              <circle cx={def[k].x} cy={def[k].y} r={14} fill={m.color} stroke="#111" strokeWidth={2.5} opacity={0.95} />
              <text x={def[k].x} y={def[k].y - 20} textAnchor="middle" fontSize={20} fontWeight="bold" fill={m.color}
                style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#111', strokeWidth: 4 }}>{m.short}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Export / import */}
      <div style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="JSON exporté (ou colle une calibration ici puis « Charger »)"
          spellCheck={false}
          style={{ flex: 1, height: 130, background: '#120c22', color: '#9f9', border: '1px solid #443a66', borderRadius: 8, padding: 8, fontFamily: 'monospace', fontSize: 11 }}
        />
        <button onClick={importJson} style={btn(false)}>⬆ Charger ce JSON</button>
      </div>
    </div>
  );
}
