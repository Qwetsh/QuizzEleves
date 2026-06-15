// Pool v3 : pièces de SETS (bonus à 2/3), consommables à DURÉE (buffs) et objets
// « quand je réponds bien en X » + autres déclencheurs. UPSERT par clé (idempotent).
//   node scripts/seed-pool-v3.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Raccourcis
const gain = (n) => ({ action: 'money', mode: 'gain', target: 'self', n, unit: 'flat' });
const fwd = (n) => ({ action: 'move', target: 'self', dir: 'forward', n });
const lootC = { action: 'loot', category: 'consumable' };
const onCorrect = (subject, ...doActs) => ({ kind: 'trigger', on: 'correct', ...(subject ? { subject } : {}), do: doActs });
const onTrig = (on, ...doActs) => ({ kind: 'trigger', on, do: doActs });
const buff = (type, turns, extra = {}) => ({ action: 'buff', target: extra.target || 'self', buff: { type, turns, ...(extra.n != null ? { n: extra.n } : {}), ...(extra.subject ? { subject: extra.subject } : {}) } });
const useBuff = (...doActs) => ({ kind: 'trigger', on: 'use', do: doActs });

// [key, name, icon, img, slot, rarity, price, set, desc, effects]
const DEFS = [
  // ===================== SETS (3 pièces chacun) =====================
  // Nature
  ['setNatureHead', 'Couronne de feuillage', '🌿', null, 'head', 'rare', 14, 'nature', 'Un peu plus de temps pour répondre.', [{ type: 'timerBonus', value: 1 }]],
  ['setNatureBody', 'Tunique de lierre', '🍃', null, 'body', 'rare', 14, 'nature', 'Tu trouves un peu plus souvent des consommables.', [{ type: 'lootBonusConsumable', value: 10 }]],
  ['setNatureFeet', 'Sandales sylvestres', '🌱', 'amulette09', 'feet', 'rare', 14, 'nature', 'Tu recules un peu moins en cas d’échec.', [{ type: 'reculReduction', value: 1 }]],
  // Marchand
  ['setMarchandHead', 'Visière du négociant', '🧢', null, 'head', 'rare', 14, 'marchand', 'Chaque bonne réponse rapporte une pièce de plus.', [{ type: 'moneyPerCorrect', value: 1 }]],
  ['setMarchandBody', 'Veste du négociant', '🧥', null, 'body', 'rare', 14, 'marchand', 'Tu paies moins d’impôts.', [{ type: 'taxReduction', value: 20 }]],
  ['setMarchandFeet', 'Bourse de ceinture', '👛', null, 'feet', 'rare', 14, 'marchand', 'Tu voles un peu plus en duel.', [{ type: 'fightStealBonus', value: 1 }]],
  // Explorateur
  ['setExploHead', "Chapeau d'explorateur", '🎩', null, 'head', 'rare', 14, 'explorateur', 'Un peu plus de temps pour répondre.', [{ type: 'timerBonus', value: 2 }]],
  ['setExploBody', 'Veste de baroudeur', '🦺', null, 'body', 'rare', 14, 'explorateur', 'Tu recules un peu moins.', [{ type: 'reculReduction', value: 1 }]],
  ['setExploFeet', 'Bottes de marche', '🥾', null, 'feet', 'rare', 14, 'explorateur', 'Tu trouves un peu plus souvent des équipements.', [{ type: 'lootBonusEquipment', value: 10 }]],
  // Sage
  ['setSageHead', 'Bonnet du sage', '🧠', null, 'head', 'rare', 14, 'sage', 'Ton Indice élimine une mauvaise réponse de plus.', [{ type: 'indiceBoost', value: 1 }]],
  ['setSageBody', 'Robe du sage', '🥼', null, 'body', 'rare', 14, 'sage', 'Un peu plus de temps pour répondre.', [{ type: 'timerBonus', value: 2 }]],
  ['setSageFeet', 'Amulette de sagesse', '📿', 'amulette08', 'feet', 'rare', 14, 'sage', 'Chaque bonne réponse rapporte une pièce de plus.', [{ type: 'moneyPerCorrect', value: 1 }]],
  // Duelliste
  ['setDuelHead', 'Heaume du duelliste', '🪖', null, 'head', 'rare', 14, 'duelliste', 'Tu voles un peu plus en duel.', [{ type: 'fightStealBonus', value: 1 }]],
  ['setDuelBody', 'Cuirasse du duelliste', '🛡️', null, 'body', 'rare', 14, 'duelliste', 'On te vole moins d’or.', [{ type: 'stealProtection', value: 20 }]],
  ['setDuelFeet', 'Éperons de duel', '🗡️', null, 'feet', 'rare', 14, 'duelliste', 'Tu voles un peu plus en duel.', [{ type: 'fightStealBonus', value: 1 }]],

  // ===================== CONSOMMABLES À DURÉE (buffs) =====================
  ['cdConcentration', 'Tonique d’or', '🥤', null, 'consumable', 'rare', 16, null, 'Pendant quelques tours, chaque bonne réponse rapporte plus d’or.', [useBuff(buff('themeBonus', 3, { n: 5 }))]],
  ['cdEnvol', 'Plume d’envol', '🪶', null, 'consumable', 'rare', 18, null, 'Pendant quelques tours, tu avances à chaque bonne réponse.', [useBuff(buff('advanceOnCorrect', 3, { n: 'd4' }))]],
  ['cdGarde', 'Amulette de garde', '🛟', null, 'consumable', 'rare', 18, null, 'Pendant quelques tours, tu ne recules plus en cas d’erreur.', [useBuff(buff('noRecul', 2))]],
  ['cdMalediction', 'Sort de malédiction', '💸', null, 'consumable', 'rare', 20, null, 'Pendant quelques tours, une équipe adverse perd de l’or à chaque erreur.', [useBuff(buff('loseOnWrong', 3, { n: 8, target: 'target' }))]],
  ['cdBoussoleFolle', 'Boussole folle', '🧭', null, 'consumable', 'rare', 18, null, 'Pendant quelques tours, une équipe adverse ne choisit plus sa voie (au hasard).', [useBuff(buff('randomPath', 3, { target: 'target' }))]],

  // ===================== « QUAND JE RÉPONDS BIEN EN X » + autres =====================
  ['ocFrancais', 'Sceau du Scriptorium', '📜', null, 'head', 'rare', 22, null, 'Quand tu réponds bien en Français, tu gagnes de l’or.', [onCorrect('francais', gain(6))]],
  ['ocMaths', 'Compas doré', '📐', null, 'head', 'rare', 22, null, 'Quand tu réponds bien en Maths, tu gagnes de l’or.', [onCorrect('maths', gain(6))]],
  ['ocHistoire', 'Médaille d’Histoire', '🏛️', null, 'feet', 'rare', 24, null, 'Quand tu réponds bien en Histoire, tu peux trouver un consommable.', [{ kind: 'trigger', on: 'correct', subject: 'histoire', chance: 0.35, do: [lootC] }]],
  ['ocGeo', 'Boussole d’Émeraude', '🧭', null, 'feet', 'rare', 22, null, 'Quand tu réponds bien en Géographie, tu avances d’une case.', [onCorrect('geographie', fwd(1))]],
  ['ocSvt', 'Loupe du naturaliste', '🔬', null, 'body', 'rare', 22, null, 'Quand tu réponds bien en SVT, tu peux trouver un consommable.', [{ kind: 'trigger', on: 'correct', subject: 'svt', chance: 0.35, do: [lootC] }]],
  ['ocAnglais', 'Rose des Tudor', '🌹', null, 'body', 'rare', 22, null, 'Quand tu réponds bien en Anglais, tu gagnes de l’or.', [onCorrect('anglais', gain(6))]],
  // Autres déclencheurs
  ['tgVainqueur', 'Gantelet du vainqueur', '🥊', null, 'body', 'legendaire', 34, null, 'Quand tu gagnes un duel, tu rafles de l’or.', [onTrig('fightWin', gain(15))]],
  ['tgConsolation', 'Talisman du perdant', '🍀', null, 'feet', 'rare', 22, null, 'Quand tu perds un duel, tu avances (lot de consolation).', [onTrig('fightLose', fwd(1))]],
  ['tgParieur', 'Anneau du parieur', '💍', 'anneau01', 'head', 'rare', 26, null, 'Si tu fais 6 au dé, tu trouves un objet.', [{ kind: 'trigger', on: 'roll', values: [6], do: [lootC] }]],
  ['tgResilience', 'Châle de résilience', '🧣', null, 'body', 'commun', 16, null, 'Même quand tu rates, tu récupères un peu d’or.', [onTrig('wrong', gain(3))]],
  ['tgVagabond', 'Bottes vagabondes', '👢', null, 'feet', 'commun', 14, null, 'Aux carrefours, ta voie est choisie au hasard.', [{ type: 'randomPath', value: 1 }]],
];

const rows = DEFS.map(([key, name, icon, img, slot, rarity, price, set, desc, effects], i) => ({
  key, name, description: desc, icon, img, slot, rarity, price,
  set_key: set || null,
  loot_only: false,
  effects, enabled: true, ord: 1200 + i,
}));

console.log(`Préparé : ${rows.length} objets (sets + buffs + déclencheurs).`);
const { error } = await supabase.from('quete_items').upsert(rows, { onConflict: 'key' });
if (error) { console.error('UPSERT échec :', error.message); process.exit(1); }
const { count } = await supabase.from('quete_items').select('*', { count: 'exact', head: true });
console.log(`Terminé. ${rows.length} insérés/à jour. Total en base : ${count}.`);
