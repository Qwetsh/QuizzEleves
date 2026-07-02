// Seed de la TAXONOMIE du pool de base culture-G (8 domaines, 46 thèmes).
// - quete_modules : 8 domaines culture-G (kind 'themed' → transverses, pas de niveau).
// - quete_categories : 46 thèmes (role subject, board) = les buckets de contenu.
// - quete_themes : arbre complet reconstruit (REMPLACE tout) = scolaire + culture-G + pack HP bonus.
//
// Clés des domaines suffixées `_g` pour ne JAMAIS entrer en collision avec un
// subject existant (histoire/geographie scolaires) dans les maps runtime.
// Idempotent : upsert (modules/categories) + delete-all-then-insert (themes).
//
//   node scripts/seed-pool-taxonomy.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// --- 8 domaines culture-G ---
const DOMAINS = [
  { key: 'histoire_g', name: 'Histoire', name_en: 'History', color: '#b8862c', color_soft: '#f0e0bd', color_deep: '#6e4e10', emblem: '🏛️', biome: 'Les Ruines du Temps', biome_en: 'Ruins of Time' },
  { key: 'geographie_g', name: 'Géographie', name_en: 'Geography', color: '#2e8b8b', color_soft: '#bfe3e3', color_deep: '#123c3c', emblem: '🧭', biome: "L'Atlas Vivant", biome_en: 'The Living Atlas' },
  { key: 'sciences_g', name: 'Sciences', name_en: 'Science', color: '#5566b5', color_soft: '#c3c9ee', color_deep: '#1b2350', emblem: '✦', biome: 'Le Labo Cosmos', biome_en: 'Cosmos Lab' },
  { key: 'nature_g', name: 'Nature', name_en: 'Nature', color: '#4f9a52', color_soft: '#c6e6c4', color_deep: '#1c4a1e', emblem: '🌿', biome: 'La Forêt Foisonnante', biome_en: 'The Teeming Forest' },
  { key: 'arts_g', name: 'Arts', name_en: 'Arts', color: '#a6478c', color_soft: '#e8c8df', color_deep: '#4a1c3e', emblem: '🎨', biome: 'La Galerie', biome_en: 'The Gallery' },
  { key: 'divertissement_g', name: 'Divertissement', name_en: 'Entertainment', color: '#d2622b', color_soft: '#f0c9a0', color_deep: '#3a1c0e', emblem: '★', biome: 'Studio & Paillettes', biome_en: 'Studio & Glitter' },
  { key: 'sport_g', name: 'Sport', name_en: 'Sports', color: '#16998c', color_soft: '#a8ddd5', color_deep: '#06302c', emblem: '◈', biome: 'Le Stade', biome_en: 'The Stadium' },
  { key: 'societe_g', name: 'Société', name_en: 'Society', color: '#d1495b', color_soft: '#f4c6cd', color_deep: '#4e1520', emblem: '🌍', biome: 'La Grand-Place', biome_en: 'The Public Square' },
];
const DOM = Object.fromEntries(DOMAINS.map((d) => [d.key, d]));

// --- 46 thèmes jouables (feuilles) : subject_key = key ---
const THEMES = [
  ['histoire_g', 'prehistoire_antiquite', 'Préhistoire & Antiquité'],
  ['histoire_g', 'moyen_age', 'Moyen Âge'],
  ['histoire_g', 'epoque_moderne', 'Époque moderne'],
  ['histoire_g', 'revolutions_xixe', 'Révolutions & XIXe'],
  ['histoire_g', 'xxe_siecle', 'XXe siècle'],
  ['histoire_g', 'monde_contemporain', 'Monde contemporain'],
  ['geographie_g', 'geographie_physique', 'Reliefs, fleuves & climats'],
  ['geographie_g', 'pays_capitales', 'Pays & capitales'],
  ['geographie_g', 'villes_monuments', 'Villes & monuments'],
  ['geographie_g', 'drapeaux_symboles', 'Drapeaux & symboles'],
  ['geographie_g', 'mers_deserts_reperes', 'Mers, déserts & repères'],
  ['sciences_g', 'maths_logique', 'Maths & logique'],
  ['sciences_g', 'physique', 'Physique'],
  ['sciences_g', 'chimie', 'Chimie'],
  ['sciences_g', 'astronomie_espace', 'Astronomie & espace'],
  ['sciences_g', 'informatique_numerique', 'Informatique & numérique'],
  ['sciences_g', 'inventions_technologies', 'Inventions & technologies'],
  ['nature_g', 'animaux', 'Animaux'],
  ['nature_g', 'plantes_botanique', 'Plantes & botanique'],
  ['nature_g', 'corps_humain_sante', 'Corps humain & santé'],
  ['nature_g', 'ecologie_environnement', 'Écologie & environnement'],
  ['nature_g', 'geologie_mineraux', 'Géologie & minéraux'],
  ['arts_g', 'litterature_auteurs', 'Littérature & auteurs'],
  ['arts_g', 'peinture_sculpture', 'Peinture & sculpture'],
  ['arts_g', 'architecture_design', 'Architecture & design'],
  ['arts_g', 'musique_classique_opera', 'Musique classique & opéra'],
  ['arts_g', 'photographie_arts_visuels', 'Photographie & arts visuels'],
  ['divertissement_g', 'cinema', 'Cinéma'],
  ['divertissement_g', 'series_tv', 'Séries TV'],
  ['divertissement_g', 'musique_populaire', 'Musique populaire'],
  ['divertissement_g', 'jeux_video', 'Jeux vidéo'],
  ['divertissement_g', 'jeux_de_societe', 'Jeux de société'],
  ['divertissement_g', 'bd_comics_manga', 'BD, comics & manga'],
  ['divertissement_g', 'tele_celebrites', 'Télé & célébrités'],
  ['sport_g', 'football', 'Football'],
  ['sport_g', 'sports_collectifs', 'Sports collectifs'],
  ['sport_g', 'tennis_raquettes', 'Tennis & raquettes'],
  ['sport_g', 'athletisme_jo', 'Athlétisme & JO'],
  ['sport_g', 'sports_mecaniques', 'Sports mécaniques'],
  ['sport_g', 'cyclisme', 'Cyclisme'],
  ['societe_g', 'politique_institutions', 'Politique & institutions'],
  ['societe_g', 'economie_marques_logos', 'Économie, marques & logos'],
  ['societe_g', 'religions_mythologies', 'Religions & mythologies'],
  ['societe_g', 'gastronomie_cuisine', 'Gastronomie & cuisine'],
  ['societe_g', 'langues_expressions', 'Langues & expressions'],
  ['societe_g', 'fetes_traditions_symboles', 'Fêtes & traditions'],
].map(([domain, key, name]) => ({ domain, key, name }));

// --- Matières scolaires (feuilles, inchangées) ---
const SCOLAIRE_LEAVES = [
  ['francais', 'Français'], ['maths', 'Maths'], ['histoire', 'Histoire'], ['geographie', 'Géographie'],
  ['svt', 'SVT'], ['anglais', 'Anglais'], ['allemand', 'Allemand'], ['espagnol', 'Espagnol'],
];

// ---------- 1) quete_modules (8 domaines culture-G, themed) ----------
const moduleRows = DOMAINS.map((d, i) => ({
  key: d.key, name: d.name, name_en: d.name_en, icon: d.emblem, kind: 'themed',
  description: null, color: d.color, color_soft: d.color_soft, color_deep: d.color_deep,
  biome: d.biome, biome_en: d.biome_en, enabled: true, ord: 10 + i,
}));

// ---------- 2) quete_categories (46 thèmes, role subject) ----------
const catRows = THEMES.map((t, i) => {
  const d = DOM[t.domain];
  return {
    key: t.key, module: t.domain, name: t.name, name_en: null, short: null, icon: null,
    color: d.color, color_soft: d.color_soft, color_deep: d.color_deep, biome: null, biome_en: null,
    role: 'subject', board: true, default_on: false, lv2_member: false, enabled: true, ord: 100 + i,
  };
});

// ---------- 3) quete_themes (arbre complet, delete-all-then-insert) ----------
const NODES = [];
// scolaire
NODES.push({ key: 'scolaire', parent: null, kind: 'scolaire', name: 'Scolaire', name_en: 'School', emblem: '✎', color: '#4f7a4a', color_soft: '#b8d3b2', color_deep: '#16301a', biome: 'Cour de Récré', biome_en: 'Schoolyard', default_on: true, ord: 0 });
SCOLAIRE_LEAVES.forEach(([k, name], i) => NODES.push({ key: k, parent: 'scolaire', kind: 'theme', subject_key: k, name, ord: i }));
// domaines culture-G + leurs feuilles
DOMAINS.forEach((d, di) => {
  NODES.push({ key: d.key, parent: null, kind: 'domain', name: d.name, name_en: d.name_en, emblem: d.emblem, color: d.color, color_soft: d.color_soft, color_deep: d.color_deep, biome: d.biome, biome_en: d.biome_en, ord: 1 + di });
});
THEMES.forEach((t, i) => NODES.push({ key: t.key, parent: t.domain, kind: 'theme', subject_key: t.key, name: t.name, color: DOM[t.domain].color, ord: i }));
// pack bonus Harry Potter sous divertissement
NODES.push({ key: 'harrypotter', parent: 'divertissement_g', kind: 'integrale', name: 'Harry Potter', name_en: 'Harry Potter', emblem: '🪄', color: '#5b3a8c', color_soft: '#ddd2ec', color_deep: '#2e1c4a', biome: 'Château de Poudlard', biome_en: 'Hogwarts Castle', ord: 90 });
NODES.push({ key: 'hp_livre1', parent: 'harrypotter', kind: 'theme', subject_key: 'hp_livre1', name: 'Livre 1', name_en: 'Book 1', ord: 0 });

// path ltree calculé
const byKey = Object.fromEntries(NODES.map((n) => [n.key, n]));
function pathOf(key) {
  const segs = [];
  let cur = byKey[key];
  const seen = new Set();
  while (cur) { if (seen.has(cur.key)) throw new Error('cycle ' + cur.key); seen.add(cur.key); segs.unshift(cur.key); cur = cur.parent ? byKey[cur.parent] : null; }
  return segs.join('.');
}
const ASCII = /^[a-z0-9_]+$/;

// ---------- Validation ----------
const { data: existingCats, error: eCats } = await sb.from('quete_categories').select('key');
if (eCats) throw new Error('lecture categories: ' + eCats.message);
const knownSubjects = new Set([...(existingCats || []).map((c) => c.key), ...catRows.map((c) => c.key)]);
const problems = [];
for (const n of NODES) {
  if (!ASCII.test(n.key)) problems.push('key non-ascii: ' + n.key);
  if (n.parent && !byKey[n.parent]) problems.push('parent introuvable ' + n.key + ' → ' + n.parent);
  if (n.subject_key && !knownSubjects.has(n.subject_key)) problems.push('feuille ' + n.key + ' subject_key absent: ' + n.subject_key);
}
if (problems.length) { console.error('Validation KO:\n  - ' + problems.join('\n  - ')); process.exit(1); }

// ---------- Écriture ----------
{ const { error } = await sb.from('quete_modules').upsert(moduleRows, { onConflict: 'key' }); if (error) throw new Error('modules: ' + error.message); }
{ const { error } = await sb.from('quete_categories').upsert(catRows, { onConflict: 'key' }); if (error) throw new Error('categories: ' + error.message); }
// themes : remplace intégralement (l'arbre est autoritaire ici).
{ const { error } = await sb.from('quete_themes').delete().neq('key', '__none__'); if (error) throw new Error('del themes: ' + error.message); }
const themeRows = NODES.map((n) => ({
  key: n.key, path: pathOf(n.key), parent_key: n.parent ?? null, subject_key: n.subject_key ?? null,
  kind: n.kind, name: n.name, name_en: n.name_en ?? null, short: null, icon: null, emblem: n.emblem ?? null,
  color: n.color ?? null, color_soft: n.color_soft ?? null, color_deep: n.color_deep ?? null,
  biome: n.biome ?? null, biome_en: n.biome_en ?? null, default_on: n.default_on ?? false, enabled: true, ord: n.ord ?? 0,
}));
{ const { error } = await sb.from('quete_themes').insert(themeRows); if (error) throw new Error('ins themes: ' + error.message); }

console.log(`✓ ${moduleRows.length} modules, ${catRows.length} catégories, ${themeRows.length} nœuds d'arbre.`);
console.log(`  Domaines culture-G : ${DOMAINS.map((d) => d.key).join(', ')}`);
console.log(`  ${THEMES.length} thèmes jouables prêts à recevoir des questions.`);
