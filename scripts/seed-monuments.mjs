// Seed « Monuments » — enrichit le thème EXISTANT `villes_monuments` avec des
// questions à IMAGE « Quel est ce monument ? » (4 monuments au choix).
//
// Source : Wikidata (wbsearchentities pour résoudre le nom FR → QID, puis P18
// image). Image téléchargée en MINIATURE 800px depuis Commons (moins lourd →
// moins de rate-limit) et RÉ-HÉBERGÉE (nom opaque). Distracteurs = autres monuments.
//
// Idempotent CIBLÉ : delete-then-insert sur (subject='villes_monuments',
// t='Monument').
//   node scripts/seed-monuments.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'villes_monuments';
const BUCKET = 'quete-questions';
const TAG = 'Monument';
const UA = 'QueteDesMatieres-seed/1.0 (quiz éducatif; contact: enseignant)';
const MAX_BYTES = 8 * 1024 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Monuments mondialement célèbres (nom FR = réponse ; sert aussi à la recherche).
const MONUMENTS = [
  'Tour Eiffel', 'Colisée', 'Tour de Pise', 'Statue de la Liberté', 'Big Ben',
  'Sagrada Família', 'Pyramide de Khéops', 'Taj Mahal', 'Machu Picchu', 'Christ Rédempteur',
  'Mont Saint-Michel', 'Château de Versailles', 'Notre-Dame de Paris', 'Arc de triomphe de l’Étoile',
  'Basilique du Sacré-Cœur de Montmartre', 'Golden Gate Bridge', 'Opéra de Sydney',
  'Grande Muraille de Chine', 'Kremlin de Moscou', 'Basilique Saint-Pierre', 'Parthénon',
  'Pétra', 'Angkor Vat', 'Alhambra', 'Stonehenge', 'Château de Neuschwanstein',
  'Porte de Brandebourg', 'Burj Khalifa', 'Mont Rushmore', 'Empire State Building',
  'Tower Bridge', 'Atomium', 'Sphinx de Gizeh', 'Chichén Itzá', 'Tour de Londres',
  'Palais de Buckingham', 'Cathédrale Saint-Basile', 'Cathédrale Santa Maria del Fiore',
  'Tours Petronas', 'Acropole d’Athènes', 'Château de Chambord', 'Pont du Gard', 'Aqueduc de Ségovie',
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// L'API d'action Wikidata rate-limite vite (429) → retry avec backoff.
async function getJSONRetry(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries - 1) {
      const ra = Number(r.headers.get('retry-after')) || 0;
      await sleep(Math.max(ra * 1000, 4000 * (i + 1)));
      continue;
    }
    throw new Error(`HTTP ${r.status}`);
  }
}

async function searchQid(name) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&format=json&limit=1`;
  return (await getJSONRetry(url)).search?.[0]?.id || null;
}

async function imageFilename(qid) {
  const ent = (await getJSONRetry(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)).entities?.[qid];
  return ent?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || null;
}

async function uploadThumb(filename) {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error('trop lourd');
      const ext = (filename.match(/\.([a-z0-9]{2,4})$/i)?.[1] || 'jpg').toLowerCase();
      const path = `q-${randomUUID()}.${ext === 'svg' ? 'png' : ext}`; // NOM OPAQUE (svg rendu en png par le thumbnailer)
      const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: r.headers.get('content-type') || 'image/jpeg', upsert: true });
      if (error) throw error;
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
    if (r.status === 429 && i < 4) { const ra = Number(r.headers.get('retry-after')) || 0; await sleep(Math.max(ra * 1000, 4000 * (i + 1))); continue; }
    throw new Error(`img HTTP ${r.status}`);
  }
}

// 1) Résout QID + image pour chaque monument.
console.log(`→ Wikidata : ${MONUMENTS.length} monuments…`);
const found = [];
for (const name of MONUMENTS) {
  try {
    const qid = await searchQid(name);
    if (!qid) { console.warn(`  ✗ ${name} : introuvable`); continue; }
    const file = await imageFilename(qid);
    if (!file) { console.warn(`  ✗ ${name} : pas d'image`); continue; }
    found.push({ name, file });
  } catch (e) { console.warn(`  ✗ ${name} : ${e.message}`); }
  await sleep(400);
}
console.log(`  ${found.length} monuments avec image.`);

// 2) Upload + questions (distracteurs = autres monuments).
const rows = [];
let ord = 0, failed = 0;
for (const w of found) {
  let img;
  try { img = await uploadThumb(w.file); await sleep(800); } // throttle anti-429 Commons
  catch (e) { failed++; console.warn(`  ✗ ${w.name} : ${e.message}`); continue; }
  const pick = shuffle(found.filter((x) => x.name !== w.name)).slice(0, 3).map((x) => x.name);
  if (pick.length < 3) { failed++; continue; }
  const opts = shuffle([w.name, ...pick]);
  const correcte = opts.indexOf(w.name) + 1;
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    q: 'Quel est ce monument ?', q_en: 'Which monument is this?',
    rep_a: opts[0], rep_b: opts[1], rep_c: opts[2], rep_d: opts[3], correcte,
    e: `${w.name}. (Image : Wikimedia Commons.)`,
    img,
  });
  console.log(`  ✓ ${w.name}`);
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
