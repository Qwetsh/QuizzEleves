// Seed « Qui est ce Pokémon ? » (cassette DURE `pokemon_silhouette`, opt-in).
// Pour CHAQUE Pokémon de la Génération 1 (1..151) : une question à IMAGE où
// l'artwork officiel est affiché en SILHOUETTE NOIRE (mode de rendu 'silhouette'),
// et le joueur choisit le bon nom parmi 4. Révélation en couleur + jingle façon
// pub TV. Les 3 distracteurs sont FUTÉS (même type d'abord, puis même génération).
//
// ⚠️ NE PAS confondre avec scripts/seed-pokemon.mjs (questions TEXTE, subject='pokemon').
//
// Pipeline : PokéAPI (noms FR via /pokemon-species, types + artwork via /pokemon)
//   → téléchargement de l'artwork (fond transparent) → upload bucket
//   `quete-questions` (NOM OPAQUE anti-triche) → insert quete_questions
//   (subject='pokemon_silhouette', img=URL, render='silhouette', t='Silhouette').
//
// Idempotent : delete-then-insert du subject 'pokemon_silhouette' (catégorie gérée
// par ce script). Anti-triche : nom de fichier aléatoire (jamais le nom du Pokémon),
// sinon l'URL trahirait la réponse (devtools / mobile).
//
//   node scripts/seed-pokemon-silhouette.mjs [limit]
//     limit = nb de Pokémon (défaut 151 = Gén. 1)
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'pokemon_silhouette';
const BUCKET = 'quete-questions';
const TAG = 'Silhouette';
const GEN1 = 151;
const LIMIT = Math.min(Number(process.argv[2]) || GEN1, GEN1);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

// Nom français depuis /pokemon-species (names[] filtré language.name==='fr').
function frenchName(species, fallback) {
  const n = (species.names || []).find((x) => x.language?.name === 'fr');
  return n?.name || fallback;
}

async function uploadArtwork(pngUrl) {
  const r = await fetch(pngUrl);
  if (!r.ok) throw new Error(`artwork HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const path = `q-${randomUUID()}.png`; // NOM OPAQUE (jamais le nom du Pokémon)
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'image/png', upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// 1) Récupère les Pokémon : nom EN, nom FR, types, URL de l'artwork officiel.
console.log(`→ Récupération de ${LIMIT} Pokémon (PokéAPI)…`);
const mons = [];
for (let id = 1; id <= LIMIT; id++) {
  try {
    const [p, species] = await Promise.all([
      getJSON(`https://pokeapi.co/api/v2/pokemon/${id}`),
      getJSON(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
    ]);
    const art = p.sprites?.other?.['official-artwork']?.front_default;
    if (!art) { console.warn(`  ✗ #${id} : pas d'artwork`); continue; }
    mons.push({
      id,
      en: cap(p.name),
      fr: frenchName(species, cap(p.name)),
      types: (p.types || []).map((t) => t.type.name),
      art,
    });
    if (id % 25 === 0) console.log(`  … ${id}/${LIMIT}`);
  } catch (e) { console.warn(`  ✗ #${id} : ${e.message}`); }
}
console.log(`  ${mons.length} Pokémon récupérés.`);

// 2) Distracteurs futés : d'abord des Pokémon partageant un type, puis n'importe
//    lesquels de la même génération. (Comme les voisins/région des drapeaux.)
function pickDistractors(target) {
  const used = new Set([target.id]);
  const sameType = shuffle(mons.filter((m) => !used.has(m.id) && m.types.some((t) => target.types.includes(t))));
  const others = shuffle(mons.filter((m) => !used.has(m.id)));
  const out = [];
  for (const tier of [sameType, others]) {
    for (const m of tier) {
      if (out.length >= 3) break;
      if (used.has(m.id)) continue;
      used.add(m.id); out.push(m);
    }
    if (out.length >= 3) break;
  }
  return out;
}

// 3) Construit les questions (upload de l'artwork du bon Pokémon uniquement).
const rows = [];
let ord = 0, failed = 0;
for (const target of mons) {
  const distractors = pickDistractors(target);
  if (distractors.length < 3) { failed++; console.warn(`  ✗ ${target.fr} : distracteurs insuffisants`); continue; }
  let img;
  try { img = await uploadArtwork(target.art); }
  catch (e) { failed++; console.warn(`  ✗ ${target.fr} : upload ${e.message}`); continue; }

  const choices = shuffle([target, ...distractors]);
  const correcte = choices.findIndex((c) => c.id === target.id) + 1;
  rows.push({
    pool: 'cycle4', subject: SUBJECT, level: null, t: TAG, enabled: true, ord: ord++,
    render: 'silhouette',
    q: 'Qui est ce Pokémon ?', q_en: "Who's that Pokémon?",
    rep_a: choices[0].fr, rep_b: choices[1].fr, rep_c: choices[2].fr, rep_d: choices[3].fr,
    rep_a_en: choices[0].en, rep_b_en: choices[1].en, rep_c_en: choices[2].en, rep_d_en: choices[3].en,
    correcte,
    e: `C'est ${target.fr} !`, e_en: `It's ${target.en}!`,
    img,
  });
  if (ord % 20 === 0) console.log(`  … ${ord} questions prêtes`);
}

console.log(`→ ${rows.length} questions prêtes (${failed} échecs). Remplacement en base…`);
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « ${SUBJECT} » insérées. Rendu='silhouette', Tag='${TAG}'. Bucket='${BUCKET}' (noms opaques).`);
