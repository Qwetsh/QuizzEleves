// Seed des questions « Affiches » cinéma + séries TV (duel Affiche mystère,
// moteur deblur : l'affiche floutée se révèle, premier sur le bon titre).
// Mécanique récupérée du projet Ciné (C:\...\Code\Ciné, src/lib/quiz.ts,
// type de question 'poster') et adaptée à l'archi extract→DB de ce projet :
// on pré-génère les questions en base au lieu d'appeler TMDB au runtime.
//
// Pipeline : TMDB /discover (films et séries les PLUS VOTÉS = mainstream,
//   langue FR, sans adulte) → affiche w342 → upload bucket `quete-questions`
//   (NOM OPAQUE anti-triche, comme les drapeaux) → insert quete_questions
//   (subject='cinema_affiches' | 'series_affiches', img=URL, t='Affiche').
//
// Distracteurs FUTÉS (repris de l'esprit quiz.ts/seed-flags) : même genre ET
// même décennie d'abord, puis même genre, puis même décennie, puis n'importe.
// Les titres de la MÊME SAGA sont exclus (une affiche Harry Potter avec 3
// autres Harry Potter en options serait ambiguë).
//
// Idempotent : delete-then-insert CIBLÉ sur (subject, t='Affiche') — préserve
// d'éventuelles questions texte des mêmes thèmes.
//
// Clé TMDB : env TMDB_API_KEY / VITE_TMDB_API_KEY, sinon lue dans le .env du
// projet Ciné (../Ciné/.env). Jamais loggée.
//
//   node scripts/seed-cinema-affiches.mjs [nbFilms] [nbSeries]
//     défauts : 200 films, 100 séries.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const URL_ = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const BUCKET = 'quete-questions';
const TAG = 'Affiche';
const N_FILMS = Number(process.argv[2]) || 200;
const N_SERIES = Number(process.argv[3]) || 100;

// --- Clé TMDB (env, sinon .env du projet Ciné) ---
function tmdbKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY;
  if (process.env.VITE_TMDB_API_KEY) return process.env.VITE_TMDB_API_KEY;
  const candidates = [
    'C:/Users/Utilisateur/OneDrive/Code/Ciné/.env',
    new URL('../../Ciné/.env', import.meta.url).pathname.replace(/^\//, ''),
  ];
  for (const p of candidates) {
    try {
      const m = readFileSync(p, 'utf8').match(/^VITE_TMDB_API_KEY\s*=\s*(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* fichier absent : candidat suivant */ }
  }
  console.error('✗ Clé TMDB introuvable (env TMDB_API_KEY ou .env du projet Ciné).');
  process.exit(1);
}
const API_KEY = tmdbKey();

const TMDB = 'https://api.themoviedb.org/3';
const IMG = (path) => `https://image.tmdb.org/t/p/w342${path}`;

async function tmdbGet(path, params = {}) {
  const url = new URL(TMDB + path);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDB ${path} HTTP ${r.status}`);
  return r.json();
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// --- Récolte : les plus votés = les plus connus (mainstream, pas obscur) ---
async function discover(kind, count) {
  const out = [];
  const seen = new Set();
  const pages = Math.ceil(count / 20) + 2; // marge : certains items sont filtrés
  for (let page = 1; page <= pages && out.length < count; page++) {
    const data = await tmdbGet(`/discover/${kind}`, {
      sort_by: 'vote_count.desc', include_adult: 'false', page: String(page),
    });
    for (const it of data.results || []) {
      const title = kind === 'movie' ? it.title : it.name;
      const original = kind === 'movie' ? it.original_title : it.original_name;
      const date = kind === 'movie' ? it.release_date : it.first_air_date;
      if (!title || !it.poster_path || !date || seen.has(it.id)) continue;
      seen.add(it.id);
      out.push({
        id: it.id, title, original: original || title,
        year: Number(date.slice(0, 4)) || null,
        decade: Math.floor((Number(date.slice(0, 4)) || 0) / 10) * 10,
        genres: it.genre_ids || [],
        poster: it.poster_path,
      });
      if (out.length >= count) break;
    }
  }
  return out;
}

// --- Même saga ? (préfixe commun significatif → distracteur ambigu, exclu) ---
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function sameSaga(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  const wa = na.split(' '), wb = nb.split(' ');
  const stop = new Set(['the', 'le', 'la', 'les', 'a', 'an', 'un', 'une', 'de', 'du', 'of']);
  const fa = wa.filter((w) => !stop.has(w)), fb = wb.filter((w) => !stop.has(w));
  if (!fa.length || !fb.length) return na.startsWith(nb) || nb.startsWith(na);
  // même premier mot « plein » (harry/star/avengers…) OU préfixe l'un de l'autre
  return fa[0] === fb[0] || na.startsWith(nb) || nb.startsWith(na);
}

// --- 3 distracteurs futés : genre+décennie > genre > décennie > n'importe ---
function pickDistractors(target, all) {
  const usable = all.filter((x) => x.id !== target.id && !sameSaga(x.title, target.title));
  const shareGenre = (x) => x.genres.some((g) => target.genres.includes(g));
  const tiers = [
    usable.filter((x) => shareGenre(x) && x.decade === target.decade),
    usable.filter(shareGenre),
    usable.filter((x) => x.decade === target.decade),
    usable,
  ];
  const out = []; const used = new Set();
  for (const tier of tiers) {
    for (const x of shuffle(tier)) {
      if (out.length >= 3) return out;
      if (used.has(x.id)) continue;
      // pas deux distracteurs de la même saga entre eux non plus
      if (out.some((o) => sameSaga(o.title, x.title))) continue;
      used.add(x.id); out.push(x);
    }
  }
  return out;
}

// --- Upload d'affiche (nom opaque, une seule fois par item) ---
const posterCache = new Map();
async function uploadPoster(item) {
  if (posterCache.has(item.id)) return posterCache.get(item.id);
  try {
    const r = await fetch(IMG(item.poster));
    if (!r.ok) throw new Error(`poster HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const path = `q-${randomUUID()}.jpg`; // OPAQUE : jamais le titre
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    posterCache.set(item.id, sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  } catch (e) {
    console.warn(`  ✗ affiche ${item.title} : ${e.message}`);
    posterCache.set(item.id, null);
  }
  return posterCache.get(item.id);
}

async function buildRows(kind, subject, count, qFr, qEn) {
  console.log(`→ TMDB discover ${kind} (top votés)…`);
  const all = await discover(kind, count);
  console.log(`  ${all.length} ${kind === 'movie' ? 'films' : 'séries'} retenus.`);
  const rows = [];
  let ord = 0, done = 0;
  for (const item of all) {
    const distractors = pickDistractors(item, all);
    if (distractors.length < 3) { console.warn(`  ✗ ${item.title} : distracteurs insuffisants`); continue; }
    const img = await uploadPoster(item);
    if (!img) continue;
    const choices = shuffle([item, ...distractors]);
    const correcte = choices.findIndex((x) => x.id === item.id) + 1;
    rows.push({
      pool: 'cycle4', subject, level: null, t: TAG, enabled: true, ord: ord++,
      q: qFr, q_en: qEn,
      rep_a: choices[0].title, rep_b: choices[1].title, rep_c: choices[2].title, rep_d: choices[3].title,
      rep_a_en: choices[0].original, rep_b_en: choices[1].original, rep_c_en: choices[2].original, rep_d_en: choices[3].original,
      correcte,
      e: `Bonne réponse : ${item.title}${item.year ? ` (${item.year})` : ''}.`,
      e_en: `Correct answer: ${item.original}${item.year ? ` (${item.year})` : ''}.`,
      img,
    });
    if (++done % 25 === 0) console.log(`  … ${done}/${all.length}`);
  }
  return rows;
}

const movieRows = await buildRows('movie', 'cinema_affiches', N_FILMS, 'Quel est ce film ?', 'What movie is this?');
const tvRows = await buildRows('tv', 'series_affiches', N_SERIES, 'Quelle est cette série ?', 'What TV show is this?');

for (const [subject, rows] of [['cinema_affiches', movieRows], ['series_affiches', tvRows]]) {
  console.log(`→ ${rows.length} questions « ${subject} ». Remplacement en base…`);
  const { error: delErr } = await sb.from('quete_questions').delete().eq('subject', subject).eq('t', TAG);
  if (delErr) { console.error('delete:', delErr.message); process.exit(1); }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
    if (error) { console.error('insert:', error.message); process.exit(1); }
  }
  console.log(`✓ ${rows.length} questions « ${subject} » insérées (t='${TAG}', bucket opaque).`);
}
console.log('Terminé. Pense aux nœuds quete_themes (cinema_affiches / series_affiches) si absents.');
