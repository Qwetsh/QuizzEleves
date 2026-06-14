// Pool d'objets « nouvelle génération » exploitant le moteur d'effets étendu
// (dés, valeurs à l'échelle série/précision/imprécision/%temps, probabilité,
// déclencheurs on:roll/correct/wrong/question, lootBonus, pièges...).
//
// UPSERT par clé (préfixe `pe`) : n'écrase QUE ces objets, laisse le reste de la
// base intact (la DB est la source de vérité). Idempotent — relançable.
//
//   node scripts/seed-pool-effets.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Raccourcis valeurs à l'échelle.
const sc = (per, factor, base = 0) => (base ? { per, factor, base } : { per, factor });
// Raccourcis actions.
const gain = (n) => ({ action: 'money', mode: 'gain', target: 'self', n, unit: 'flat' });
const lose = (n) => ({ action: 'money', mode: 'lose', target: 'self', n, unit: 'flat' });
const fwd = (n) => ({ action: 'move', target: 'self', dir: 'forward', n });
const back = (n) => ({ action: 'move', target: 'self', dir: 'back', n });

// Liste : [key, name, icon, slot, rarity, price, desc, effects]
const DEFS = [
  // ===================== ÉQUIPEMENT =====================
  // 1. Plume de l'Assidu — or/bonne réponse à l'échelle de la série
  ['peAssiduC', "Plume de l'apprenti", '🪶', 'head', 'commun', 12, "Gagne 1 pièce par bonne réponse d'affilée.", [{ type: 'moneyPerCorrect', value: sc('streak', 1) }]],
  ['peAssiduR', "Plume d'érudit", '🪶', 'head', 'rare', 35, "Gagne 2 pièces par bonne réponse d'affilée.", [{ type: 'moneyPerCorrect', value: sc('streak', 2) }]],
  ['peAssiduL', 'Plume du Grand Sage', '🖋️', 'head', 'legendaire', 60, "3 pièces par bonne réponse d'affilée, et 20% de +5s sur une bonne réponse.", [{ type: 'moneyPerCorrect', value: sc('streak', 3) }, { kind: 'trigger', on: 'correct', chance: 0.2, do: [{ action: 'extraTime', n: 5 }] }]],

  // 2. Lunettes de Précision — timer à l'échelle de la précision
  ['peLunettesC', 'Besicles studieuses', '👓', 'head', 'commun', 12, '+2s au timer, +1s tous les ~33% de précision.', [{ type: 'timerBonus', value: sc('precision', 0.03, 2) }]],
  ['peLunettesR', "Lunettes de l'analyste", '👓', 'head', 'rare', 35, '+3s au timer, bonus selon ta précision.', [{ type: 'timerBonus', value: sc('precision', 0.05, 3) }]],
  ['peLunettesL', 'Monocle du Maître', '🧐', 'head', 'legendaire', 60, '+5s au timer, gros bonus si ta précision est élevée.', [{ type: 'timerBonus', value: sc('precision', 0.08, 5) }]],

  // 3. Talisman du Maladroit — comeback (à l'échelle de l'imprécision)
  ['peComebackC', 'Patte de lapin', '🐾', 'feet', 'commun', 12, "Plus tu te trompes, plus tu gagnes de pièces par bonne réponse.", [{ type: 'moneyPerCorrect', value: sc('imprecision', 0.05) }]],
  ['peComebackR', 'Trèfle fané', '🍀', 'feet', 'rare', 32, 'Recul −1, et des pièces selon ton imprécision.', [{ type: 'reculReduction', value: 1 }, { type: 'moneyPerCorrect', value: sc('imprecision', 0.1) }]],
  ['peComebackL', 'Amulette du Phénix', '🔥', 'feet', 'legendaire', 60, "Plus tu rates, plus tu as de chance de looter un équipement.", [{ type: 'lootBonusEquipment', value: sc('imprecision', 0.5) }]],

  // 4. Bottes de l'Éclair — à l'échelle du temps restant
  ['peEclairC', 'Sandales rapides', '👟', 'feet', 'commun', 13, 'Des pièces selon ta rapidité (% temps restant).', [{ type: 'moneyPerCorrect', value: sc('timeleft', 0.1) }]],
  ['peEclairR', 'Bottes ailées', '🥾', 'feet', 'rare', 38, 'Chance de loot consommable = % de temps restant.', [{ type: 'lootBonusConsumable', value: sc('timeleft', 1) }]],
  ['peEclairL', 'Bottes de Mercure', '⚡', 'feet', 'legendaire', 60, 'Chance de loot équipement = % de temps restant (instantané = garanti).', [{ type: 'lootBonusEquipment', value: sc('timeleft', 1) }]],

  // 5. Besace du Chineur — lootBonus consommable
  ['peBesaceC', 'Petite besace', '🎒', 'body', 'commun', 12, '+10% de chance de looter un consommable.', [{ type: 'lootBonusConsumable', value: 10 }]],
  ['peBesaceR', 'Sacoche du marchand', '👝', 'body', 'rare', 34, '+25% de chance de looter un consommable.', [{ type: 'lootBonusConsumable', value: 25 }]],
  ['peBesaceL', "Corne d'abondance", '🌽', 'body', 'legendaire', 60, "+5% de loot consommable par bonne réponse d'affilée.", [{ type: 'lootBonusConsumable', value: sc('streak', 5) }]],

  // 6. Heaume de l'Aventurier — lootBonus équipement
  ['peHeaumeC', "Bonnet d'éclaireur", '🧢', 'head', 'commun', 12, '+10% de chance de looter un équipement.', [{ type: 'lootBonusEquipment', value: 10 }]],
  ['peHeaumeR', 'Casque renforcé', '⛑️', 'head', 'rare', 34, '+25% de chance de looter un équipement.', [{ type: 'lootBonusEquipment', value: 25 }]],
  ['peHeaumeL', 'Heaume du Conquérant', '🪖', 'head', 'legendaire', 60, 'Chance de loot équipement = % de temps restant.', [{ type: 'lootBonusEquipment', value: sc('timeleft', 1) }]],

  // 7. Médaille du Champion — on:correct
  ['peMedailleC', 'Ruban de mérite', '🎗️', 'feet', 'commun', 13, 'Gagne 3 pièces à chaque bonne réponse.', [{ kind: 'trigger', on: 'correct', do: [gain(3)] }]],
  ['peMedailleR', "Médaille d'argent", '🥈', 'feet', 'rare', 36, '6 pièces par bonne réponse, et 25% de bouclier.', [{ kind: 'trigger', on: 'correct', do: [gain(6)] }, { kind: 'trigger', on: 'correct', chance: 0.25, do: [{ action: 'shieldNext', n: 1 }] }]],
  ['peMedailleL', 'Trophée du Champion', '🏆', 'feet', 'legendaire', 60, "Pièces = ta série, et 20% de +5s à la bonne réponse.", [{ kind: 'trigger', on: 'correct', do: [gain(sc('streak', 1))] }, { kind: 'trigger', on: 'correct', chance: 0.2, do: [{ action: 'extraTime', n: 5 }] }]],

  // 8. Couronne Maudite — on:wrong (malus) compensé par du loot/bonus
  ['peMauditeC', 'Anneau terni', '💍', 'head', 'commun', 12, "Perds 3 pièces à l'erreur, mais +5% loot conso par série.", [{ kind: 'trigger', on: 'wrong', do: [lose(3)] }, { type: 'lootBonusConsumable', value: sc('streak', 5) }]],
  ['peMauditeR', 'Diadème fêlé', '👑', 'head', 'rare', 33, "Perds 5 pièces à l'erreur, mais +loot conso & équip par série.", [{ kind: 'trigger', on: 'wrong', do: [lose(5)] }, { type: 'lootBonusConsumable', value: sc('streak', 4) }, { type: 'lootBonusEquipment', value: sc('streak', 4) }]],
  ['peMauditeL', 'Couronne du Roi Déchu', '💀', 'head', 'legendaire', 60, "Recul 1 à l'erreur, mais 3 pièces/bonne réponse + 5 à chaque bonne réponse.", [{ kind: 'trigger', on: 'wrong', do: [back(1)] }, { type: 'moneyPerCorrect', value: 3 }, { kind: 'trigger', on: 'correct', do: [gain(5)] }]],

  // 9. Anneau du Hasard — on:roll (selon le dé)
  ['peHasardC', 'Bague porte-bonheur', '🍀', 'head', 'commun', 12, 'Si tu fais 6 au dé : +10 pièces.', [{ kind: 'trigger', on: 'roll', values: [6], do: [gain(10)] }]],
  ['peHasardR', 'Anneau chanceux', '💍', 'head', 'rare', 33, 'Si tu fais 5-6 : gagne 1D10 pièces.', [{ kind: 'trigger', on: 'roll', values: [5, 6], do: [gain('d10')] }]],
  ['peHasardL', 'Anneau du Destin', '🌀', 'head', 'legendaire', 60, 'Si tu fais 4-5-6 : recharge un pouvoir et avance d\'1 case.', [{ kind: 'trigger', on: 'roll', values: [4, 5, 6], do: [{ action: 'gainCharge' }, fwd(1)] }]],

  // 10. Grimoire des Choix — on:question (bouton changer la question)
  ['peGrimoireC', 'Parchemin corné', '📜', 'body', 'commun', 14, 'Bouton « changer la question » (même thème).', [{ kind: 'trigger', on: 'question', do: [{ action: 'rerollQuestion', subject: 'same' }] }]],
  ['peGrimoireR', "Carnet d'astuces", '📓', 'body', 'rare', 36, 'Bouton « changer la question » (thème au choix).', [{ kind: 'trigger', on: 'question', do: [{ action: 'rerollQuestion', subject: 'choose' }] }]],
  ['peGrimoireL', 'Grimoire des Savoirs', '📖', 'body', 'legendaire', 60, 'Changer la question (thème au choix) + 3s de timer.', [{ kind: 'trigger', on: 'question', do: [{ action: 'rerollQuestion', subject: 'choose' }] }, { type: 'timerBonus', value: 3 }]],

  // ===================== CONSOMMABLES =====================
  // 11. Bourse Mystère — gainMoney (dé / échelle)
  ['peBourseC', 'Petite bourse', '💰', 'consumable', 'commun', 10, 'Gagne 1D6 pièces.', [{ type: 'gainMoney', value: 'd6' }]],
  ['peBourseR', 'Bourse rebondie', '💰', 'consumable', 'rare', 22, 'Gagne 1D10 pièces.', [{ type: 'gainMoney', value: 'd10' }]],
  ['peBourseL', 'Coffre du Dragon', '🐉', 'consumable', 'legendaire', 45, "Gagne 1D10 + 2 pièces par bonne réponse d'affilée.", [{ type: 'gainMoney', value: 'd10' }, { type: 'gainMoney', value: sc('streak', 2) }]],

  // 12. Dé du Parieur — chance / table d6
  ['peParieurC', 'Pièce truquée', '🪙', 'consumable', 'commun', 10, '50% de chance de gagner 15 pièces.', [{ kind: 'trigger', on: 'use', chance: 0.5, do: [gain(15)], else: [] }]],
  ['peParieurR', 'Dé du parieur', '🎲', 'consumable', 'rare', 20, 'Lance un dé : 1 rien, 2-4 +10, 5-6 +25 pièces.', [{ kind: 'trigger', on: 'use', roll: 'd6', table: { '1': [], '2-4': [gain(10)], '5-6': [gain(25)] } }]],
  ['peParieurL', 'Roue du Destin', '🎡', 'consumable', 'legendaire', 40, '60% : +30 pièces et avance 2. Sinon : recul 1.', [{ kind: 'trigger', on: 'use', chance: 0.6, do: [gain(30), fwd(2)], else: [back(1)] }]],

  // 13. Fiole du Vif — extraTime (dé)
  ['peFioleC', "Gorgée d'énergie", '⏳', 'consumable', 'commun', 10, '+1D4 s à la prochaine question.', [{ type: 'extraTime', value: 'd4' }]],
  ['peFioleR', 'Élixir vif', '⏳', 'consumable', 'rare', 18, '+1D6 s à la prochaine question.', [{ type: 'extraTime', value: 'd6' }]],
  ['peFioleL', 'Sablier suspendu', '⌛', 'consumable', 'legendaire', 35, '+1D10 s à la prochaine question.', [{ type: 'extraTime', value: 'd10' }]],

  // 14. Talisman de Bois — shieldNext
  ['peBoisC', 'Éclat de bois', '🪵', 'consumable', 'commun', 10, 'Annule le prochain recul.', [{ type: 'shieldNext', value: 1 }]],
  ['peBoisR', 'Targe de bois', '🛡️', 'consumable', 'rare', 20, 'Annule 1D2 prochains reculs.', [{ type: 'shieldNext', value: 'd2' }]],
  ['peBoisL', 'Égide ancestrale', '🛡️', 'consumable', 'legendaire', 38, 'Annule les 3 prochains reculs.', [{ type: 'shieldNext', value: 3 }]],

  // 15. Main Leste — vol ciblé
  ['peLesteC', 'Doigts agiles', '🤏', 'consumable', 'commun', 12, 'Vole 10 pièces à une équipe.', [{ kind: 'trigger', on: 'use', do: [{ action: 'money', mode: 'steal', target: 'target', n: 10, unit: 'flat' }] }]],
  ['peLesteR', 'Main leste', '✋', 'consumable', 'rare', 24, 'Vole 1D10 pièces à une équipe.', [{ kind: 'trigger', on: 'use', do: [{ action: 'money', mode: 'steal', target: 'target', n: 'd10', unit: 'flat' }] }]],
  ['peLesteL', 'Gant du Voleur', '🧤', 'consumable', 'legendaire', 42, "Vole 20% de l'or d'une équipe.", [{ kind: 'trigger', on: 'use', do: [{ action: 'money', mode: 'steal', target: 'target', n: 20, unit: 'percent' }] }]],

  // 16. Piège du Filou — placeTrap
  ['pePiegeC', 'Caltrop', '🪤', 'consumable', 'commun', 12, 'Pose un piège : recul 2 cases.', [{ kind: 'trigger', on: 'use', do: [{ action: 'placeTrap', trap: { label: 'Caltrop', icon: '🪤', do: [back(2)] } }] }]],
  ['pePiegeR', 'Collet rusé', '🥅', 'consumable', 'rare', 26, 'Pose un piège : recul 1D4 + perte de 5 pièces.', [{ kind: 'trigger', on: 'use', do: [{ action: 'placeTrap', trap: { label: 'Collet', icon: '🪤', do: [back('d4'), lose(5)] } }] }]],
  ['pePiegeL', 'Piège du Maître Filou', '💥', 'consumable', 'legendaire', 44, 'Pose un piège vicieux : recul 3 + perte de 1D10 pièces.', [{ kind: 'trigger', on: 'use', do: [{ action: 'placeTrap', trap: { label: 'Piège vicieux', icon: '💥', do: [back(3), lose('d10')] } }] }]],

  // 17. Élixir de Série — exploite la série
  ['peSerieC', "Tonique d'élan", '🧪', 'consumable', 'commun', 12, "Gagne 2 pièces par bonne réponse d'affilée.", [{ type: 'gainMoney', value: sc('streak', 2) }]],
  ['peSerieR', 'Potion de momentum', '🧪', 'consumable', 'rare', 24, "Gagne 3 pièces/série et avance d'1 case.", [{ type: 'gainMoney', value: sc('streak', 3) }, { type: 'moveForward', value: 1 }]],
  ['peSerieL', 'Nectar du Prodige', '🍶', 'consumable', 'legendaire', 45, '4 pièces/série + recharge un pouvoir.', [{ type: 'gainMoney', value: sc('streak', 4) }, { type: 'gainCharge', value: 1 }]],
];

const rows = DEFS.map(([key, name, icon, slot, rarity, price, desc, effects], i) => ({
  key,
  name,
  description: desc,
  icon,
  img: null,
  slot,
  rarity,
  price,
  loot_only: rarity === 'legendaire', // légendaires hors boutique (règle existante)
  effects,
  enabled: true,
  ord: 1000 + i, // après le catalogue existant
}));

console.log(`Préparé : ${rows.length} objets (préfixe pe).`);

// UPSERT par clé — n'écrase QUE ces objets, le reste de la base est intact.
const { error } = await supabase.from('quete_items').upsert(rows, { onConflict: 'key' });
if (error) { console.error('UPSERT échec :', error.message); process.exit(1); }

const { count } = await supabase.from('quete_items').select('*', { count: 'exact', head: true });
console.log(`Terminé. ${rows.length} objets du pool insérés/à jour. Total en base : ${count}.`);
