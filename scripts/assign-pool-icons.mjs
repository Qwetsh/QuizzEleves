// Affecte les 36 nouvelles icônes (grimoires/amulettes/anneaux) aux objets du
// pool « effets composables » par thème et slot. UPDATE par clé du seul champ
// `img` (= clé d'asset embarqué, fichier src/assets/items/<img>.png). Idempotent.
//   node scripts/assign-pool-icons.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// key -> clé d'image embarquée
const IMG = {
  // Grimoires (livres) → objets « changer la question » (body)
  peGrimoireC: 'grimoire02', // Parchemin corné (cuir brun, humble)
  peGrimoireR: 'grimoire06', // Carnet d'astuces (lune/étoiles)
  peGrimoireL: 'grimoire01', // Grimoire des Savoirs (arcane violet, grandiose)
  // Anneaux de chance (head)
  peHasardC: 'anneau02',     // Bague porte-bonheur (argent, modeste)
  peHasardR: 'anneau01',     // Anneau chanceux (or + rubis)
  peHasardL: 'anneau08',     // Anneau du Destin (orbe galactique)
  // Anneaux maudits (head)
  peMauditeC: 'anneau09',    // Anneau terni (sombre, fumée)
  peMauditeR: 'anneau11',    // Diadème fêlé (cristal d'argent)
  peMauditeL: 'anneau10',    // Couronne du Roi Déchu (couronne dorée)
  // Amulettes (pendentifs) → slot « Amulette » (feet)
  peComebackC: 'amulette01', // Patte de lapin (gemme verte)
  peComebackR: 'amulette09', // Trèfle fané (feuille verte)
  peComebackL: 'amulette04', // Amulette du Phénix (soleil doré)
  peEclairC: 'amulette05',   // Sandales rapides (boussole)
  peEclairR: 'amulette12',   // Bottes ailées (médaillon étoilé)
  peEclairL: 'amulette02',   // Bottes de Mercure (gemme bleue)
  peMedailleC: 'amulette06', // Ruban de mérite (scarabée)
  peMedailleR: 'amulette08', // Médaille d'argent (cercle arcanique)
  peMedailleL: 'amulette11', // Trophée du Champion (or/ambre)
};

const entries = Object.entries(IMG);
let ok = 0, miss = 0;
for (const [key, img] of entries) {
  const { data, error } = await supabase
    .from('quete_items').update({ img }).eq('key', key).select('key');
  if (error) { console.error('✗', key, error.message); continue; }
  if (!data?.length) { console.warn('… clé absente en base :', key); miss++; continue; }
  ok++;
}
console.log(`Icônes affectées : ${ok}/${entries.length}${miss ? ` (${miss} clés absentes)` : ''}`);
