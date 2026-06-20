// Générateur d'alchimie : combine les profils de la palette pour produire les
// 20 ingrédients + 1140 potions (C(20,3)) + recettes, et écrit src/data/alchemyGen.js.
// Déterministe (RNG semé par combo) → relançable à l'identique.
//
//   node scripts/gen-alchemy.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  INGREDIENTS, TEMPLATES, AXIS_POWER, AXIS_THRESHOLD, MAX_POTION_EFFECTS, MAX_INGREDIENT_EFFECTS,
  RARITY_SPLIT, FOE_TARGETS, FORMS, FORMS_EN, AXIS_FLAVOR, RARITY_EN, LEGENDARY_ICON, NEGATIVE,
} from './alchemy-palette.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- RNG semé (mulberry32) : déterministe par graine -------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const comboSeed = (a, b, c) => ((a + 1) * 73856093) ^ ((b + 1) * 19349663) ^ ((c + 1) * 83492791);
const pad2 = (n) => String(n).padStart(2, '0');
const pick = (rng, pairs) => { let r = rng(); for (const [v, p] of pairs) { if (r < p) return v; r -= p; } return pairs[pairs.length - 1][0]; };

// --- Effets « solo » d'un ingrédient (≤2, simples, révélés à l'usage) ---------
const SOLO_MAP = {
  gold: { type: 'gainMoney', value: 4 }, time: { type: 'extraTime', value: 4 },
  shield: { type: 'shieldNext', value: 1 }, move: { type: 'moveForward', value: 1 },
  charge: { type: 'gainCharge', value: 1 }, loot: { type: 'gainMoney', value: 5 },
};
function soloEffects(ing) {
  const axes = Object.entries(ing.profile).sort((x, y) => y[1] - x[1]).map(([k]) => k);
  const out = [];
  for (const ax of axes) {
    if (out.length >= MAX_INGREDIENT_EFFECTS) break;
    if (SOLO_MAP[ax]) out.push({ ...SOLO_MAP[ax] });
  }
  if (!out.length) out.push({ type: 'gainMoney', value: 3 }); // repli : petit gain
  return out;
}

// --- Description lisible d'une action (pour desc potion) ----------------------
function describe(a) {
  const t = (n) => (typeof n === 'object' ? '?' : n);
  switch (a.action) {
    case 'money': {
      const who = a.target === 'self' ? '' : (a.target === 'allOthers' ? ' aux autres' : (a.target === 'target' ? ' à une équipe' : ' à un adversaire'));
      if (a.mode === 'gain') return `+${t(a.n)} or`;
      if (a.mode === 'lose') return `−${t(a.n)} or${who}`;
      if (a.mode === 'steal') return `vol ${t(a.n)} or${who}`;
      return `${t(a.n)} or`;
    }
    case 'move': return a.dir === 'forward' ? `avance ${t(a.n)}` : `recul ${t(a.n)}${a.target !== 'self' ? ' (autres)' : ''}`;
    case 'extraTime': return `+${t(a.n)} s`;
    case 'shieldNext': return `bouclier ${t(a.n)}`;
    case 'gainCharge': return 'recharge pouvoir';
    case 'fumigene': return 'fumigène';
    case 'loot': return 'butin';
    case 'teleportFurthest': return 'téléport avant';
    case 'forceSubject': return `force ${a.subject} (autres)`;
    case 'curseTimer': return 'timer ÷2 (autres)';
    case 'curseExtraQuestion': return `+${t(a.n)} question (autres)`;
    case 'randomPathNext': return 'voie aléatoire (autres)';
    case 'buff': {
      const b = a.buff || {};
      if (b.type === 'themeBonus') return `+${t(b.n)} or/bonne rép. (${b.turns}T)`;
      if (b.type === 'advanceOnCorrect') return `avance/bonne rép. (${b.turns}T)`;
      if (b.type === 'diceBonus') return `dé +${t(b.n)} (${b.turns}T)`;
      if (b.type === 'duelImmune') return `immunité duel (${b.turns}T)`;
      return `buff ${b.type}`;
    }
    default: return a.action;
  }
}

// --- Variante ANGLAISE de describe() (pour desc_en des potions) ---------------
function describeEn(a) {
  const t = (n) => (typeof n === 'object' ? '?' : n);
  switch (a.action) {
    case 'money': {
      const who = a.target === 'self' ? '' : (a.target === 'allOthers' ? ' from others' : (a.target === 'target' ? ' from a team' : ' from an opponent'));
      if (a.mode === 'gain') return `+${t(a.n)} gold`;
      if (a.mode === 'lose') return `−${t(a.n)} gold${who}`;
      if (a.mode === 'steal') return `steal ${t(a.n)} gold${who}`;
      return `${t(a.n)} gold`;
    }
    case 'move': return a.dir === 'forward' ? `advance ${t(a.n)}` : `back ${t(a.n)}${a.target !== 'self' ? ' (others)' : ''}`;
    case 'extraTime': return `+${t(a.n)}s`;
    case 'shieldNext': return `shield ${t(a.n)}`;
    case 'gainCharge': return 'recharge power';
    case 'fumigene': return 'smoke screen';
    case 'loot': return 'loot';
    case 'teleportFurthest': return 'teleport forward';
    case 'forceSubject': return `force ${a.subject} (others)`;
    case 'curseTimer': return 'timer ÷2 (others)';
    case 'curseExtraQuestion': return `+${t(a.n)} question (others)`;
    case 'randomPathNext': return 'random path (others)';
    case 'buff': {
      const b = a.buff || {};
      if (b.type === 'themeBonus') return `+${t(b.n)} gold/correct (${b.turns}T)`;
      if (b.type === 'advanceOnCorrect') return `advance/correct (${b.turns}T)`;
      if (b.type === 'diceBonus') return `die +${t(b.n)} (${b.turns}T)`;
      if (b.type === 'duelImmune') return `duel immunity (${b.turns}T)`;
      return `buff ${b.type}`;
    }
    default: return a.action;
  }
}

// --- Génération d'une potion pour une combinaison de 3 ingrédients ------------
function buildPotion(ings, rng) {
  // 1) somme des scores d'axe
  const score = {};
  for (const ing of ings) for (const [ax, w] of Object.entries(ing.profile)) score[ax] = (score[ax] || 0) + w;
  // 2) matière favorite dominante (pour themeBuff) = celle de l'ingrédient au plus gros poids
  const subj = [...ings].sort((a, b) => Object.values(b.profile).reduce((s, v) => s + v, 0) - Object.values(a.profile).reduce((s, v) => s + v, 0))[0].favSubject;
  // 3) axes retenus, triés par score×puissance, plafonnés
  const axes = Object.entries(score)
    .filter(([, v]) => v >= AXIS_THRESHOLD)
    .sort((a, b) => (b[1] * (AXIS_POWER[b[0]] || 1)) - (a[1] * (AXIS_POWER[a[0]] || 1)))
    .slice(0, MAX_POTION_EFFECTS)
    .map(([ax]) => ax);
  // 4) construit les actions
  const actions = [];
  let rollTable = null;
  let power = 0;
  for (const ax of axes) {
    const m = score[ax];
    power += m * (AXIS_POWER[ax] || 1);
    const ft = NEGATIVE.includes(ax) ? pick(rng, FOE_TARGETS) : null;
    const out = TEMPLATES[ax](m, rng, subj, ft);
    for (const a of out) {
      if (a.kind === 'inline-roll') { rollTable = a.table; continue; }
      // chance occasionnelle pour varier (sur effets positifs non vitaux)
      if (!NEGATIVE.includes(ax) && rng() < 0.12) a.chance = 0.75;
      actions.push(a);
    }
  }
  // 5) renvoie les briques brutes ; l'assemblage (avec plafond par rareté) se
  // fait après l'attribution de rareté.
  return { actions, rollTable, power, axes, subj };
}

// Plafond d'effets par rareté (la rareté donne sa « richesse » à la potion).
const EFFECT_CAP = { commun: 2, rare: 4, legendaire: 6 };
// Assemble le trigger on:'use' final en respectant le plafond (actions triées
// par puissance ; la table d6 compte pour 1 effet, gardée en dernier).
function assembleEffects(actions, rollTable, cap) {
  const kept = actions.slice(0, rollTable ? Math.max(0, cap - 1) : cap);
  const trigger = { kind: 'trigger', on: 'use' };
  if (kept.length) trigger.do = kept;
  if (rollTable && cap - kept.length >= 1) { trigger.roll = 'd6'; trigger.table = rollTable; }
  if (!trigger.do && !trigger.table) trigger.do = [{ action: 'money', mode: 'gain', target: 'self', n: 5, unit: 'flat' }];
  const descParts = (trigger.do || []).map(describe).concat(trigger.table ? ['🎲 hasard'] : []);
  const descPartsEn = (trigger.do || []).map(describeEn).concat(trigger.table ? ['🎲 chance'] : []);
  return { effects: [trigger], descParts, descPartsEn };
}

// --- MAIN --------------------------------------------------------------------
const ingredientsOut = {};
const INGREDIENT_LOOT = {};
INGREDIENTS.forEach((ing) => {
  ingredientsOut[ing.key] = {
    name: ing.name, name_en: ing.name_en, icon: ing.icon, slot: 'consumable', family: 'ingredient',
    rarity: ing.rarity, price: ing.rarity === 'commun' ? 4 : ing.rarity === 'rare' ? 6 : 9,
    desc: 'Ingrédient d\'alchimie. Combine-le par 3 pour distiller une potion.',
    desc_en: 'Alchemy ingredient. Combine three to distill a potion.',
    effects: soloEffects(ing),
  };
  INGREDIENT_LOOT[ing.key] = { weight: ing.lootWeight, favSubject: ing.favSubject, favMult: ing.favMult };
});

// Toutes les combinaisons C(20,3)
const combos = [];
for (let i = 0; i < INGREDIENTS.length; i++)
  for (let j = i + 1; j < INGREDIENTS.length; j++)
    for (let k = j + 1; k < INGREDIENTS.length; k++)
      combos.push([i, j, k]);

const built = combos.map(([i, j, k]) => {
  const rng = mulberry32(comboSeed(i, j, k));
  const ings = [INGREDIENTS[i], INGREDIENTS[j], INGREDIENTS[k]];
  const p = buildPotion(ings, rng);
  return { i, j, k, ings, ...p };
});

// Rareté par percentile de puissance (respecte RARITY_SPLIT) + influence des
// ingrédients légendaires (un légendaire pousse vers le haut).
const legendaryBonus = (ings) => ings.filter((g) => g.rarity === 'legendaire').length * 6 + ings.filter((g) => g.rarity === 'rare').length * 1.5;
built.forEach((b) => { b.rank = b.power + legendaryBonus(b.ings); });
const sorted = [...built].sort((a, b) => a.rank - b.rank);
const nCommon = Math.round(sorted.length * RARITY_SPLIT.commun);
const nRare = Math.round(sorted.length * RARITY_SPLIT.rare);
sorted.forEach((b, idx) => { b.rarity = idx < nCommon ? 'commun' : idx < nCommon + nRare ? 'rare' : 'legendaire'; });

// Construit potions + recettes (effets plafonnés selon la rareté)
const potionsOut = {};
const recipes = [];
const effCounts = [];
let formCounter = 0;
built.forEach((b) => {
  const key = `pot${pad2(b.i)}${pad2(b.j)}${pad2(b.k)}`;
  const domAxis = b.axes[0] || 'gold';
  const flavor = AXIS_FLAVOR[domAxis] || AXIS_FLAVOR.gold;
  const formIdx = (formCounter++) % FORMS.length;
  const form = FORMS[formIdx];
  const name = `${form} ${flavor.word}`;
  const name_en = `${FORMS_EN[formIdx]} ${flavor.word_en}`;
  const icon = b.rarity === 'legendaire' ? LEGENDARY_ICON : flavor.icon;
  const { effects, descParts, descPartsEn } = assembleEffects(b.actions, b.rollTable, EFFECT_CAP[b.rarity]);
  effCounts.push((effects[0].do?.length || 0) + (effects[0].table ? 1 : 0));
  const desc = `Potion ${b.rarity}. ${descParts.slice(0, 5).join(', ') || 'effet mineur'}.`;
  const desc_en = `${RARITY_EN[b.rarity] || 'Common'} potion. ${descPartsEn.slice(0, 5).join(', ') || 'minor effect'}.`;
  potionsOut[key] = {
    name, name_en, icon, slot: 'consumable', family: 'potion', rarity: b.rarity, price: 0, lootOnly: true,
    desc, desc_en, effects,
  };
  recipes.push({ id: key, ingredients: [b.ings[0].key, b.ings[1].key, b.ings[2].key], potion: key });
});

// --- Écriture du fichier généré ----------------------------------------------
const lines = [];
lines.push('// FICHIER GÉNÉRÉ par scripts/gen-alchemy.mjs — NE PAS éditer à la main.');
lines.push('// Source : scripts/alchemy-palette.mjs. Régénérer : node scripts/gen-alchemy.mjs');
lines.push('// 20 ingrédients + ' + recipes.length + ' potions (C(20,3)) + recettes + données de loot.');
lines.push('');
lines.push('export const INGREDIENTS = ' + JSON.stringify(ingredientsOut, null, 0) + ';');
lines.push('export const INGREDIENT_LOOT = ' + JSON.stringify(INGREDIENT_LOOT, null, 0) + ';');
lines.push('');
lines.push('export const POTIONS = {');
for (const [key, p] of Object.entries(potionsOut)) lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(p)},`);
lines.push('};');
lines.push('');
lines.push('export const ALCHEMY_RECIPES = [');
for (const r of recipes) lines.push(`  ${JSON.stringify(r)},`);
lines.push('];');
lines.push('');

const outPath = join(__dirname, '..', 'src', 'data', 'alchemyGen.js');
writeFileSync(outPath, lines.join('\n'), 'utf8');

// Petit fichier SÉPARÉ pour les défauts de loot par ingrédient (importé au
// runtime par balanceConfig — évite d'embarquer les 1140 potions dans le bundle).
const lootLines = [
  '// FICHIER GÉNÉRÉ par scripts/gen-alchemy.mjs — défauts de loot par ingrédient.',
  '// poids de base + matière favorite (favSubject) + multiplicateur sur sa matière.',
  'export const INGREDIENT_LOOT = ' + JSON.stringify(INGREDIENT_LOOT, null, 0) + ';',
  '',
];
const lootPath = join(__dirname, '..', 'src', 'data', 'ingredientLoot.js');
writeFileSync(lootPath, lootLines.join('\n'), 'utf8');

// --- Récap console -----------------------------------------------------------
const byRarity = built.reduce((m, b) => ((m[b.rarity] = (m[b.rarity] || 0) + 1), m), {});
console.log(`✅ ${Object.keys(ingredientsOut).length} ingrédients, ${Object.keys(potionsOut).length} potions, ${recipes.length} recettes`);
console.log('Rareté :', byRarity);
console.log('Effets/potion — min', Math.min(...effCounts), 'max', Math.max(...effCounts), 'moy', (effCounts.reduce((a, c) => a + c, 0) / effCounts.length).toFixed(2));
console.log('Écrit →', outPath);
