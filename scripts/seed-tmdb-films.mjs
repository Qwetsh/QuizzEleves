// Seed « Cinéma » — enrichit le thème EXISTANT `cinema` avec des questions à IMAGE
// « De quel film provient cette image ? » (4 titres au choix).
//
// Source : TMDB (The Movie Database). ⚠️ On utilise les BACKDROPS (images de scène)
// et PAS les affiches : une affiche porte souvent le titre écrit = spoiler. Les
// backdrops sont des photogrammes sans texte. Titres en FRANÇAIS (language=fr-FR).
// Image RÉ-HÉBERGÉE dans le bucket (nom opaque) → pas de dépendance runtime.
//
// Clé API : variable d'environnement TMDB_API_KEY (JAMAIS commitée).
//   TMDB_API_KEY=xxxx node scripts/seed-tmdb-films.mjs
//
// Idempotent CIBLÉ : delete-then-insert sur (subject='cinema', t='Scène') —
// préserve les questions texte du thème.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const TMDB = process.env.TMDB_API_KEY;
if (!TMDB) { console.error('Manque TMDB_API_KEY (variable d\'environnement).'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'cinema';
const BUCKET = 'quete-questions';
const TAG = 'Scène';
const PAGES = Number(process.argv[2]) || 8;       // 20 films/page
const MIN_VOTES = 800;                            // écarte les films obscurs
const MAX = 60;                                   // nb max de questions
const IMG = 'https://image.tmdb.org/t/p/w780';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
const year = (d) => (d ? String(d).slice(0, 4) : '');
const decade = (d) => { const y = Number(year(d)); return y ? Math.floor(y / 10) * 10 : 0; };

// 1) Films populaires (FR), filtrés (votes + backdrop dispo), dédupliqués.
console.log(`→ TMDB : ${PAGES} pages de films populaires (fr-FR)…`);
const seen = new Set();
let films = [];
for (let p = 1; p <= PAGES; p++) {
  try {
    const j = await getJSON(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB}&language=fr-FR&page=${p}`);
    for (const m of j.results || []) {
      if (!m.backdrop_path || m.vote_count < MIN_VOTES || seen.has(m.id)) continue;
      seen.add(m.id);
      films.push({ id: m.id, title: m.title, year: year(m.release_date), decade: decade(m.release_date), backdrop: m.backdrop_path });
    }
  } catch (e) { console.warn(`  page ${p} : ${e.message}`); }
  await sleep(150);
}
films = shuffle(films).slice(0, MAX);
console.log(`  ${films.length} films retenus.`);

async function uploadImage(imgUrl) {
  const r = await fetch(imgUrl);
  if (!r.ok) throw new Error(`img HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const path = `q-${randomUUID()}.jpg`; // NOM OPAQUE
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 2) Construit les questions (distracteurs = films de la même décennie d'abord).
const rows = [];
let ord = 0, failed = 0;
for (const f of films) {
  let img;
  try { img = await uploadImage(`${IMG}${f.backdrop}`); await sleep(120); }
  catch (e) { failed++; console.warn(`  ✗ ${f.title} : ${e.message}`); continue; }
  const sameDec = shuffle(films.filter((x) => x.id !== f.id && x.decade === f.decade));
  const others = shuffle(films.filter((x) => x.id !== f.id));
  const pick = [];
  for (const c of [...sameDec, ...others]) { if (pick.length >= 3) break; if (c.title !== f.title && !pick.includes(c.title)) pick.push(c.title); }
  if (pick.length < 3) { failed++; continue; }
  const opts = shuffle([f.title, ...pick]);
  const correcte = opts.indexOf(f.title) + 1;
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    q: 'De quel film provient cette image ?', q_en: 'Which film is this image from?',
    rep_a: opts[0], rep_b: opts[1], rep_c: opts[2], rep_d: opts[3], correcte,
    e: `${f.title}${f.year ? ` (${f.year})` : ''}.`, e_en: `${f.title}${f.year ? ` (${f.year})` : ''}.`,
    img,
  });
  console.log(`  ✓ ${f.title}`);
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
