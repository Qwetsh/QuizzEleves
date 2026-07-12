// Seed « Gastronomie » — enrichit le thème EXISTANT `gastronomie_cuisine` avec des
// questions à IMAGE « De quel pays vient ce plat ? » (4 pays au choix).
//
// Source : TheMealDB (clé de test publique '1'). On demande le PAYS D'ORIGINE
// (strArea) plutôt que le nom du plat (souvent en anglais). Photo RÉ-HÉBERGÉE
// dans le bucket (nom opaque). Distracteurs = autres cuisines.
//
// Idempotent CIBLÉ : delete-then-insert sur (subject='gastronomie_cuisine',
// t='Plat').
//   node scripts/seed-mealdb.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'gastronomie_cuisine';
const BUCKET = 'quete-questions';
const TAG = 'Plat';
const MEALDB = 'https://www.themealdb.com/api/json/v1/1';
const MAX = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// strArea (TheMealDB, EN) → { pays FR, pays EN }. On ignore les zones ambiguës.
const AREA = {
  American: ['États-Unis', 'United States'], British: ['Royaume-Uni', 'United Kingdom'],
  Canadian: ['Canada', 'Canada'], Chinese: ['Chine', 'China'], Croatian: ['Croatie', 'Croatia'],
  Dutch: ['Pays-Bas', 'Netherlands'], Egyptian: ['Égypte', 'Egypt'], Filipino: ['Philippines', 'Philippines'],
  French: ['France', 'France'], Greek: ['Grèce', 'Greece'], Indian: ['Inde', 'India'],
  Irish: ['Irlande', 'Ireland'], Italian: ['Italie', 'Italy'], Jamaican: ['Jamaïque', 'Jamaica'],
  Japanese: ['Japon', 'Japan'], Kenyan: ['Kenya', 'Kenya'], Malaysian: ['Malaisie', 'Malaysia'],
  Mexican: ['Mexique', 'Mexico'], Moroccan: ['Maroc', 'Morocco'], Polish: ['Pologne', 'Poland'],
  Portuguese: ['Portugal', 'Portugal'], Russian: ['Russie', 'Russia'], Spanish: ['Espagne', 'Spain'],
  Thai: ['Thaïlande', 'Thailand'], Tunisian: ['Tunisie', 'Tunisia'], Turkish: ['Turquie', 'Turkey'],
  Ukrainian: ['Ukraine', 'Ukraine'], Vietnamese: ['Vietnam', 'Vietnam'],
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

// 1) Collecte des plats (par lettre a-z), gardés si zone connue + photo.
console.log('→ TheMealDB : collecte des plats (a-z)…');
const meals = [];
const seen = new Set();
for (const c of 'abcdefghijklmnopqrstuvwxyz') {
  try {
    const j = await getJSON(`${MEALDB}/search.php?f=${c}`);
    for (const m of j.meals || []) {
      if (!AREA[m.strArea] || !m.strMealThumb || seen.has(m.idMeal)) continue;
      seen.add(m.idMeal);
      meals.push({ id: m.idMeal, name: m.strMeal, area: m.strArea, thumb: m.strMealThumb });
    }
  } catch { /* lettre sans résultat */ }
  await sleep(120);
}
const picked = shuffle(meals).slice(0, MAX);
console.log(`  ${meals.length} plats connus, ${picked.length} retenus.`);

async function uploadImage(imgUrl) {
  const r = await fetch(imgUrl);
  if (!r.ok) throw new Error(`img HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const path = `q-${randomUUID()}.jpg`; // NOM OPAQUE
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const allAreas = Object.keys(AREA);
const rows = [];
let ord = 0, failed = 0;
for (const m of picked) {
  let img;
  try { img = await uploadImage(m.thumb); await sleep(80); }
  catch (e) { failed++; console.warn(`  ✗ ${m.name} : ${e.message}`); continue; }
  const [frCountry, enCountry] = AREA[m.area];
  const distrAreas = shuffle(allAreas.filter((a) => a !== m.area)).slice(0, 3);
  const optFr = shuffle([frCountry, ...distrAreas.map((a) => AREA[a][0])]);
  const correcte = optFr.indexOf(frCountry) + 1;
  // Réponses EN alignées sur l'ordre FR.
  const frToEn = Object.fromEntries(Object.values(AREA));
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    q: 'De quel pays est originaire ce plat ?', q_en: 'Which country does this dish come from?',
    rep_a: optFr[0], rep_b: optFr[1], rep_c: optFr[2], rep_d: optFr[3],
    rep_a_en: frToEn[optFr[0]], rep_b_en: frToEn[optFr[1]], rep_c_en: frToEn[optFr[2]], rep_d_en: frToEn[optFr[3]],
    correcte,
    e: `« ${m.name} » — cuisine ${frCountry}.`, e_en: `"${m.name}" — ${enCountry} cuisine.`,
    img,
  });
  console.log(`  ✓ ${m.name} (${frCountry})`);
}

console.log(`→ ${rows.length} questions prêtes (${failed} échecs). Remplacement ciblé (t='${TAG}')…`);
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT).eq('t', TAG); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « ${TAG} » ajoutées à ${SUBJECT}. Bucket='${BUCKET}' (noms opaques).`);
