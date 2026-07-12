// Seed « Silhouettes de pays » (cassette DURE `silhouettes_pays`, opt-in).
// Pour chaque pays : une question à IMAGE où l'on voit la SILHOUETTE NOIRE du pays
// (SVG généré depuis ses contours) et où l'on choisit le bon pays parmi 4.
//
// Source formes : GeoJSON public (johan/world.geo.json, id = ISO3). Noms FR +
// régions (distracteurs futés) : mledoze/countries. La silhouette est un SVG NOIR
// généré ici (projection équirectangulaire corrigée en longitude, cadrée sur le
// pays, antiméridien géré, contours décimés) → upload bucket (nom opaque).
// render='silhouette' : la forme est déjà noire (affichée telle quelle), mais on
// réutilise le mode pour le jingle + le « pop » à la révélation.
//
// Idempotent : delete-then-insert du subject 'silhouettes_pays'.
//   node scripts/seed-country-shapes.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'silhouettes_pays';
const BUCKET = 'quete-questions';
const TAG = 'Silhouette';
const W = 480, H = 360, PAD = 18;
const GEO = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
const DATA = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const frName = (c) => c.translations?.fra?.common || c.name?.common || c.cca3;
const enName = (c) => c.name?.common || c.cca3;

function pickDistractors(target, all, byCca3) {
  const used = new Set([target.cca3]);
  const take = (pool) => shuffle(pool.filter((c) => !used.has(c.cca3)));
  const neighbors = (target.borders || []).map((code) => byCca3[code]).filter(Boolean);
  const sameSub = all.filter((c) => c.subregion && c.subregion === target.subregion);
  const sameReg = all.filter((c) => c.region && c.region === target.region);
  const out = [];
  for (const tier of [take(neighbors), take(sameSub), take(sameReg), take(all)]) {
    for (const c of tier) { if (out.length >= 3) break; if (used.has(c.cca3)) continue; used.add(c.cca3); out.push(c); }
    if (out.length >= 3) break;
  }
  return out;
}

// --- Génération de la silhouette SVG à partir de la géométrie GeoJSON ---
// Renvoie les « anneaux » (listes de [lon,lat]) d'une géométrie Polygon/MultiPolygon.
function ringsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}
const bbox = (pts) => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);

function buildSvg(geom) {
  let rings = ringsOf(geom).map((r) => r.map(([lon, lat]) => [lon, lat]));
  if (!rings.length) return null;
  // Antiméridien : si l'étendue en longitude dépasse 180°, on remappe lon<0 → +360.
  const allLon = rings.flat().map((p) => p[0]);
  if (Math.max(...allLon) - Math.min(...allLon) > 180) {
    rings = rings.map((r) => r.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]));
  }
  // Écarte les îlots minuscules/lointains (bbox < 2 % de la plus grande) pour ne
  // pas ruiner le cadrage, mais garder les archipels (îles comparables).
  const areas = rings.map((r) => { const [a, b, c, d] = bbox(r); return (c - a) * (d - b); });
  const maxA = Math.max(...areas);
  rings = rings.filter((_, i) => areas[i] >= 0.02 * maxA);
  // Décimation des contours très détaillés (cap ~600 points/anneau).
  rings = rings.map((r) => { const step = Math.ceil(r.length / 600); return step > 1 ? r.filter((_, i) => i % step === 0) : r; });

  const [minLon, minLat, maxLon, maxLat] = bbox(rings.flat());
  const midLat = ((minLat + maxLat) / 2) * Math.PI / 180;
  const kx = Math.cos(midLat) || 0.5; // corrige l'étirement horizontal
  const proj = ([lon, lat]) => [lon * kx, -lat];
  const pr = rings.map((r) => r.map(proj));
  const [pMinX, pMinY, pMaxX, pMaxY] = bbox(pr.flat());
  const scale = Math.min((W - 2 * PAD) / (pMaxX - pMinX || 1), (H - 2 * PAD) / (pMaxY - pMinY || 1));
  const ox = (W - (pMaxX - pMinX) * scale) / 2 - pMinX * scale;
  const oy = (H - (pMaxY - pMinY) * scale) / 2 - pMinY * scale;
  const T = ([x, y]) => [(x * scale + ox).toFixed(1), (y * scale + oy).toFixed(1)];

  const d = pr.map((r) => 'M' + r.map((p, i) => { const [x, y] = T(p); return `${i ? 'L' : ''}${x} ${y}`; }).join(' ') + 'Z').join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="#000000" fill-rule="evenodd"/></svg>`;
}

async function uploadSvg(svg) {
  const path = `q-${randomUUID()}.svg`; // NOM OPAQUE (le SVG ne contient que des coordonnées)
  const { error } = await sb.storage.from(BUCKET).upload(path, Buffer.from(svg), { contentType: 'image/svg+xml', upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 1) Données.
console.log('→ Récupération GeoJSON + noms de pays…');
const [geo, countries] = await Promise.all([
  fetch(GEO).then((r) => r.json()),
  fetch(DATA).then((r) => r.json()).then((all) => all.filter((c) => c.unMember && c.cca3)),
]);
const byCca3 = Object.fromEntries(countries.map((c) => [c.cca3, c]));
console.log(`  ${geo.features.length} formes, ${countries.length} pays.`);

// 2) Une silhouette par pays membre de l'ONU (avec géométrie et nom FR).
const rows = [];
let ord = 0, failed = 0;
for (const f of geo.features) {
  const c = byCca3[f.id];
  if (!c) continue; // territoire hors ONU / non reconnu
  let svg;
  try { svg = buildSvg(f.geometry); if (!svg) throw new Error('géométrie vide'); }
  catch (e) { failed++; console.warn(`  ✗ ${f.id} : ${e.message}`); continue; }
  let img;
  try { img = await uploadSvg(svg); }
  catch (e) { failed++; console.warn(`  ✗ ${frName(c)} : ${e.message}`); continue; }

  const distractors = pickDistractors(c, countries, byCca3);
  if (distractors.length < 3) { failed++; continue; }
  const choices = shuffle([c, ...distractors]);
  const correcte = choices.findIndex((x) => x.cca3 === c.cca3) + 1;
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    render: 'silhouette',
    q: 'Quel est ce pays ?', q_en: 'Which country is this?',
    rep_a: frName(choices[0]), rep_b: frName(choices[1]), rep_c: frName(choices[2]), rep_d: frName(choices[3]),
    rep_a_en: enName(choices[0]), rep_b_en: enName(choices[1]), rep_c_en: enName(choices[2]), rep_d_en: enName(choices[3]),
    correcte, e: `C'est ${frName(c)}.`, e_en: `It's ${enName(c)}.`, img,
  });
  if (ord % 30 === 0) console.log(`  … ${ord} silhouettes`);
}

console.log(`→ ${rows.length} questions prêtes (${failed} échecs). Remplacement en base…`);
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « ${SUBJECT} » insérées. Rendu='silhouette', Tag='${TAG}'. Bucket='${BUCKET}'.`);
