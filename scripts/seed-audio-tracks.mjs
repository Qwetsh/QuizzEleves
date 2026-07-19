// Seed « Blind test » (quiz audio, feuille de route MINIJEUX_SOUHAITS.md) :
// extraits 30 s Deezer → bucket `quete-questions` (NOM OPAQUE — indispensable
// ici : les URLs de preview Deezer sont SIGNÉES et expirent) → questions à
// AUDIO (colonne `audio`, brique déjà mappée par questionsConfig).
//
//   - musique_populaire_extraits : le chart Deezer (~100 titres du moment,
//     reconnaissables par les élèves). Q = « Quel est ce morceau ? »,
//     réponses « Titre — Artiste » (distracteurs d'ARTISTES DIFFÉRENTS).
//   - musique_classique_extraits : ~33 œuvres célèbres curées (recherche
//     Deezer par œuvre). Q = « Quelle est cette œuvre ? », réponses
//     « Œuvre — Compositeur » (distracteurs de la même époque d'abord,
//     jamais du même compositeur).
//
// Deezer : API publique sans clé (chart/search), appelée côté Node (pas de
// CORS). Idempotent : delete-then-insert par (subject, t='Extrait').
//
//   node scripts/seed-audio-tracks.mjs [pool ...]   pools : pop classique
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const BUCKET = 'quete-questions';
const TAG = 'Extrait';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchT = (url, opts = {}) => fetch(url, { signal: AbortSignal.timeout(20000), ...opts });
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

async function uploadAudio(url) {
  const r = await fetchT(url);
  if (!r.ok) throw new Error(`audio HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 10000) throw new Error('extrait vide');
  const path = `q-${randomUUID()}.mp3`; // OPAQUE
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 3 distracteurs : jamais le même `avoid` (artiste/compositeur), même `cat`
// (époque) d'abord si présente.
function pickDistractors(target, all) {
  const usable = all.filter((x) => x.label !== target.label && x.avoid !== target.avoid);
  const tiers = [usable.filter((x) => x.cat && x.cat === target.cat), usable];
  const out = []; const used = new Set([target.label]);
  for (const tier of tiers) {
    for (const x of shuffle(tier)) {
      if (out.length >= 3) return out;
      if (used.has(x.label) || out.some((o) => o.avoid === x.avoid)) continue;
      used.add(x.label); out.push(x);
    }
  }
  return out;
}

// items = [{ label, avoid, cat, preview }] — label = réponse affichée.
async function seedPool({ subject, qFr, qEn, items }) {
  const rows = [];
  let ord = 0, done = 0;
  for (const item of items) {
    const distractors = pickDistractors(item, items);
    if (distractors.length < 3) { console.warn(`  ✗ ${item.label} : distracteurs insuffisants`); continue; }
    let audio;
    try { audio = await uploadAudio(item.preview); }
    catch (e) { console.warn(`  ✗ audio ${item.label} : ${e.message}`); continue; }
    const choices = shuffle([item, ...distractors]);
    rows.push({
      pool: 'cycle4', subject, level: null, t: TAG, enabled: true, ord: ord++,
      q: qFr, q_en: qEn,
      rep_a: choices[0].label, rep_b: choices[1].label, rep_c: choices[2].label, rep_d: choices[3].label,
      correcte: choices.findIndex((x) => x.label === item.label) + 1,
      e: `Bonne réponse : ${item.label}.`, e_en: `Correct answer: ${item.label}.`,
      img: null, audio,
    });
    if (++done % 20 === 0) console.log(`  … ${done}/${items.length}`);
  }
  console.log(`→ ${subject} : ${rows.length} questions. Remplacement en base…`);
  const { error: delErr } = await sb.from('quete_questions').delete().eq('subject', subject).eq('t', TAG);
  if (delErr) { console.error('delete:', delErr.message); process.exit(1); }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
    if (error) { console.error('insert:', error.message); process.exit(1); }
  }
  console.log(`✓ ${rows.length} questions « ${subject} » insérées.`);
}

// ── Pool POP : le chart Deezer ───────────────────────────────────────────────
async function poolPop() {
  const items = [];
  const seen = new Set();
  const r = await fetchT('https://api.deezer.com/chart/0/tracks?limit=100');
  if (!r.ok) { console.warn(`✗ Deezer chart : HTTP ${r.status}`); return; }
  for (const t of (await r.json()).data || []) {
    if (!t.title || !t.preview || !t.artist?.name) continue;
    const label = `${t.title} — ${t.artist.name}`;
    if (seen.has(label)) continue;
    seen.add(label);
    items.push({ label, avoid: t.artist.name, cat: null, preview: t.preview });
  }
  console.log(`→ Deezer chart : ${items.length} titres.`);
  await seedPool({
    subject: 'musique_populaire_extraits',
    qFr: 'Quel est ce morceau ?', qEn: 'What song is this?', items,
  });
}

// ── Pool CLASSIQUE : œuvres célèbres curées (recherche Deezer) ───────────────
const OEUVRES = [
  // [œuvre (FR), compositeur, requête Deezer, époque]
  ['La Lettre à Élise', 'Beethoven', 'beethoven fur elise', 'classique'],
  ['Symphonie n°5', 'Beethoven', 'beethoven symphony no 5 allegro con brio', 'classique'],
  ['L\'Ode à la joie', 'Beethoven', 'beethoven ode to joy symphony 9', 'classique'],
  ['Les Quatre Saisons : le Printemps', 'Vivaldi', 'vivaldi four seasons spring', 'baroque'],
  ['Toccata et fugue en ré mineur', 'Bach', 'bach toccata fugue d minor', 'baroque'],
  ['Une petite musique de nuit', 'Mozart', 'mozart eine kleine nachtmusik', 'classique'],
  ['L\'air de la Reine de la Nuit', 'Mozart', 'mozart queen of the night aria', 'classique'],
  ['Requiem : Lacrimosa', 'Mozart', 'mozart requiem lacrimosa', 'classique'],
  ['La Marche turque', 'Mozart', 'mozart rondo alla turca', 'classique'],
  ['Le Boléro', 'Ravel', 'ravel bolero', 'moderne'],
  ['Clair de lune', 'Debussy', 'debussy clair de lune', 'moderne'],
  ['Gymnopédie n°1', 'Satie', 'satie gymnopedie no 1', 'moderne'],
  ['Le Lac des cygnes', 'Tchaïkovski', 'tchaikovsky swan lake theme', 'romantique'],
  ['La Danse de la fée Dragée', 'Tchaïkovski', 'tchaikovsky dance sugar plum fairy', 'romantique'],
  ['Le Beau Danube bleu', 'Johann Strauss', 'strauss blue danube', 'romantique'],
  ['La Chevauchée des Walkyries', 'Wagner', 'wagner ride of the valkyries', 'romantique'],
  ['Carmen : Habanera', 'Bizet', 'bizet carmen habanera', 'romantique'],
  ['Ainsi parlait Zarathoustra', 'Richard Strauss', 'also sprach zarathustra sunrise', 'moderne'],
  ['Dans l\'antre du roi de la montagne', 'Grieg', 'grieg in the hall of the mountain king', 'romantique'],
  ['Nocturne op. 9 n°2', 'Chopin', 'chopin nocturne op 9 no 2', 'romantique'],
  ['La Marche funèbre', 'Chopin', 'chopin funeral march sonata', 'romantique'],
  ['Le Cygne (Carnaval des animaux)', 'Saint-Saëns', 'saint-saens le cygne carnival', 'romantique'],
  ['La Danse macabre', 'Saint-Saëns', 'saint-saens danse macabre', 'romantique'],
  ['Le Canon de Pachelbel', 'Pachelbel', 'pachelbel canon in d', 'baroque'],
  ['Les Noces de Figaro : ouverture', 'Mozart', 'mozart marriage of figaro overture', 'classique'],
  ['Guillaume Tell : ouverture', 'Rossini', 'rossini william tell overture finale', 'romantique'],
  ['L\'Apprenti sorcier', 'Dukas', 'dukas sorcerer apprentice', 'moderne'],
  ['La Symphonie du Nouveau Monde', 'Dvořák', 'dvorak new world symphony largo', 'romantique'],
  ['Ave Maria', 'Schubert', 'schubert ave maria', 'romantique'],
  ['Le Messie : Hallelujah', 'Haendel', 'handel messiah hallelujah', 'baroque'],
  ['La Traviata : Libiamo', 'Verdi', 'verdi la traviata libiamo', 'romantique'],
  ['Nessun dorma (Turandot)', 'Puccini', 'puccini nessun dorma', 'moderne'],
  ['Carmina Burana : O Fortuna', 'Orff', 'orff carmina burana o fortuna', 'moderne'],
  ['Pierre et le Loup', 'Prokofiev', 'prokofiev peter and the wolf', 'moderne'],
];

async function poolClassique() {
  const items = [];
  for (const [oeuvre, compositeur, query, cat] of OEUVRES) {
    try {
      const r = await fetchT(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`);
      if (!r.ok) { console.warn(`  ✗ Deezer search ${oeuvre} : HTTP ${r.status}`); continue; }
      const hit = ((await r.json()).data || []).find((t) => t.preview);
      if (!hit) { console.warn(`  ✗ pas d'extrait : ${oeuvre}`); continue; }
      items.push({ label: `${oeuvre} — ${compositeur}`, avoid: compositeur, cat, preview: hit.preview });
    } catch (e) { console.warn(`  ✗ ${oeuvre} : ${e.message}`); }
    await sleep(150);
  }
  console.log(`→ Deezer classique : ${items.length} œuvres.`);
  await seedPool({
    subject: 'musique_classique_extraits',
    qFr: 'Quelle est cette œuvre ?', qEn: 'What piece is this?', items,
  });
}

const POOLS = { pop: poolPop, classique: poolClassique };
const asked = process.argv.slice(2).filter((p) => POOLS[p]);
for (const p of (asked.length ? asked : Object.keys(POOLS))) {
  console.log(`\n══ POOL ${p} ══`);
  await POOLS[p]();
}
console.log('\nTerminé.');
