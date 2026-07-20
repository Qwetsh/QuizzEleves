// Seed « Cris d'animaux » — volet OISEAUX (cassette DURE `cris_animaux`, opt-in).
// Pour une liste curée d'oiseaux communs : une question à AUDIO où l'on entend le
// chant et où l'on choisit le bon oiseau parmi 4.
//
// Source AUDIO : Wikidata (P225 nom scientifique → P51 audio) = fichier Wikimedia
// Commons (CC / domaine public, RÉ-HÉBERGEABLE). Noms FR curés à la main.
// NB : xeno-canto API v2 supprimée / v3 exige une clé → on passe par Commons.
// → upload bucket `quete-questions` (NOM OPAQUE) → insert quete_questions
// (subject='cris_animaux', audio=URL, t='Oiseau').
//
// Idempotent : delete-then-insert du subject 'cris_animaux'.
//   node scripts/seed-birds.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'cris_animaux';
const BUCKET = 'quete-questions';
const TAG = 'Oiseau';
const UA = 'QueteDesMatieres-seed/1.0 (quiz éducatif; contact: enseignant)';
const MAX_BYTES = 12 * 1024 * 1024;
const SPARQL = 'https://query.wikidata.org/sparql';

// Oiseaux communs (FR curé + nom scientifique + nom EN).
const BIRDS = [
  ['Rossignol philomèle', 'Luscinia megarhynchos', 'Common Nightingale'],
  ['Merle noir', 'Turdus merula', 'Common Blackbird'],
  ['Coucou gris', 'Cuculus canorus', 'Common Cuckoo'],
  ['Mésange charbonnière', 'Parus major', 'Great Tit'],
  ['Pinson des arbres', 'Fringilla coelebs', 'Common Chaffinch'],
  ['Chouette hulotte', 'Strix aluco', 'Tawny Owl'],
  ['Pic vert', 'Picus viridis', 'European Green Woodpecker'],
  ['Grand corbeau', 'Corvus corax', 'Northern Raven'],
  ['Pie bavarde', 'Pica pica', 'Eurasian Magpie'],
  ['Hibou grand-duc', 'Bubo bubo', 'Eurasian Eagle-Owl'],
  ['Rouge-gorge familier', 'Erithacus rubecula', 'European Robin'],
  ['Moineau domestique', 'Passer domesticus', 'House Sparrow'],
  ['Hirondelle rustique', 'Hirundo rustica', 'Barn Swallow'],
  ['Alouette des champs', 'Alauda arvensis', 'Eurasian Skylark'],
  ['Canard colvert', 'Anas platyrhynchos', 'Mallard'],
  ['Tourterelle turque', 'Streptopelia decaocto', 'Eurasian Collared Dove'],
  ['Mouette rieuse', 'Chroicocephalus ridibundus', 'Black-headed Gull'],
  ['Buse variable', 'Buteo buteo', 'Common Buzzard'],
  ['Faucon crécerelle', 'Falco tinnunculus', 'Common Kestrel'],
  ['Geai des chênes', 'Garrulus glandarius', 'Eurasian Jay'],
  ['Étourneau sansonnet', 'Sturnus vulgaris', 'Common Starling'],
  ['Grive musicienne', 'Turdus philomelos', 'Song Thrush'],
  ["Loriot d'Europe", 'Oriolus oriolus', 'Eurasian Golden Oriole'],
  ['Huppe fasciée', 'Upupa epops', 'Eurasian Hoopoe'],
  ['Martinet noir', 'Apus apus', 'Common Swift'],
  ['Chardonneret élégant', 'Carduelis carduelis', 'European Goldfinch'],
  ['Rougequeue noir', 'Phoenicurus ochruros', 'Black Redstart'],
  ['Fauvette à tête noire', 'Sylvia atricapilla', 'Eurasian Blackcap'],
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
// Garde-fou : l'upload Supabase n'a pas d'AbortSignal → on borne via Promise.race
// (leçon « fetch sans timeout a gelé un seed » — l'upload storage peut geler aussi).
const withTimeout = (p, ms, label) => Promise.race([p, sleep(ms).then(() => { throw new Error(`${label} timeout ${ms}ms`); })]);

// Télécharge depuis Commons avec retry sur 429 (rate-limit) : respecte Retry-After
// et applique un backoff long (l'IP peut être en « pénalité » quelques dizaines de s).
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
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`trop lourd (${Math.round(buf.length / 1e6)} Mo)`);
  const ct = r.headers.get('content-type') || 'audio/ogg';
  const decoded = decodeURIComponent(fileUrl);
  const ext = (decoded.match(/\.([a-z0-9]{2,4})(?:$|\?)/i)?.[1] || (ct.includes('mpeg') ? 'mp3' : 'ogg')).toLowerCase();
  const path = `q-${randomUUID()}.${ext}`; // NOM OPAQUE
  const { error } = await withTimeout(sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: true }), 60000, 'upload');
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 1) Wikidata : nom scientifique → URL du fichier audio (Commons).
console.log('→ Wikidata : chants d’oiseaux (P225 → P51)…');
const values = BIRDS.map(([, s]) => `"${s}"`).join(' ');
const query = `SELECT ?sci ?audio WHERE { VALUES ?sci { ${values} } ?taxon wdt:P225 ?sci . ?taxon wdt:P51 ?audio . }`;
const wres = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
  headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
});
if (!wres.ok) { console.error(`Wikidata HTTP ${wres.status}`); process.exit(1); }
const audioBySci = {};
for (const b of (await wres.json()).results.bindings) {
  if (!audioBySci[b.sci.value]) audioBySci[b.sci.value] = b.audio.value;
}
console.log(`  ${Object.keys(audioBySci).length}/${BIRDS.length} oiseaux avec audio.`);

// 2) Construit les questions (upload de l'audio du bon oiseau uniquement).
const rows = [];
let ord = 0, failed = 0;
for (const [fr, sci, en] of BIRDS) {
  const src = audioBySci[sci];
  if (!src) { failed++; console.warn(`  ✗ ${fr} : pas d'audio`); continue; }
  let audio;
  try { audio = await uploadAudio(src); await sleep(1500); } // throttle anti-429 Commons
  catch (e) { failed++; console.warn(`  ✗ ${fr} : ${e.message}`); continue; }

  const distractors = shuffle(BIRDS.filter(([, s]) => s !== sci)).slice(0, 3);
  const opts = shuffle([[fr, en], ...distractors.map(([f, , e]) => [f, e])]);
  const correcte = opts.findIndex(([f]) => f === fr) + 1;
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    q: 'Quel oiseau chante ainsi ?', q_en: 'Which bird sings like this?',
    rep_a: opts[0][0], rep_b: opts[1][0], rep_c: opts[2][0], rep_d: opts[3][0],
    rep_a_en: opts[0][1], rep_b_en: opts[1][1], rep_c_en: opts[2][1], rep_d_en: opts[3][1],
    correcte,
    e: `C'est le ${fr} (${sci}). Source : Wikimedia Commons.`,
    e_en: `It's the ${en} (${sci}). Source: Wikimedia Commons.`,
    audio,
  });
  console.log(`  ✓ ${fr}`);
}

console.log(`→ ${rows.length} questions prêtes (${failed} échecs). Remplacement en base…`);
// Suppression CIBLÉE par tag (t='Oiseau') pour ne PAS écraser le volet mammifères
// (t='Bête', seed-beasts.mjs) qui partage le même subject 'cris_animaux'.
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT).eq('t', TAG); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « ${SUBJECT} » insérées. Tag='${TAG}'. Bucket='${BUCKET}' (noms opaques).`);
