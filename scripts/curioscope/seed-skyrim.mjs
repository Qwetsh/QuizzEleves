// Curioscope — SEED des spots « Skyrim / Bordeciel » dans quete_spots.
//
//   node scripts/curioscope/seed-skyrim.mjs [--dry-run]
//
// Univers skyrim : art de carte parchemin de la province de Bordeciel
// (The Elder Scrolls V), cf. src/data/universes.js. Les 31 lieux sont des LIEUX
// NOMMÉS (pas de photo) : render='label' (→ rowsToSpots met kind:'label' +
// showName:true ; le duel affiche « Place : X » et demande de pointer sur la
// carte, exactement comme la Terre du Milieu / les capitales du monde réel).
//
// Coordonnées (x,y) NORMALISÉES 0..1 = colonne/largeur, ligne/hauteur de l'image
// SOURCE (carte parchemin propre du jeu, 2560×1920). make-tiles n'a PAS
// redimensionné (image < 16384) NI recadré (art de carte, sans --ref) → ces
// proportions tombent DIRECTEMENT dans l'espace 0..1 de la carte tuilée. Mesurées
// sur crops HD puis VÉRIFIÉES par overlay (.tmp-skyrim/overlay.png). Colonne
// image_path NOT NULL → sentinelle 'label:'.
//
// IDEMPOTENT : delete-then-insert de tout l'univers 'skyrim'.
import { createClient } from '@supabase/supabase-js';
import { SKYRIM_SPOTS as SPOTS } from './skyrim-spots.mjs';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const UNIVERSE = 'skyrim';
const dryRun = process.argv.includes('--dry-run');

const rows = SPOTS.map(({ label, x, y }) => {
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw new Error(`coord hors bornes : ${label}`);
  return {
    universe: UNIVERSE,
    label,
    zone: 'label',
    cx: x.toFixed(5),
    cy: y.toFixed(5),
    image_path: 'label:',
    render: 'label',
    difficulte: 2,
    actif: true,
    meta: { kind: 'label' },
  };
});

console.log(`Skyrim : ${rows.length} spots à insérer.`);

if (dryRun) { console.log('[dry-run] aucune écriture.'); process.exit(0); }

const del = await sb.from('quete_spots').delete().eq('universe', UNIVERSE);
if (del.error) { console.error('✘ delete :', del.error.message); process.exit(1); }

const ins = await sb.from('quete_spots').insert(rows);
if (ins.error) { console.error('✘ insert :', ins.error.message); process.exit(1); }

const { count, error } = await sb
  .from('quete_spots')
  .select('*', { count: 'exact', head: true })
  .eq('universe', UNIVERSE);
if (error) { console.error('✘ count :', error.message); process.exit(1); }

console.log(`✔ ${rows.length} spots insérés → quete_spots (universe=${UNIVERSE}). Total en base : ${count}.`);
