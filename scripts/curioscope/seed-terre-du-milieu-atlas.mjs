// Curioscope — SEED des spots « Terre du Milieu ATLAS » dans quete_spots.
//
//   node scripts/curioscope/seed-terre-du-milieu-atlas.mjs [--dry-run]
//
// Univers terre_du_milieu_atlas : carte parchemin ALTERNATIVE (variante en test,
// cf. src/data/universes.js). Le cadrage diffère de la carte Jean-Tinland, donc
// les 175 spots de terre_du_milieu NE COLLENT PAS ici → jeu de spots PROPRE.
//
// Coordonnées (x,y) NORMALISÉES 0..1 = colonne/largeur, ligne/hauteur de l'image
// SOURCE tintée (8740×8208, ratio 1.0648). Comme make-tiles n'a PAS redimensionné
// (image < 16384), ces proportions tombent DIRECTEMENT dans l'espace 0..1 de la
// carte tuilée. Relevées à la main sur des crops HD (scripts arda-crop.mjs) puis
// VÉRIFIÉES/corrigées par overlay (arda-spots-overlay.mjs → .claude-screens/).
//
// LIEUX NOMMÉS (pas de photo) : render='label' (→ rowsToSpots met kind:'label' +
// showName:true ; le duel affiche « Place : X » et demande de pointer). Colonne
// image_path NOT NULL → sentinelle 'label:'.
//
// IDEMPOTENT : delete-then-insert de tout l'univers 'terre_du_milieu_atlas'.
import { createClient } from '@supabase/supabase-js';
import { ATLAS_SPOTS as SPOTS } from './arda-atlas-spots.mjs';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const UNIVERSE = 'terre_du_milieu_atlas';
const dryRun = process.argv.includes('--dry-run');

const rows = SPOTS.map(([label, x, y, kind, diff]) => {
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw new Error(`coord hors bornes : ${label}`);
  return {
    universe: UNIVERSE,
    label,
    zone: kind,
    cx: x.toFixed(5),
    cy: y.toFixed(5),
    image_path: 'label:',
    render: 'label',
    difficulte: diff,
    actif: true,
    meta: { kind },
  };
});

console.log(`Atlas : ${rows.length} spots à insérer.`);

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
