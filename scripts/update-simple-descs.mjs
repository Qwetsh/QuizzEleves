// Régénère les descriptions « simples » (vues par les élèves) de TOUS les objets :
// texte général, SANS chiffres / % / dés. Le « Détail de l'effet » (bouton en
// jeu) reste précis (auto-généré depuis les effets, ou desc_expert si saisi).
//
// UPDATE par clé du seul champ `description` — n'écrase rien d'autre, idempotent.
//   node scripts/update-simple-descs.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// key -> description simple (sans chiffres, sans %, sans D6)
const DESCS = {
  // --- Équipement « classique » ---
  chapeauPaille: 'Tu as un peu plus de temps pour répondre.',
  plumeScribe: 'Chaque bonne réponse te rapporte quelques pièces.',
  lunettesLecture: 'Ton Indice élimine une mauvaise réponse de plus.',
  bandeauSage: 'Tu disposes de bien plus de temps pour répondre.',
  monocleDetective: 'Plus de temps pour répondre, et ton Indice est plus efficace.',
  couronneSavant: 'Un temps de réflexion généreux à chaque question.',
  bourseCuir: 'Chaque bonne réponse te rapporte quelques pièces.',
  amuletteFisc: 'Tu paies moins d’impôts et de taxes.',
  fanionSupporter: 'Tu voles davantage de pièces en remportant un duel.',
  banniereMarchand: 'Chaque bonne réponse te rapporte un joli pécule.',
  talismanOr: 'Impôts et taxes ne t’atteignent plus.',
  capeOmbre: 'On ne peut te dérober qu’une partie de ton or.',
  armureGarde: 'Ton or est impossible à voler.',
  etendardRoyal: 'Tu gagnes des pièces à chaque bonne réponse et paies moins d’impôts.',
  bottesUsees: 'Tu recules un peu moins en cas d’échec.',
  ancreMarine: 'La Tempête n’a plus d’effet sur toi.',
  bottesMontagne: 'Tu recules nettement moins en cas d’échec.',
  grappinVoyageur: 'Le Trou de l’oubli ne te renvoie plus tout au début.',
  eperonsDuel: 'Tu voles davantage de pièces en remportant un duel.',
  pegase: 'Tu recules moins et la Tempête ne t’atteint plus.',
  // --- Consommables « classiques » ---
  potionHate: 'Bondis de quelques cases en avant.',
  potionCelerite: 'Élance-toi de plusieurs cases.',
  elixirGeant: 'Fais un grand bond en avant.',
  painVoyageur: 'Empoche une poignée de pièces.',
  coffretEpices: 'Empoche une belle somme.',
  banquetPartage: 'Toutes les équipes reçoivent quelques pièces.',
  sablierPoche: 'Offre-toi plus de temps à ta prochaine question.',
  bouclierBois: 'Pare le prochain recul d’une mauvaise réponse.',
  cristalEnergie: 'Recharge un pouvoir de ton choix.',
  bombeFumigene: 'Déjoue le prochain pouvoir lancé contre toi.',
  feeFlacon: 'Recharge un pouvoir, pare ton prochain recul et gagne du temps.',
  // --- Pool « effets composables » ---
  peAssiduC: 'Récompense tes bonnes réponses enchaînées.',
  peAssiduR: 'Récompense généreusement tes bonnes réponses enchaînées.',
  peAssiduL: 'Récompense richement tes séries, parfois avec un peu de temps en bonus.',
  peLunettesC: 'Plus de temps, et un bonus si tu réponds juste régulièrement.',
  peLunettesR: 'Du temps en plus, récompensé par ta précision.',
  peLunettesL: 'Beaucoup de temps, et un gros bonus si tu es très précis.',
  peComebackC: 'Plus tu te trompes, plus tes bonnes réponses rapportent.',
  peComebackR: 'Tu recules moins, et tes erreurs passées te rapportent des pièces.',
  peComebackL: 'Plus tu rates, plus tu as de chances de trouver un équipement.',
  peEclairC: 'Plus tu réponds vite, plus tu gagnes de pièces.',
  peEclairR: 'Répondre vite augmente tes chances de trouver un consommable.',
  peEclairL: 'Répondre vite augmente tes chances de trouver un équipement.',
  peBesaceC: 'Tu trouves plus souvent des consommables.',
  peBesaceR: 'Tu trouves bien plus souvent des consommables.',
  peBesaceL: 'Tes séries augmentent tes chances de trouver des consommables.',
  peHeaumeC: 'Tu trouves plus souvent des équipements.',
  peHeaumeR: 'Tu trouves bien plus souvent des équipements.',
  peHeaumeL: 'Répondre vite augmente tes chances de trouver un équipement.',
  peMedailleC: 'Chaque bonne réponse te rapporte des pièces.',
  peMedailleR: 'Des pièces à chaque bonne réponse, et parfois un bouclier.',
  peMedailleL: 'Tes gains grandissent avec ta série, parfois avec du temps en bonus.',
  peMauditeC: 'Tes erreurs coûtent des pièces, mais tes séries t’aident à trouver des consommables.',
  peMauditeR: 'Tes erreurs coûtent cher, mais tes séries t’aident à trouver du butin.',
  peMauditeL: 'Une erreur te fait reculer, mais chaque bonne réponse rapporte gros.',
  peHasardC: 'Un bon jet de dé peut te rapporter des pièces.',
  peHasardR: 'Un bon jet de dé te rapporte des pièces.',
  peHasardL: 'Un très bon jet de dé recharge un pouvoir et te fait avancer.',
  peGrimoireC: 'Permet de changer ta question (même thème).',
  peGrimoireR: 'Permet de changer ta question pour le thème de ton choix.',
  peGrimoireL: 'Change ta question pour le thème de ton choix, avec du temps en plus.',
  peBourseC: 'Empoche une poignée de pièces, au petit bonheur.',
  peBourseR: 'Empoche une bonne poignée de pièces, au petit bonheur.',
  peBourseL: 'Un trésor d’autant plus gros que ta série est longue.',
  peParieurC: 'Tente ta chance pour empocher des pièces.',
  peParieurR: 'Lance le dé pour gagner plus ou moins de pièces.',
  peParieurL: 'Gros gain et bond en avant… ou petit recul.',
  peFioleC: 'Un peu de temps en plus à ta prochaine question.',
  peFioleR: 'Du temps en plus à ta prochaine question.',
  peFioleL: 'Beaucoup de temps en plus à ta prochaine question.',
  peBoisC: 'Pare ton prochain recul.',
  peBoisR: 'Pare tes prochains reculs.',
  peBoisL: 'Pare plusieurs reculs à venir.',
  peLesteC: 'Dérobe quelques pièces à une équipe.',
  peLesteR: 'Dérobe des pièces à une équipe, au petit bonheur.',
  peLesteL: 'Dérobe une part de l’or d’une équipe.',
  pePiegeC: 'Pose un piège qui fait reculer.',
  pePiegeR: 'Pose un piège qui fait reculer et coûte des pièces.',
  pePiegeL: 'Pose un piège vicieux : gros recul et perte de pièces.',
  peSerieC: 'Récompense tes bonnes réponses enchaînées.',
  peSerieR: 'Récompense ta série et te fait avancer.',
  peSerieL: 'Récompense richement ta série et recharge un pouvoir.',
};

const entries = Object.entries(DESCS);
let ok = 0, miss = 0;
for (const [key, description] of entries) {
  const { data, error } = await supabase
    .from('quete_items').update({ description }).eq('key', key).select('key');
  if (error) { console.error('✗', key, error.message); continue; }
  if (!data?.length) { console.warn('… clé absente en base :', key); miss++; continue; }
  ok++;
}
console.log(`Descriptions simples mises à jour : ${ok}/${entries.length}${miss ? ` (${miss} clés absentes)` : ''}`);
