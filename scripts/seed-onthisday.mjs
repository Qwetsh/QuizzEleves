// Seed « Éphéméride » — NOUVEAU thème `ephemeride` (sous Histoire) : questions
// TEXTE « En quelle année cet événement s'est-il produit ? » (4 années au choix).
//
// Source : API Wikimedia « On this day » (fr) — événements historiques par date,
// en français, sans clé. Pas de média (donc pas de rate-limit de téléchargement).
//
// Idempotent : delete-then-insert du subject 'ephemeride'.
//   node scripts/seed-onthisday.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'ephemeride';
const UA = 'QueteDesMatieres-seed/1.0 (quiz éducatif; contact: enseignant)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Dates échantillonnées (2 par mois) pour varier les événements.
const DATES = [];
for (let m = 1; m <= 12; m++) for (const d of [7, 21]) DATES.push([m, d]);

// Distracteurs d'années : proches mais distincts (échelle selon l'ancienneté).
function yearDistractors(year) {
  const span = year < 1700 ? 60 : year < 1900 ? 25 : 12;
  const set = new Set([year]);
  const out = [];
  let guard = 0;
  while (out.length < 3 && guard++ < 50) {
    const delta = (1 + Math.floor(Math.random() * span)) * (Math.random() < 0.5 ? -1 : 1);
    const y = year + delta;
    if (y > 0 && y <= 2025 && !set.has(y)) { set.add(y); out.push(y); }
  }
  return out;
}

console.log(`→ Wikimedia « On this day » (fr) : ${DATES.length} dates…`);
const rows = [];
let ord = 0;
const usedTexts = new Set();
for (const [m, d] of DATES) {
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/fr/onthisday/events/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  let events = [];
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    events = (await r.json()).events || [];
  } catch (e) { console.warn(`  ✗ ${d}/${m} : ${e.message}`); await sleep(300); continue; }

  // On garde des événements « propres » : année ≥ 1200, texte court, non dupliqué.
  const good = events.filter((e) => e.year >= 1200 && e.text && e.text.length <= 130 && !usedTexts.has(e.text));
  for (const ev of shuffle(good).slice(0, 4)) {
    usedTexts.add(ev.text);
    const distr = yearDistractors(ev.year);
    if (distr.length < 3) continue;
    const opts = shuffle([ev.year, ...distr]);
    const correcte = opts.indexOf(ev.year) + 1;
    rows.push({
      pool: 'cycle4', subject: SUBJECT, level: null, t: 'Date', enabled: true, ord: ord++,
      q: `En quelle année ? « ${ev.text} »`,
      rep_a: String(opts[0]), rep_b: String(opts[1]), rep_c: String(opts[2]), rep_d: String(opts[3]),
      correcte, e: `${ev.text} — ${ev.year} (le ${d}/${m}).`,
    });
  }
  console.log(`  ✓ ${d}/${m} : ${good.length} événements`);
  await sleep(300);
}

console.log(`→ ${rows.length} questions prêtes. Remplacement en base…`);
{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT); if (error) { console.error('delete:', error.message); process.exit(1); } }
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
  inserted += Math.min(500, rows.length - i);
}
console.log(`✓ ${inserted} questions « ${SUBJECT} » insérées.`);
