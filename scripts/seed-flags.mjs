// Seed des questions « Drapeaux & symboles » (matière forcé-only `drapeaux`).
// Pour CHAQUE pays (membres de l'ONU), crée DEUX styles de question :
//   A) identifier le PAYS d'après le drapeau (image sur l'énoncé, 4 pays en texte) ;
//   B) choisir le bon DRAPEAU parmi 4 (images sur les réponses, sans texte).
// Les 3 distracteurs sont CHOISIS FUTÉS (voisins d'abord, puis même sous-région,
// puis même région) pour augmenter le challenge.
//
// Pipeline : dataset public mledoze/countries (noms FR/EN, région, sous-région,
//   frontières, unMember ; restcountries v3.1 est déprécié) + drapeau PNG via
//   flagcdn (code ISO alpha-2) → upload bucket `quete-questions` (NOM OPAQUE
//   anti-triche) → insert quete_questions (subject='drapeaux_symboles', img=URL,
//   t='Drapeau'). Le thème sélectionnable « Drapeaux & symboles » surface ces
//   questions à image AUX CÔTÉS de ses questions texte de culture G.
//
// Idempotent : delete-then-insert CIBLÉ sur (subject='drapeaux_symboles', t='Drapeau')
// — n'écrase QUE nos lignes drapeau, préserve les questions texte du même thème.
// Anti-triche : le nom de fichier dans le bucket est aléatoire (jamais le code
// pays), sinon l'URL trahit la réponse (visible devtools / mobile).
//
//   node scripts/seed-flags.mjs [limit] [style]
//     limit = nb de pays (défaut tous) ; style = both | country | flag (défaut both)
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Les questions à image de drapeaux sont fusionnées dans le THÈME sélectionnable
// `drapeaux_symboles` (pool culture-G) : choisir ce thème fait tomber les drapeaux.
const SUBJECT = 'drapeaux_symboles';
const BUCKET = 'quete-questions';
const TAG = 'Drapeau';
const LIMIT = Number(process.argv[2]) || Infinity;

const DATA_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const flagUrl = (cca2) => `https://flagcdn.com/w320/${cca2.toLowerCase()}.png`;

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const frName = (c) => c.translations?.fra?.common || c.name?.common || c.cca3;
const enName = (c) => c.name?.common || c.cca3;

// 3 distracteurs « futés » : d'abord les voisins (frontières), puis les pays de la
// même sous-région, puis de la même région, enfin n'importe quel autre pays.
function pickDistractors(target, all, byCca3) {
  const used = new Set([target.cca3]);
  const take = (pool) => shuffle(pool.filter((c) => !used.has(c.cca3)));
  const neighbors = (target.borders || []).map((code) => byCca3[code]).filter(Boolean);
  const sameSub = all.filter((c) => c.subregion && c.subregion === target.subregion);
  const sameReg = all.filter((c) => c.region && c.region === target.region);
  const tiers = [take(neighbors), take(sameSub), take(sameReg), take(all)];
  const out = [];
  for (const tier of tiers) {
    for (const c of tier) {
      if (out.length >= 3) break;
      if (used.has(c.cca3)) continue;
      used.add(c.cca3); out.push(c);
    }
    if (out.length >= 3) break;
  }
  return out;
}

async function fetchFlagBuffer(pngUrl) {
  const r = await fetch(pngUrl);
  if (!r.ok) throw new Error(`flag HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || 'image/png';
  return { buf: Buffer.from(await r.arrayBuffer()), ct, ext: ct.includes('svg') ? 'svg' : 'png' };
}

async function uploadFlag(buf, ct, ext) {
  const path = `q-${randomUUID()}.${ext}`; // NOM OPAQUE (jamais le code pays)
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

console.log('→ Récupération des pays (mledoze/countries)…');
const resp = await fetch(DATA_URL);
if (!resp.ok) { console.error(`dataset HTTP ${resp.status}`); process.exit(1); }
let countries = await resp.json();
// On garde les membres de l'ONU (≈193 pays « scolaires ») avec un code ISO.
countries = countries.filter((c) => c.unMember && c.cca2 && c.cca3);
const byCca3 = Object.fromEntries(countries.map((c) => [c.cca3, c]));
console.log(`  ${countries.length} pays retenus (membres ONU avec drapeau).`);

const targets = countries.slice(0, LIMIT === Infinity ? countries.length : LIMIT);

// STYLE : 'both' (défaut), 'country' (identifier le pays), 'flag' (choisir le drapeau).
const STYLE = (process.argv[3] || 'both').toLowerCase();
const wantCountry = STYLE === 'both' || STYLE === 'country';
const wantFlag = STYLE === 'both' || STYLE === 'flag';

// Chaque drapeau n'est uploadé QU'UNE FOIS (réutilisé comme énoncé ET comme option
// de réponse). Cache cca3 → URL publique (null si échec). Nom de fichier opaque.
const flagCache = {};
async function getFlag(c) {
  if (c.cca3 in flagCache) return flagCache[c.cca3];
  try {
    const { buf, ct, ext } = await fetchFlagBuffer(flagUrl(c.cca2));
    flagCache[c.cca3] = await uploadFlag(buf, ct, ext);
  } catch (e) { flagCache[c.cca3] = null; console.warn(`  ✗ drapeau ${frName(c)} : ${e.message}`); }
  return flagCache[c.cca3];
}

const rows = [];
let ord = 0, failed = 0, done = 0;
for (const c of targets) {
  const distractors = pickDistractors(c, countries, byCca3);
  if (distractors.length < 3) { failed++; console.warn(`  ✗ ${frName(c)} : pas assez de distracteurs`); continue; }
  const choices = shuffle([c, ...distractors]);
  const correcte = choices.findIndex((x) => x.cca3 === c.cca3) + 1;

  // Style A — identifier le PAYS d'après le drapeau (image sur l'énoncé).
  if (wantCountry) {
    const img = await getFlag(c);
    if (img) rows.push({
      pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
      q: 'Quel pays possède ce drapeau ?',
      q_en: 'Which country does this flag belong to?',
      rep_a: frName(choices[0]), rep_b: frName(choices[1]), rep_c: frName(choices[2]), rep_d: frName(choices[3]),
      rep_a_en: enName(choices[0]), rep_b_en: enName(choices[1]), rep_c_en: enName(choices[2]), rep_d_en: enName(choices[3]),
      correcte, e: `Bonne réponse : ${frName(c)}.`, e_en: `Correct answer: ${enName(c)}.`, img,
    });
  }

  // Style B — choisir le bon DRAPEAU parmi 4 (images sur les réponses, sans texte).
  if (wantFlag) {
    const flags = await Promise.all(choices.map(getFlag));
    if (flags.every(Boolean)) rows.push({
      pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
      q: `Retrouve le drapeau de ce pays : ${frName(c)}`,
      q_en: `Find this country's flag: ${enName(c)}`,
      rep_a: '', rep_b: '', rep_c: '', rep_d: '', // réponses image-only (pas de texte)
      rep_a_img: flags[0], rep_b_img: flags[1], rep_c_img: flags[2], rep_d_img: flags[3],
      correcte, e: `Bonne réponse : ${frName(c)}.`, e_en: `Correct answer: ${enName(c)}.`, img: null,
    });
  }

  if (++done % 20 === 0) console.log(`  … ${done}/${targets.length} pays`);
}

console.log(`→ ${rows.length} questions prêtes (${failed} échecs). Remplacement en base…`);
// Suppression CIBLÉE : uniquement NOS lignes drapeau (tag TAG='Drapeau'), pour ne
// PAS effacer les autres questions texte du thème `drapeaux_symboles` (culture-G).
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT).eq('t', TAG); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « ${SUBJECT} » insérées. Tag='${TAG}'. Bucket='${BUCKET}' (noms opaques).`);
