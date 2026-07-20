// Seed « Cris d'animaux » — volet BÊTES (mammifères, amphibiens, reptiles…).
// Complément du volet OISEAUX (seed-birds.mjs) : même cassette DURE `cris_animaux`
// (opt-in), mais tag t='Bête' → les deux volets COEXISTENT (delete ciblé par tag).
//
// Source AUDIO : iNaturalist (API observations, sons CC — cc0/cc-by/cc-by-sa/
// cc-by-nc). Wikidata (P51) est trop lacunaire pour les mammifères iconiques
// (tigre, éléphant, dauphin, baleine… absents), iNat les couvre tous.
// NB : les URLs iNat sont SIGNÉES/expirables (?timestamp) → rapatriement bucket
// obligatoire (NOM OPAQUE anti-triche), comme Deezer.
// → upload bucket `quete-questions` → insert quete_questions
// (subject='cris_animaux', audio=URL, t='Bête').
//
// Distracteurs FUTÉS : animaux du MÊME GROUPE d'abord (mammifères entre eux,
// amphibiens entre eux…), puis n'importe quel autre animal du pool.
//
// Idempotent : delete-then-insert CIBLÉ sur (subject='cris_animaux', t='Bête').
//   node scripts/seed-beasts.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'cris_animaux';
const BUCKET = 'quete-questions';
const TAG = 'Bête';
const UA = 'QueteDesMatieres-seed/1.0 (quiz éducatif; contact: enseignant)';
const MAX_BYTES = 12 * 1024 * 1024;
const INAT = 'https://api.inaturalist.org/v1';
const LICENSES = 'cc0,cc-by,cc-by-sa,cc-by-nc,cc-by-nc-sa';

// Animaux ICONIQUES au cri reconnaissable. [FR, nom scientifique, EN, groupe].
// Le `groupe` sert aux distracteurs (mêmes catégories entre elles d'abord).
const BEASTS = [
  ['Loup gris', 'Canis lupus', 'Gray Wolf', 'mammifere'],
  ['Lion', 'Panthera leo', 'Lion', 'mammifere'],
  ['Tigre', 'Panthera tigris', 'Tiger', 'mammifere'],
  ['Léopard', 'Panthera pardus', 'Leopard', 'mammifere'],
  ['Guépard', 'Acinonyx jubatus', 'Cheetah', 'mammifere'],
  ['Jaguar', 'Panthera onca', 'Jaguar', 'mammifere'],
  ['Éléphant de savane', 'Loxodonta africana', 'African Bush Elephant', 'mammifere'],
  ['Éléphant d’Asie', 'Elephas maximus', 'Asian Elephant', 'mammifere'],
  ['Ours brun', 'Ursus arctos', 'Brown Bear', 'mammifere'],
  ['Chimpanzé', 'Pan troglodytes', 'Chimpanzee', 'mammifere'],
  ['Gorille', 'Gorilla gorilla', 'Western Gorilla', 'mammifere'],
  ['Renard roux', 'Vulpes vulpes', 'Red Fox', 'mammifere'],
  ['Hyène tachetée', 'Crocuta crocuta', 'Spotted Hyena', 'mammifere'],
  ['Cerf élaphe', 'Cervus elaphus', 'Red Deer', 'mammifere'],
  ['Élan', 'Alces alces', 'Moose', 'mammifere'],
  ['Blaireau européen', 'Meles meles', 'European Badger', 'mammifere'],
  ['Marmotte alpine', 'Marmota marmota', 'Alpine Marmot', 'mammifere'],
  ['Sanglier', 'Sus scrofa', 'Wild Boar', 'mammifere'],
  ['Chat domestique', 'Felis catus', 'Domestic Cat', 'mammifere'],
  ['Cheval', 'Equus caballus', 'Horse', 'mammifere'],
  ['Vache', 'Bos taurus', 'Cattle', 'mammifere'],
  ['Mouton', 'Ovis aries', 'Sheep', 'mammifere'],
  ['Chèvre', 'Capra hircus', 'Goat', 'mammifere'],
  ['Âne', 'Equus asinus', 'Donkey', 'mammifere'],
  ['Zèbre des plaines', 'Equus quagga', 'Plains Zebra', 'mammifere'],
  ['Hippopotame', 'Hippopotamus amphibius', 'Hippopotamus', 'mammifere'],
  ['Chameau', 'Camelus dromedarius', 'Dromedary', 'mammifere'],
  ['Dauphin commun', 'Delphinus delphis', 'Common Dolphin', 'marin'],
  ['Grand dauphin', 'Tursiops truncatus', 'Bottlenose Dolphin', 'marin'],
  ['Baleine à bosse', 'Megaptera novaeangliae', 'Humpback Whale', 'marin'],
  ['Cachalot', 'Physeter macrocephalus', 'Sperm Whale', 'marin'],
  ['Phoque commun', 'Phoca vitulina', 'Harbor Seal', 'marin'],
  ['Otarie de Californie', 'Zalophus californianus', 'California Sea Lion', 'marin'],
  ['Grenouille rousse', 'Rana temporaria', 'Common Frog', 'amphibien'],
  ['Crapaud commun', 'Bufo bufo', 'Common Toad', 'amphibien'],
  ['Rainette verte', 'Hyla arborea', 'European Tree Frog', 'amphibien'],
  ['Ouaouaron', 'Lithobates catesbeianus', 'American Bullfrog', 'amphibien'],
  ['Alligator d’Amérique', 'Alligator mississippiensis', 'American Alligator', 'reptile'],
  ['Crocodile du Nil', 'Crocodylus niloticus', 'Nile Crocodile', 'reptile'],
  ['Coq domestique', 'Gallus gallus', 'Chicken', 'ferme'],
  ['Dindon sauvage', 'Meleagris gallopavo', 'Wild Turkey', 'ferme'],
  ['Cochon', 'Sus scrofa domesticus', 'Domestic Pig', 'ferme'],
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const fetchT = (url, opts = {}) => fetch(url, { headers: { 'User-Agent': UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000), ...opts });

async function fetchWithRetry(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const r = await fetchT(url);
    if (r.ok) return r;
    if ((r.status === 429 || r.status >= 500) && i < tries - 1) { await sleep(3000 * (i + 1)); continue; }
    throw new Error(`HTTP ${r.status}`);
  }
}

// iNaturalist : nom scientifique → taxon_id (espèce exacte).
async function taxonId(name) {
  const r = await fetchWithRetry(`${INAT}/taxa?q=${encodeURIComponent(name)}&rank=species&per_page=3`);
  const results = (await r.json()).results || [];
  // Match exact du nom scientifique si possible, sinon 1er résultat.
  const exact = results.find((t) => (t.name || '').toLowerCase() === name.toLowerCase());
  return (exact || results[0])?.id || null;
}

// Première observation du taxon comportant un son CC (triée par « votes » = qualité).
async function firstSound(tid) {
  const r = await fetchWithRetry(`${INAT}/observations?taxon_id=${tid}&sounds=true&license=${LICENSES}&per_page=8&order_by=votes&order=desc`);
  for (const o of (await r.json()).results || []) {
    for (const s of o.sounds || []) {
      if (s.file_url) return { url: s.file_url, ct: s.file_content_type || 'audio/mpeg', lic: o.license_code || 'cc' };
    }
  }
  return null;
}

const extFromCt = (ct) => {
  if (/mp4|m4a|aac/i.test(ct)) return 'm4a';
  if (/mpeg|mpga|mp3/i.test(ct)) return 'mp3';
  if (/wav/i.test(ct)) return 'wav';
  if (/ogg/i.test(ct)) return 'ogg';
  return 'mp3';
};

async function uploadAudio(fileUrl, ct) {
  const r = await fetchWithRetry(fileUrl);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`trop lourd (${Math.round(buf.length / 1e6)} Mo)`);
  if (buf.length < 2000) throw new Error('son vide');
  const realCt = r.headers.get('content-type') || ct;
  const ext = extFromCt(realCt);
  const path = `q-${randomUUID()}.${ext}`; // NOM OPAQUE
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: realCt, upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 3 distracteurs futés : MÊME groupe d'abord, puis tout le pool.
function pickDistractors(target, all) {
  const used = new Set([target[1]]);
  const take = (pool) => shuffle(pool.filter((b) => !used.has(b[1])));
  const sameGroup = all.filter((b) => b[3] === target[3]);
  const out = [];
  for (const tier of [take(sameGroup), take(all)]) {
    for (const b of tier) { if (out.length >= 3) break; if (used.has(b[1])) continue; used.add(b[1]); out.push(b); }
    if (out.length >= 3) break;
  }
  return out;
}

console.log(`→ iNaturalist : ${BEASTS.length} bêtes cibles.`);
const rows = [];
let ord = 0, failed = 0;
for (const beast of BEASTS) {
  const [fr, sci, en, group] = beast;
  let audio;
  try {
    const tid = await taxonId(sci);
    if (!tid) throw new Error('taxon introuvable');
    const snd = await firstSound(tid);
    if (!snd) throw new Error('pas de son CC');
    audio = await uploadAudio(snd.url, snd.ct);
    await sleep(1200); // courtoisie iNat (~1 req/s)
  } catch (e) { failed++; console.warn(`  ✗ ${fr} : ${e.message}`); continue; }

  const distractors = pickDistractors(beast, BEASTS);
  if (distractors.length < 3) { failed++; console.warn(`  ✗ ${fr} : distracteurs insuffisants`); continue; }
  const opts = shuffle([[fr, en], ...distractors.map(([f, , e]) => [f, e])]);
  const correcte = opts.findIndex(([f]) => f === fr) + 1;
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    q: 'Quel animal pousse ce cri ?', q_en: 'Which animal makes this call?',
    rep_a: opts[0][0], rep_b: opts[1][0], rep_c: opts[2][0], rep_d: opts[3][0],
    rep_a_en: opts[0][1], rep_b_en: opts[1][1], rep_c_en: opts[2][1], rep_d_en: opts[3][1],
    correcte,
    e: `C'est le cri du ${fr} (${sci}). Source : iNaturalist (CC).`,
    e_en: `It's the ${en} (${sci}). Source: iNaturalist (CC).`,
    audio,
  });
  console.log(`  ✓ ${fr}`);
}

console.log(`→ ${rows.length} questions prêtes (${failed} échecs). Remplacement en base (tag='${TAG}')…`);
// Suppression CIBLÉE par tag → préserve le volet OISEAUX (t='Oiseau') du même subject.
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT).eq('t', TAG); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « ${SUBJECT} » (t='${TAG}') insérées. Bucket='${BUCKET}' (noms opaques).`);
