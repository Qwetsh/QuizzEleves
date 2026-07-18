// Fonctions PURES du pipeline Curioscope (parsées/testées sans réseau ni sharp).

// Continent uiMapID → univers Curioscope. L'addon CurioSnap enregistre cont
// via C_Map ; Classic Era et Retail n'utilisent pas les mêmes uiMapIDs.
export const CONTINENT_UNIVERSES = {
  1414: 'wow_kalimdor',      // Clients classic-line (Era, Anniversary/TBC…)
  1415: 'wow_royaumes_est',
  1945: 'wow_outremonde',    // Outland (Anniversary/TBC) — univers à créer le jour où on veut la carte
  12: 'wow_kalimdor',        // Retail
  13: 'wow_royaumes_est',
};

/**
 * Parse le SavedVariables `CurioSnap.lua` (table plate de tables plates).
 * Retourne [{ t, map, zone, x, y, cont?, contName?, cx?, cy? }, ...].
 */
export function parseSavedVariables(luaText) {
  const entries = [];
  const blockRe = /\{([^{}]*)\}/g;
  let m;
  while ((m = blockRe.exec(luaText))) {
    const kv = {};
    const kvRe = /\["(\w+)"\]\s*=\s*(?:"((?:[^"\\]|\\.)*)"|(-?[\d.]+))/g;
    let k;
    while ((k = kvRe.exec(m[1]))) {
      kv[k[1]] = k[2] !== undefined ? k[2].replace(/\\(.)/g, '$1') : Number(k[3]);
    }
    if (kv.t && kv.map != null) entries.push(kv);
  }
  return entries;
}

// --- CSV « spots.csv » (séparateur ;) --------------------------------------
export const CSV_COLUMNS = ['fichier', 't', 'universe', 'cont', 'zone', 'map', 'x_zone', 'y_zone', 'cx', 'cy', 'label', 'difficulte', 'actif'];

export function toCsv(rows) {
  const lines = [CSV_COLUMNS.join(';')];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => r[c] ?? '').join(';'));
  return lines.join('\n') + '\n';
}

export function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const cols = lines[0].split(';').map((c) => c.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(';');
    const row = {};
    cols.forEach((c, i) => { row[c] = (cells[i] ?? '').trim(); });
    return row;
  });
}

// Horodatage CurioSnap/WoWScrnShot « MMJJAA_HHMMSS » → secondes comparables.
export function tToSeconds(t) {
  const m = String(t).match(/^(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return Date.UTC(2000 + +m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]) / 1000;
}

/**
 * Entrées SavedVariables + fichiers images disponibles → lignes CSV.
 * `imagesByT` : Map t → nom de fichier (WoWScrnShot_<t>.jpg).
 * Appariement TOLÉRANT (±2 s) : l'addon horodate à l'événement
 * SCREENSHOT_SUCCEEDED, parfois une seconde APRÈS le nommage du fichier.
 * Chaque image n'est servie qu'une fois (au journal le plus proche) — les
 * doublons d'événement restent non appariés → actif=0.
 */
export function entriesToRows(entries, imagesByT, toleranceSec = 2) {
  const imgs = [...imagesByT.entries()]
    .map(([t, f]) => ({ f, s: tToSeconds(t), used: false }))
    .filter((i) => i.s != null);
  const fileFor = (t) => {
    const s = tToSeconds(t);
    if (s == null) return '';
    let best = null;
    for (const i of imgs) {
      if (i.used) continue;
      const d = Math.abs(i.s - s);
      if (d <= toleranceSec && (!best || d < best.d)) best = { i, d };
    }
    if (!best) return '';
    best.i.used = true;
    return best.i.f;
  };
  return entries.map((e) => {
    const universe = CONTINENT_UNIVERSES[e.cont] || '';
    const fichier = fileFor(e.t);
    const ok = fichier && universe && e.cx != null && e.cy != null;
    return {
      fichier, t: e.t, universe, cont: e.cont ?? '', zone: e.zone ?? '',
      map: e.map ?? '', x_zone: e.x ?? '', y_zone: e.y ?? '',
      cx: e.cx ?? '', cy: e.cy ?? '',
      label: e.zone ?? '', difficulte: 3, actif: ok ? 1 : 0,
    };
  });
}

/**
 * Fusion : conserve les lignes déjà présentes (labels/difficulté édités à la
 * main), ajoute seulement les captures nouvelles (clé = t).
 */
export function mergeRows(existing, fresh) {
  const seen = new Set(existing.map((r) => r.t));
  return [...existing, ...fresh.filter((r) => !seen.has(r.t))];
}

// Calibration affine optionnelle par univers (si la carte-image n'est pas
// exactement l'art uiMap du jeu) : cx' = ax·cx + bx, cy' = ay·cy + by.
export function applyCalib(cx, cy, calib) {
  if (!calib) return { cx, cy };
  const c = { ax: 1, bx: 0, ay: 1, by: 0, ...calib };
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return { cx: clamp(c.ax * cx + c.bx), cy: clamp(c.ay * cy + c.by) };
}
