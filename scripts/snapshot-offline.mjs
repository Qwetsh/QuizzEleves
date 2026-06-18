// Capture l'état de la base Supabase dans src/data/offlineSnapshot.json, au
// format INTERNE du jeu, pour le build hors ligne (`npm run build:offline`).
//
//   node scripts/snapshot-offline.mjs
//
// Nécessite le réseau (lecture seule, clé anon publique). À relancer chaque fois
// qu'on veut figer une nouvelle « release classe ». Les images d'objets
// uploadées (URL Storage) sont rapatriées en data URL base64 pour être 100 %
// autonomes (itemImg() sait déjà lire les data URL).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'offlineSnapshot.json');
const PAGE = 1000;

// Récupère toutes les lignes d'une table (paginé, pour ne jamais tronquer).
async function fetchAll(table, order = 'id') {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*')
      .order(order, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// --- Transforms : lignes DB -> format interne (miroir des logic/*Config.js) ---

function rowToQuestion(r) {
  const a = [r.rep_a, r.rep_b, r.rep_c, r.rep_d].filter((x) => x != null);
  return { q: r.q, a, c: (r.correcte || 1) - 1, e: r.e ?? '', t: r.t ?? '', level: r.level ?? null };
}
function groupQuestions(rows) {
  const data = { cycle4: {}, brevet: {} };
  const byPool = { cycle4: {}, brevet: {} };
  for (const r of rows) {
    if (r.enabled === false) continue;
    const pool = r.pool === 'brevet' ? 'brevet' : 'cycle4';
    (byPool[pool][r.subject] ||= []).push(r);
  }
  for (const pool of ['cycle4', 'brevet']) {
    for (const subject of Object.keys(byPool[pool])) {
      data[pool][subject] = byPool[pool][subject]
        .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map(rowToQuestion);
    }
  }
  return data;
}

function rowToItem(r) {
  return {
    name: r.name, desc: r.description ?? '', descExpert: r.desc_expert ?? '',
    set: r.set_key ?? undefined, icon: r.icon ?? undefined, img: r.img ?? undefined,
    slot: r.slot, rarity: r.rarity, price: r.price, lootOnly: !!r.loot_only,
    effects: Array.isArray(r.effects) ? r.effects : [],
    family: r.family || undefined, enchant: r.enchant || undefined,
  };
}

function rowToEvent(r) {
  return {
    name: r.name, icon: r.icon || '✨', desc: r.description || '',
    optional: r.optional !== false, weight: typeof r.weight === 'number' ? r.weight : 1,
    category: r.category || undefined, needsItems: !!r.needs_items,
    actions: Array.isArray(r.actions) ? r.actions : [], custom: true,
  };
}

function rowToRecipe(r) {
  return { id: r.key, ingredients: Array.isArray(r.ingredients) ? r.ingredients : [], potion: r.potion };
}

// Télécharge une image distante et la convertit en data URL base64 (autonome).
async function toDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buf.toString('base64')}`;
}

// --- Construction de l'instantané ---

const snapshot = {};

// Questions
const qRows = await fetchAll('quete_questions');
snapshot.questions = groupQuestions(qRows);
const qCount = Object.values(snapshot.questions).reduce(
  (n, pool) => n + Object.values(pool).reduce((m, list) => m + list.length, 0), 0);
console.log(`Questions : ${qCount}`);

// Objets (+ rapatriement des images uploadées en data URL)
const iRows = (await fetchAll('quete_items', 'ord')).filter((r) => r.enabled !== false)
  .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
const items = {};
let imgCount = 0;
for (const r of iRows) {
  const it = rowToItem(r);
  if (it.img && /^https?:/.test(it.img)) {
    try { it.img = await toDataUrl(it.img); imgCount += 1; }
    catch (e) { console.warn(`  image KO pour ${r.key} (${e.message}) → ignorée`); it.img = undefined; }
  }
  items[r.key] = it;
}
snapshot.items = items;
console.log(`Objets : ${Object.keys(items).length} (${imgCount} image(s) embarquée(s))`);

// Équilibrage (overrides : la ligne `current`)
const bal = await supabase.from('quete_balance').select('data').eq('id', 'current').maybeSingle();
if (bal.error) throw new Error(`quete_balance: ${bal.error.message}`);
snapshot.balance = bal.data?.data || {};
console.log(`Équilibrage : ${Object.keys(snapshot.balance).length} section(s) d'overrides`);

// Événements personnalisés
const eRows = (await fetchAll('quete_events', 'ord')).filter((r) => r.enabled !== false && r.key)
  .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
snapshot.events = Object.fromEntries(eRows.map((r) => [r.key, rowToEvent(r)]));
console.log(`Événements custom : ${Object.keys(snapshot.events).length}`);

// Recettes d'alchimie personnalisées
const rRows = (await fetchAll('quete_recipes', 'ord')).filter((r) => r.enabled !== false && r.key && r.potion)
  .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
snapshot.recipes = rRows.map(rowToRecipe);
console.log(`Recettes custom : ${snapshot.recipes.length}`);

writeFileSync(OUT, JSON.stringify(snapshot));
console.log(`\nInstantané écrit : ${OUT}`);
