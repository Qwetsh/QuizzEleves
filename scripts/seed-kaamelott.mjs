// Pack bonus « Kaamelott » : sous-thème de Séries TV (feuille enfant de series_tv,
// exactement comme pokemon/skyrim/world_of_warcraft sont enfants de jeux_video).
// Enregistre la catégorie + le nœud d'arbre (upsert, n'écrase QUE la clé kaamelott),
// puis charge les questions depuis scripts/generated/pool/kaamelott.json
// (delete-then-insert par subject). Ne touche à AUCUN autre thème.
//
// NB : ne PAS passer par seed-pool-taxonomy.mjs (il fait un delete-all de
// quete_themes et effacerait tous les packs bonus ajoutés hors taxonomie).
//
//   node scripts/seed-kaamelott.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const SUBJECT = 'kaamelott';
const COLOR = '#d2622b', COLOR_SOFT = '#f0c9a0', COLOR_DEEP = '#3a1c0e'; // teinte Divertissement/Culture pop

// ---------- 1) Catégorie (role subject) ----------
const catRow = {
  key: SUBJECT, module: 'divertissement_g', name: 'Kaamelott', name_en: null, short: null, icon: null,
  color: COLOR, color_soft: COLOR_SOFT, color_deep: COLOR_DEEP, biome: null, biome_en: null,
  role: 'subject', board: true, default_on: false, lv2_member: false, enabled: true, ord: 136,
};
{ const { error } = await sb.from('quete_categories').upsert(catRow, { onConflict: 'key' }); if (error) throw new Error('categorie: ' + error.message); }

// ---------- 2) Nœud d'arbre (feuille enfant de series_tv) ----------
const themeRow = {
  key: SUBJECT, path: 'divertissement_g.series_tv.kaamelott', parent_key: 'series_tv', subject_key: SUBJECT,
  kind: 'theme', name: 'Kaamelott', name_en: null, short: null, icon: null, emblem: null,
  color: COLOR, color_soft: COLOR_SOFT, color_deep: COLOR_DEEP, biome: null, biome_en: null,
  default_on: false, enabled: true, ord: 0, hard: false,
};
{ const { error } = await sb.from('quete_themes').upsert(themeRow, { onConflict: 'key' }); if (error) throw new Error('theme: ' + error.message); }

// ---------- 3) Questions (mélange des positions + recalcul de l'index) ----------
const DIR = path.join(process.cwd(), 'scripts', 'generated', 'pool');
const arr = JSON.parse(readFileSync(path.join(DIR, `${SUBJECT}.json`), 'utf8'));
const valid = (qq) => qq && typeof qq.q === 'string' && qq.q.trim()
  && Array.isArray(qq.a) && qq.a.length === 4 && qq.a.every((x) => typeof x === 'string' && x.trim())
  && Number.isInteger(qq.correct) && qq.correct >= 0 && qq.correct <= 3;

function shuffleAns(qq) {
  const idx = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { a: idx.map((k) => qq.a[k]), correct: idx.indexOf(qq.correct) };
}

const good = arr.filter(valid);
const skipped = arr.length - good.length;
const rows = good.map((qq, i) => {
  const s = shuffleAns(qq);
  return {
    pool: 'cycle4', subject: SUBJECT, level: null, q: qq.q.trim(),
    rep_a: s.a[0], rep_b: s.a[1], rep_c: s.a[2], rep_d: s.a[3],
    correcte: s.correct + 1, e: qq.e ?? null, t: null,
    difficulte: Number.isInteger(qq.difficulte) ? qq.difficulte : null,
    generalite: Number.isInteger(qq.generalite) ? qq.generalite : null,
    enabled: true, ord: i,
  };
});

{ const { error } = await sb.from('quete_questions').delete().eq('subject', SUBJECT); if (error) throw new Error('del questions: ' + error.message); }
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) throw new Error('insert questions: ' + error.message);
}

console.log(`✓ Thème « Kaamelott » enregistré (catégorie + nœud sous series_tv).`);
console.log(`✓ ${rows.length} questions insérées${skipped ? ` (${skipped} écartées)` : ''}.`);
