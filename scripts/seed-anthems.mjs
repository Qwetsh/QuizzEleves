// Seed « Hymnes nationaux » (cassette DURE `hymnes_nationaux`, opt-in — TRÈS dur).
// Pour chaque pays disposant d'un enregistrement libre : une question à AUDIO où
// l'on entend l'hymne et où l'on choisit le bon pays parmi 4 (distracteurs futés).
//
// Pipeline : Wikidata SPARQL (P298 ISO3 → P85 hymne → P51 audio, fichier Commons)
//   + dataset mledoze/countries (noms FR/EN, région, sous-région, frontières pour
//   des distracteurs futés) → téléchargement du fichier Commons (CC/domaine public)
//   → upload bucket `quete-questions` (NOM OPAQUE anti-triche) → insert
//   quete_questions (subject='hymnes_nationaux', audio=URL, t='Hymne').
//
// Idempotent : delete-then-insert du subject 'hymnes_nationaux'. Anti-triche : nom
// de fichier aléatoire (jamais le nom du pays).
//
//   node scripts/seed-anthems.mjs [limit]
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'hymnes_nationaux';
const BUCKET = 'quete-questions';
const TAG = 'Hymne';
const LIMIT = Number(process.argv[2]) || Infinity;
const MAX_BYTES = 20 * 1024 * 1024; // on écarte les fichiers > 20 Mo (interprétations longues)
const UA = 'QueteDesMatieres-seed/1.0 (quiz éducatif; contact: enseignant)';

const DATA_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const SPARQL = 'https://query.wikidata.org/sparql';

// Pays « scolaires » bien connus (ISO3) — traités EN PRIORITÉ pour que, même si
// le rate-limit Commons interrompt le run, on ait d'abord les hymnes reconnaissables.
// (Le reste des pays disponibles suit ensuite.)
const WELL_KNOWN = [
  'FRA','USA','GBR','DEU','ITA','ESP','PRT','BEL','NLD','CHE','AUT','IRL','GRC',
  'POL','SWE','NOR','DNK','FIN','ISL','RUS','UKR','TUR','ROU','HUN','CZE','SVK',
  'HRV','SRB','BGR','CAN','MEX','BRA','ARG','CHL','COL','PER','VEN','CUB','URY',
  'BOL','ECU','PRY','CHN','JPN','KOR','PRK','IND','PAK','IDN','THA','VNM','PHL',
  'MYS','SGP','MMR','KHM','LKA','NPL','BGD','AUS','NZL','EGY','MAR','DZA','TUN',
  'ZAF','NGA','KEN','ETH','GHA','SEN','CIV','CMR','COD','TZA','UGA','SAU','ISR',
  'IRN','IRQ','SYR','JOR','LBN','ARE','QAT','KWT','YEM','AFG','KAZ','UZB','AZE',
  'GEO','ARM','MNG',
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const frName = (c) => c.translations?.fra?.common || c.name?.common || c.cca3;
const enName = (c) => c.name?.common || c.cca3;

// 3 distracteurs « futés » : voisins (frontières) → même sous-région → même région.
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

// 1) Dataset des pays (membres ONU) pour noms FR/EN + distracteurs.
console.log('→ Récupération des pays (mledoze/countries)…');
const resp = await fetch(DATA_URL);
if (!resp.ok) { console.error(`dataset HTTP ${resp.status}`); process.exit(1); }
let countries = (await resp.json()).filter((c) => c.unMember && c.cca2 && c.cca3);
const byCca3 = Object.fromEntries(countries.map((c) => [c.cca3, c]));
console.log(`  ${countries.length} pays.`);

// 2) Wikidata : ISO3 → URL du fichier audio de l'hymne (1er trouvé par pays).
console.log('→ Wikidata : hymnes (P85) → audio (P51)…');
const query = `SELECT ?iso3 ?audio WHERE {
  ?country wdt:P298 ?iso3 .
  ?country wdt:P85 ?anthem .
  ?anthem wdt:P51 ?audio .
}`;
const wres = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
  headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
});
if (!wres.ok) { console.error(`Wikidata HTTP ${wres.status}`); process.exit(1); }
const bindings = (await wres.json()).results.bindings;
const audioByIso3 = {};
for (const b of bindings) {
  const iso3 = b.iso3?.value; const audio = b.audio?.value;
  if (iso3 && audio && !audioByIso3[iso3]) audioByIso3[iso3] = audio;
}
console.log(`  ${Object.keys(audioByIso3).length} pays avec un hymne audio.`);

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
// Garde-fou générique : l'upload storage Supabase et le read du body n'ont pas de
// timeout natif → on borne via Promise.race (leçon « un fetch/upload sans timeout
// a gelé un seed »). En cas de dépassement on jette → le pays est simplement sauté.
const withTimeout = (p, ms, label) => Promise.race([p, sleep(ms).then(() => { throw new Error(`${label} timeout ${ms}ms`); })]);

// Télécharge depuis Commons avec retry sur 429 (respecte Retry-After, backoff long).
async function fetchWithRetry(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    let r;
    try { r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }); }
    catch (e) { if (i < tries - 1) { await sleep(3000 * (i + 1)); continue; } throw e; } // timeout/réseau → retry
    if (r.ok) return r;
    if (r.status === 429 && i < tries - 1) {
      const ra = Number(r.headers.get('retry-after')) || 0;
      await sleep(Math.max(ra * 1000, 5000 * (i + 1)));
      continue;
    }
    throw new Error(`audio HTTP ${r.status}`);
  }
}

async function uploadAudio(fileUrl) {
  const r = await fetchWithRetry(fileUrl);
  const len = Number(r.headers.get('content-length') || 0);
  if (len && len > MAX_BYTES) throw new Error(`trop lourd (${Math.round(len / 1e6)} Mo)`);
  const buf = Buffer.from(await withTimeout(r.arrayBuffer(), 45000, 'body'));
  if (buf.length > MAX_BYTES) throw new Error(`trop lourd (${Math.round(buf.length / 1e6)} Mo)`);
  const ct = r.headers.get('content-type') || 'audio/ogg';
  // Extension d'après le nom Commons (…/Special:FilePath/Nom.ogg), sinon content-type.
  const decoded = decodeURIComponent(fileUrl);
  const m = decoded.match(/\.([a-z0-9]{2,4})(?:$|\?)/i);
  const ext = (m ? m[1] : (ct.includes('mpeg') ? 'mp3' : 'ogg')).toLowerCase();
  const path = `q-${randomUUID()}.${ext}`; // NOM OPAQUE
  const { error } = await withTimeout(sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: true }), 60000, 'upload');
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 3) Construit les questions (upload de l'audio du bon pays uniquement).
// Insert INCRÉMENTAL (delete au début, flush par lots) : robuste au rate-limit
// Commons — même interrompu, ce qui est déjà téléchargé reste en base. Relancer
// reprend à zéro (delete) mais on peut aussi passer --keep pour cumuler.
const KEEP = process.argv.includes('--keep');
// Pays disponibles, TRIÉS : les bien connus d'abord (ordre WELL_KNOWN), puis le
// reste. Ainsi une limite basse (ou une interruption 429) garde les hymnes utiles.
const rank = new Map(WELL_KNOWN.map((iso, i) => [iso, i]));
const available = countries.filter((c) => audioByIso3[c.cca3]);
available.sort((a, b) => (rank.has(a.cca3) ? rank.get(a.cca3) : 1e6) - (rank.has(b.cca3) ? rank.get(b.cca3) : 1e6));
let targets = available.slice(0, LIMIT === Infinity ? undefined : LIMIT);
if (!KEEP) { const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT); if (error) { console.error('delete:', error.message); process.exit(1); } }
// Mode RESUME (--keep) : on SAUTE les pays déjà en base (repérés par le nom FR
// présent dans l'explication `e`), pour ne pas ré-uploader de doublons. Ainsi une
// relance --keep complète le pool là où un run précédent s'est arrêté.
if (KEEP) {
  const { data: existing } = await sb.from('quete_questions').select('e').eq('subject', SUBJECT).limit(500);
  const done = new Set((existing || []).map((r) => (r.e || '').replace("C'est l'hymne de ", '').replace(/\.$/, '')));
  const before = targets.length;
  targets = targets.filter((c) => !done.has(frName(c)));
  console.log(`  (resume) ${done.size} déjà en base, ${before - targets.length} sautés.`);
}
console.log(`→ ${targets.length} pays cibles. Insert incrémental${KEEP ? ' (cumul --keep)' : ' (remplacement)'}…`);

let buffer = [];
let ord = 0, failed = 0, inserted = 0;
async function flush() {
  if (!buffer.length) return;
  const { error } = await sb.from('quete_questions').insert(buffer);
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += buffer.length; buffer = [];
  console.log(`  💾 ${inserted} en base`);
}

for (const c of targets) {
  const distractors = pickDistractors(c, countries, byCca3);
  if (distractors.length < 3) { failed++; console.warn(`  ✗ ${frName(c)} : distracteurs insuffisants`); continue; }
  let audio;
  try { audio = await uploadAudio(audioByIso3[c.cca3]); await sleep(1200); } // throttle anti-429
  catch (e) { failed++; console.warn(`  ✗ ${frName(c)} : ${e.message}`); continue; }

  const choices = shuffle([c, ...distractors]);
  const correcte = choices.findIndex((x) => x.cca3 === c.cca3) + 1;
  buffer.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    q: 'De quel pays entend-on l’hymne national ?',
    q_en: "Which country's national anthem is this?",
    rep_a: frName(choices[0]), rep_b: frName(choices[1]), rep_c: frName(choices[2]), rep_d: frName(choices[3]),
    rep_a_en: enName(choices[0]), rep_b_en: enName(choices[1]), rep_c_en: enName(choices[2]), rep_d_en: enName(choices[3]),
    correcte, e: `C'est l'hymne de ${frName(c)}.`, e_en: `This is the anthem of ${enName(c)}.`, audio,
  });
  console.log(`  ✓ ${frName(c)}`);
  if (buffer.length >= 10) await flush();
}
await flush();
console.log(`✓ ${inserted} questions « ${SUBJECT} » insérées (${failed} échecs). Tag='${TAG}'. Bucket='${BUCKET}'.`);
