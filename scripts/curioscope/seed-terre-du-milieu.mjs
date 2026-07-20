// Curioscope — SEED des spots « Terre du Milieu » dans la table quete_spots.
//
//   node scripts/curioscope/seed-terre-du-milieu.mjs [--dry-run]
//
// Source : .tmp-arda/pois.json (dépôt Jean-Tinland/middle-earth, GPL-3.0).
// Chaque POI porte position:[x%,y%] dans le cadre 1900×1300 de leur app —
// exactement le cadre de l'image tuilée (ratio 1.4615) — donc x = pos[0]/100,
// y = pos[1]/100 tombent DIRECTEMENT dans l'espace normalisé 0..1 de la carte.
//
// Ces spots sont des LIEUX NOMMÉS (pas de photo) : on les enregistre en
// render='label' (→ rowsToSpots leur met kind:'label'+showName:true ; le duel
// affiche « Place : X » et demande de pointer le lieu sur la carte parchemin).
// La colonne image_path est NOT NULL → on y stocke le sentinelle 'label:'
// (jamais résolu en URL pour un spot label).
//
// IDEMPOTENT : delete-then-insert de tout l'univers 'terre_du_milieu'.
// CURATION : on garde les POIs CANON (Tolkien) au nom non vide, en écartant
// les rivières (linéaires/ambiguës à pointer) et en dédoublonnant par nom.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const POIS = join(ROOT, '.tmp-arda', 'pois.json');

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const UNIVERSE = 'terre_du_milieu';
const dryRun = process.argv.includes('--dry-run');

if (!existsSync(POIS)) {
  console.error(`✘ Introuvable : ${POIS} (télécharge pois.json depuis Jean-Tinland/middle-earth)`);
  process.exit(1);
}

const { pois } = JSON.parse(readFileSync(POIS, 'utf8'));

// Difficulté par kind : les grandes régions/mers sont faciles à situer, les
// hameaux/lieux-dits sont plus pointus.
const DIFF = {
  region: 2, sea: 2, mountain: 2, forest: 2,
  city: 3, fortress: 3, 'common-place': 3,
  hamlet: 4,
};

// Curation : POIs CANON, au nom non vide, hors rivières (trait linéaire =
// point de pin ambigu). Dédoublonnage par nom (Mithlond/Umbar/Framsburg
// apparaissent 2×).
const seen = new Set();
const kept = [];
for (const p of pois) {
  const name = (p.name || '').trim();
  if (!name) continue;
  if (p.source !== 'Canon') continue;   // écarte les ajouts MERP obscurs
  if (p.kind === 'river') continue;      // rivières : point ambigu
  if (seen.has(name)) continue;
  const x = p.position[0] / 100;
  const y = p.position[1] / 100;
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) continue;
  seen.add(name);
  kept.push({
    universe: UNIVERSE,
    label: name,
    zone: p.kind,
    cx: x.toFixed(5),
    cy: y.toFixed(5),
    image_path: 'label:', // sentinelle (NOT NULL) ; non utilisé (spot label)
    render: 'label',
    difficulte: DIFF[p.kind] ?? 3,
    actif: true,
    meta: { kind: p.kind, source: p.source },
  });
}

const byKind = {};
kept.forEach((r) => { byKind[r.zone] = (byKind[r.zone] || 0) + 1; });
console.log(`Curation : ${kept.length} spots retenus`, byKind);

if (dryRun) {
  console.log('[dry-run] aucune écriture.');
  process.exit(0);
}

// Idempotence : purge l'univers puis réinsère.
const del = await sb.from('quete_spots').delete().eq('universe', UNIVERSE);
if (del.error) { console.error('✘ delete :', del.error.message); process.exit(1); }

const ins = await sb.from('quete_spots').insert(kept);
if (ins.error) { console.error('✘ insert :', ins.error.message); process.exit(1); }

const { count, error } = await sb
  .from('quete_spots')
  .select('*', { count: 'exact', head: true })
  .eq('universe', UNIVERSE);
if (error) { console.error('✘ count :', error.message); process.exit(1); }

console.log(`✔ ${kept.length} spots insérés → quete_spots (universe=${UNIVERSE}). Total en base : ${count}.`);
console.log('→ Recharge le jeu (le TBI rafraîchit quete_spots au démarrage).');
