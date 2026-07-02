// Seed du tronc de l'arbre de thèmes (table `quete_themes`, ltree).
// Phase 1 de la refonte « sélection par lecteur de cassettes ».
//
// Une FEUILLE (subject_key non-null) DOIT référencer une `quete_categories`
// existante (role subject) : c'est le pont vers le contenu (quete_questions.subject).
// Un NŒUD LARGE (subject_key null) = INTÉGRALE/domaine : sa voie = le pool de ses
// feuilles descendantes. `path` (ltree, ascii) est calculé ici en JS.
// Idempotent : upsert onConflict:'key'.
//
//   node scripts/seed-themes.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Arbre à plat (parents AVANT enfants). `parent` = null pour un domaine racine.
// `subject_key` uniquement sur les feuilles (= clé quete_categories/quete_questions.subject).
const NODES = [
  // ---- Domaines (racines) ----
  { key: 'scolaire', parent: null, kind: 'scolaire', name: 'Scolaire', name_en: 'School', emblem: '✎', color: '#4f7a4a', color_soft: '#b8d3b2', color_deep: '#16301a', biome: 'Cour de Récré', biome_en: 'Schoolyard', default_on: true, ord: 0 },
  { key: 'divertissement', parent: null, kind: 'domain', name: 'Divertissement', name_en: 'Entertainment', emblem: '★', color: '#d2622b', color_soft: '#f0c9a0', color_deep: '#3a1c0e', biome: 'Studio & Paillettes', biome_en: 'Studio & Glitter', ord: 1 },
  { key: 'sport', parent: null, kind: 'domain', name: 'Sport', name_en: 'Sports', emblem: '◈', color: '#16998c', color_soft: '#a8ddd5', color_deep: '#06302c', biome: 'Stade Olympique', biome_en: 'Olympic Stadium', ord: 2 },
  { key: 'sciences', parent: null, kind: 'domain', name: 'Sciences', name_en: 'Science', emblem: '✦', color: '#5566b5', color_soft: '#c3c9ee', color_deep: '#1b2350', biome: 'Labo Cosmos', biome_en: 'Cosmos Lab', ord: 3 },

  // ---- Scolaire : 8 matières (feuilles ; couleur/biome null → fallback SUBJECTS) ----
  { key: 'francais', parent: 'scolaire', kind: 'theme', subject_key: 'francais', name: 'Français', name_en: 'French', ord: 0 },
  { key: 'maths', parent: 'scolaire', kind: 'theme', subject_key: 'maths', name: 'Maths', name_en: 'Maths', ord: 1 },
  { key: 'histoire', parent: 'scolaire', kind: 'theme', subject_key: 'histoire', name: 'Histoire', name_en: 'History', ord: 2 },
  { key: 'geographie', parent: 'scolaire', kind: 'theme', subject_key: 'geographie', name: 'Géographie', name_en: 'Geography', ord: 3 },
  { key: 'svt', parent: 'scolaire', kind: 'theme', subject_key: 'svt', name: 'SVT', name_en: 'Biology', ord: 4 },
  { key: 'anglais', parent: 'scolaire', kind: 'theme', subject_key: 'anglais', name: 'Anglais', name_en: 'English', ord: 5 },
  { key: 'allemand', parent: 'scolaire', kind: 'theme', subject_key: 'allemand', name: 'Allemand', name_en: 'German', ord: 6 },
  { key: 'espagnol', parent: 'scolaire', kind: 'theme', subject_key: 'espagnol', name: 'Espagnol', name_en: 'Spanish', ord: 7 },

  // ---- Divertissement : nœuds larges imbriqués + feuilles à contenu ----
  { key: 'cinema', parent: 'divertissement', kind: 'integrale', name: 'Cinéma', name_en: 'Cinema', emblem: '🎬', color: '#c0563a', color_soft: '#f0c4b6', color_deep: '#3a160c', biome: 'Salle Obscure', biome_en: 'Movie Theater', ord: 0 },
  { key: 'film_scifi', parent: 'cinema', kind: 'theme', subject_key: 'film_scifi', name: 'Science-Fiction', name_en: 'Sci-Fi', ord: 0 },
  { key: 'film_anim', parent: 'cinema', kind: 'theme', subject_key: 'film_anim', name: 'Animation', name_en: 'Animation', ord: 1 },
  { key: 'film_action', parent: 'cinema', kind: 'theme', subject_key: 'film_action', name: 'Action', name_en: 'Action', ord: 2 },

  { key: 'harrypotter', parent: 'divertissement', kind: 'integrale', name: 'Harry Potter', name_en: 'Harry Potter', emblem: '🪄', color: '#5b3a8c', color_soft: '#ddd2ec', color_deep: '#2e1c4a', biome: 'Château de Poudlard', biome_en: 'Hogwarts Castle', ord: 1 },
  { key: 'hp_livre1', parent: 'harrypotter', kind: 'theme', subject_key: 'hp_livre1', name: 'Livre 1', name_en: 'Book 1', ord: 0 },
];

// --- Calcul du path ltree (ascii) : parent.path || key ---
const byKey = Object.fromEntries(NODES.map((n) => [n.key, n]));
function pathOf(key) {
  const segs = [];
  let cur = byKey[key];
  const seen = new Set();
  while (cur) {
    if (seen.has(cur.key)) throw new Error('Cycle dans l’arbre à ' + cur.key);
    seen.add(cur.key);
    segs.unshift(cur.key);
    cur = cur.parent ? byKey[cur.parent] : null;
  }
  return segs.join('.');
}
const ASCII = /^[a-z0-9_]+$/;

// --- Validation : keys ascii + feuilles pointant sur une catégorie existante ---
const { data: cats, error: eCats } = await sb.from('quete_categories').select('key,role');
if (eCats) throw new Error('lecture quete_categories: ' + eCats.message);
const subjectKeys = new Set((cats || []).map((c) => c.key));

const problems = [];
for (const n of NODES) {
  if (!ASCII.test(n.key)) problems.push(`key non-ascii: ${n.key}`);
  if (n.parent && !byKey[n.parent]) problems.push(`parent introuvable pour ${n.key}: ${n.parent}`);
  if (n.subject_key && !subjectKeys.has(n.subject_key)) {
    problems.push(`feuille ${n.key}: subject_key '${n.subject_key}' absent de quete_categories (pas de contenu chargeable)`);
  }
}
if (problems.length) {
  console.error('Validation échouée :\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

// --- Construction des lignes DB ---
const rows = NODES.map((n) => ({
  key: n.key,
  path: pathOf(n.key),
  parent_key: n.parent ?? null,
  subject_key: n.subject_key ?? null,
  kind: n.kind,
  name: n.name,
  name_en: n.name_en ?? null,
  short: n.short ?? null,
  icon: n.icon ?? null,
  emblem: n.emblem ?? null,
  color: n.color ?? null,
  color_soft: n.color_soft ?? null,
  color_deep: n.color_deep ?? null,
  biome: n.biome ?? null,
  biome_en: n.biome_en ?? null,
  default_on: n.default_on ?? false,
  enabled: true,
  ord: n.ord ?? 0,
}));

const { error } = await sb.from('quete_themes').upsert(rows, { onConflict: 'key' });
if (error) throw new Error('upsert quete_themes: ' + error.message);

console.log(`✓ ${rows.length} thèmes seedés (${rows.filter((r) => r.subject_key).length} feuilles à contenu).`);
for (const r of rows) console.log(`  ${r.path}${r.subject_key ? '  → ' + r.subject_key : ''}`);
