// Seed « Peinture » — enrichit le thème EXISTANT `peinture_sculpture` avec des
// questions à IMAGE « Qui a peint ce tableau ? » (4 peintres au choix).
//
// Source : The Metropolitan Museum of Art Collection API (SANS clé) — on ne garde
// que les œuvres du DOMAINE PUBLIC (isPublicDomain) avec image. L'image est
// RÉ-HÉBERGÉE dans le bucket `quete-questions` (nom opaque) → aucune dépendance au
// runtime + anti-triche. Distracteurs FUTÉS = peintres de la MÊME ÉPOQUE.
//
// Idempotent CIBLÉ : delete-then-insert sur (subject='peinture_sculpture',
// t='Tableau') — n'écrase QUE nos questions image, préserve les questions texte.
//
//   node scripts/seed-met-paintings.mjs
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'peinture_sculpture';
const BUCKET = 'quete-questions';
const TAG = 'Tableau';
const MET = 'https://collectionapi.metmuseum.org/public/collection/v1';
const MAX_BYTES = 6 * 1024 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Peintres célèbres : [nom affiché, sous-chaîne à retrouver dans artistDisplayName,
// époque pour les distracteurs futés]. Les modernes (mod) sont souvent HORS domaine
// public au Met → simplement ignorés (pas d'image publique).
const PAINTERS = [
  ['Rembrandt', 'Rembrandt', 'ren'], ['Johannes Vermeer', 'Vermeer', 'ren'],
  ['Pierre Paul Rubens', 'Rubens', 'ren'], ['Antoon van Dyck', 'Dyck', 'ren'],
  ['Diego Vélasquez', 'Vel', 'ren'], ['Le Greco', 'Greco', 'ren'],
  ['Titien', 'Titian', 'ren'], ['Le Caravage', 'Caravaggio', 'ren'],
  ['Nicolas Poussin', 'Poussin', 'ren'], ['Albrecht Dürer', 'Dürer', 'ren'],
  ['Frans Hals', 'Hals', 'ren'], ['Georges de La Tour', 'La Tour', 'ren'],
  ['Sandro Botticelli', 'Botticelli', 'ren'], ['Paul Véronèse', 'Veronese', 'ren'],
  ['Jean-Honoré Fragonard', 'Fragonard', 'clas'], ['François Boucher', 'Boucher', 'clas'],
  ['Jean Siméon Chardin', 'Chardin', 'clas'], ['Jacques Louis David', 'David', 'clas'],
  ['Jean-Auguste-Dominique Ingres', 'Ingres', 'clas'], ['Eugène Delacroix', 'Delacroix', 'clas'],
  ['Francisco de Goya', 'Goya', 'clas'], ['J. M. W. Turner', 'Turner', 'clas'],
  ['John Constable', 'Constable', 'clas'], ['Camille Corot', 'Corot', 'clas'],
  ['Gustave Courbet', 'Courbet', 'clas'], ['Jean-François Millet', 'Millet', 'clas'],
  ['Claude Monet', 'Monet', 'imp'], ['Édouard Manet', 'Manet', 'imp'],
  ['Auguste Renoir', 'Renoir', 'imp'], ['Edgar Degas', 'Degas', 'imp'],
  ['Camille Pissarro', 'Pissarro', 'imp'], ['Paul Cézanne', 'Cézanne', 'imp'],
  ['Vincent van Gogh', 'Gogh', 'imp'], ['Paul Gauguin', 'Gauguin', 'imp'],
  ['Georges Seurat', 'Seurat', 'imp'], ['Henri de Toulouse-Lautrec', 'Toulouse', 'imp'],
  ['Berthe Morisot', 'Morisot', 'imp'], ['Mary Cassatt', 'Cassatt', 'imp'],
  ['Gustave Caillebotte', 'Caillebotte', 'imp'], ['Winslow Homer', 'Homer', 'imp'],
  ['John Singer Sargent', 'Sargent', 'imp'],
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
// The Met 403/429 en cas de rafale → retry avec backoff (respecte Retry-After).
async function getJSON(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'QueteDesMatieres-seed/1.0 (quiz éducatif)' } });
    if (r.ok) return r.json();
    if ((r.status === 403 || r.status === 429 || r.status >= 500) && i < tries - 1) {
      const ra = Number(r.headers.get('retry-after')) || 0;
      await sleep(Math.max(ra * 1000, 3000 * (i + 1)));
      continue;
    }
    throw new Error(`HTTP ${r.status}`);
  }
}

// Trouve une œuvre du domaine public (image + bon peintre + c'est une peinture).
async function findPainting(match) {
  const res = await getJSON(`${MET}/search?q=${encodeURIComponent(match)}&hasImages=true`);
  const ids = (res.objectIDs || []).slice(0, 30);
  for (const id of ids) {
    try {
      const o = await getJSON(`${MET}/objects/${id}`);
      const isPainting = /painting/i.test(o.classification || '') || /oil|canvas|tempera|panel/i.test(o.medium || '');
      if (o.isPublicDomain && (o.primaryImageSmall || o.primaryImage) && isPainting
        && (o.artistDisplayName || '').includes(match)) {
        return { img: o.primaryImageSmall || o.primaryImage, title: o.title, date: o.objectDate };
      }
    } catch { /* objet illisible : suivant */ }
    await sleep(200);
  }
  return null;
}

async function uploadImage(imgUrl) {
  const r = await fetch(imgUrl);
  if (!r.ok) throw new Error(`img HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`trop lourd (${Math.round(buf.length / 1e6)} Mo)`);
  const ext = (imgUrl.match(/\.([a-z0-9]{2,4})(?:$|\?)/i)?.[1] || 'jpg').toLowerCase();
  const path = `q-${randomUUID()}.${ext}`; // NOM OPAQUE
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: r.headers.get('content-type') || 'image/jpeg', upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

console.log(`→ The Met : recherche d'une œuvre du domaine public pour ${PAINTERS.length} peintres…`);
const found = [];
for (const [name, match, era] of PAINTERS) {
  try {
    const p = await findPainting(match);
    if (!p) { console.warn(`  ✗ ${name} : aucune œuvre publique`); continue; }
    found.push({ name, era, ...p });
    console.log(`  ✓ ${name} — « ${p.title?.slice(0, 40)} »`);
  } catch (e) { console.warn(`  ✗ ${name} : ${e.message}`); }
  await sleep(400);
}

console.log(`→ ${found.length} œuvres trouvées. Upload + construction des questions…`);
const rows = [];
let ord = 0, failed = 0;
for (const w of found) {
  let img;
  try { img = await uploadImage(w.img); }
  catch (e) { failed++; console.warn(`  ✗ ${w.name} : ${e.message}`); continue; }
  // Distracteurs : 3 autres peintres, MÊME époque d'abord puis n'importe lesquels.
  const sameEra = shuffle(found.filter((x) => x.name !== w.name && x.era === w.era));
  const others = shuffle(found.filter((x) => x.name !== w.name));
  const pick = [];
  for (const c of [...sameEra, ...others]) { if (pick.length >= 3) break; if (!pick.includes(c.name) && c.name !== w.name) pick.push(c.name); }
  if (pick.length < 3) { failed++; continue; }
  const opts = shuffle([w.name, ...pick]);
  const correcte = opts.indexOf(w.name) + 1;
  const dateStr = w.date ? ` (${w.date})` : '';
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    q: 'Qui a peint ce tableau ?', q_en: 'Who painted this artwork?',
    rep_a: opts[0], rep_b: opts[1], rep_c: opts[2], rep_d: opts[3], correcte,
    e: `« ${w.title} »${dateStr}, par ${w.name}. (Source : The Met, domaine public.)`,
    e_en: `"${w.title}"${dateStr}, by ${w.name}. (Source: The Met, public domain.)`,
    img,
  });
}

console.log(`→ ${rows.length} questions prêtes (${failed} échecs). Remplacement ciblé (t='${TAG}')…`);
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT).eq('t', TAG); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « Tableau » ajoutées à ${SUBJECT}. Bucket='${BUCKET}' (noms opaques).`);
