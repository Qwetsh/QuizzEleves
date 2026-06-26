// Générateur d'alchimie : combine les profils de la palette pour produire les
// 20 ingrédients + 1140 potions (C(20,3)) + recettes, et écrit src/data/alchemyGen.js.
// Déterministe (RNG semé par combo) → relançable à l'identique.
//
//   node scripts/gen-alchemy.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  INGREDIENTS, MAX_INGREDIENT_EFFECTS, RARITY_SPLIT, FORMS, FORMS_EN, RARITY_EN, LEGENDARY_ICON,
} from './alchemy-palette.mjs';
import { buildPotionEffects } from './potion-effects.mjs';

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

// Montant lisible : nombre, dé ('dN'), ou valeur à l'échelle ({per,factor,base}).
const PER_FR = { streak: 'série', precision: 'précis.', correct: 'bonnes', wrong: 'erreurs', timeleft: 'temps' };
const PER_EN = { streak: 'streak', precision: 'prec.', correct: 'correct', wrong: 'wrong', timeleft: 'time' };
function amtLabel(n, en) {
  if (n && typeof n === 'object') {
    if (n.per) return `${n.base}+${n.factor}·${(en ? PER_EN : PER_FR)[n.per] || n.per}`;
    return '?';
  }
  return String(n);
}

// --- Description lisible d'une action (pour desc potion) ----------------------
function describe(a) {
  const t = (n) => amtLabel(n, false);
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
    case 'blockPowers': return `bloque pouvoirs ${t(a.turns)}T (autres)`;
    case 'blockConsumables': return `bloque conso ${t(a.turns)}T (autres)`;
    case 'loseItem': return `vole un objet (autres)`;
    case 'placeTrap': return 'pose un piège';
    case 'buff': {
      const b = a.buff || {};
      if (b.type === 'themeBonus') return `+${t(b.n)} or/bonne rép. (${b.turns}T)`;
      if (b.type === 'advanceOnCorrect') return `avance/bonne rép. (${b.turns}T)`;
      if (b.type === 'diceBonus') return `dé +${t(b.n)} (${b.turns}T)`;
      if (b.type === 'noRecul') return `aucun recul (${b.turns}T)`;
      if (b.type === 'loseOnWrong') return `−${t(b.n)} or si erreur (${b.turns}T)`;
      if (b.type === 'duelImmune') return `immunité duel (${b.turns}T)`;
      if (b.type === 'bleedGold') return `saignement ${t(b.n)} or/tour (${b.turns}T${b.mode === 'steal' ? ', volé' : ''})`;
      if (b.type === 'reflectChance') return `renvoi ${t(b.n)}% (${b.turns}T)`;
      if (b.type === 'goldStealImmune') return `or involable (${b.turns}T)`;
      if (b.type === 'itemStealImmune') return `objets involables (${b.turns}T)`;
      return `buff ${b.type}`;
    }
    default: return a.action;
  }
}

// --- Variante ANGLAISE de describe() (pour desc_en des potions) ---------------
function describeEn(a) {
  const t = (n) => amtLabel(n, true);
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
    case 'blockPowers': return `block powers ${t(a.turns)}T (others)`;
    case 'blockConsumables': return `block consumables ${t(a.turns)}T (others)`;
    case 'loseItem': return 'steal an item (others)';
    case 'placeTrap': return 'set a trap';
    case 'buff': {
      const b = a.buff || {};
      if (b.type === 'themeBonus') return `+${t(b.n)} gold/correct (${b.turns}T)`;
      if (b.type === 'advanceOnCorrect') return `advance/correct (${b.turns}T)`;
      if (b.type === 'diceBonus') return `die +${t(b.n)} (${b.turns}T)`;
      if (b.type === 'noRecul') return `no setback (${b.turns}T)`;
      if (b.type === 'loseOnWrong') return `−${t(b.n)} gold on wrong (${b.turns}T)`;
      if (b.type === 'duelImmune') return `duel immunity (${b.turns}T)`;
      if (b.type === 'bleedGold') return `bleed ${t(b.n)} gold/turn (${b.turns}T${b.mode === 'steal' ? ', stolen' : ''})`;
      if (b.type === 'reflectChance') return `reflect ${t(b.n)}% (${b.turns}T)`;
      if (b.type === 'goldStealImmune') return `gold unstealable (${b.turns}T)`;
      if (b.type === 'itemStealImmune') return `items unstealable (${b.turns}T)`;
      return `buff ${b.type}`;
    }
    default: return a.action;
  }
}

// Épithètes (style « de X », invariables en genre) pour rendre CHAQUE nom de
// potion unique sans souci d'accord. 28 × 10 formes → espace largement suffisant.
const EPITHETS = [
  { fr: 'de braise', en: 'of ember' }, { fr: "d'azur", en: 'of azure' }, { fr: 'des cimes', en: 'of the peaks' },
  { fr: 'de givre', en: 'of frost' }, { fr: "d'ombre", en: 'of shadow' }, { fr: "de l'aube", en: 'of dawn' },
  { fr: 'du crépuscule', en: 'of dusk' }, { fr: 'de jade', en: 'of jade' }, { fr: "d'ambre", en: 'of amber' },
  { fr: 'de suie', en: 'of soot' }, { fr: 'des abysses', en: 'of the abyss' }, { fr: 'de cristal', en: 'of crystal' },
  { fr: 'de lune', en: 'of the moon' }, { fr: 'de soleil', en: 'of the sun' }, { fr: 'de sang', en: 'of blood' },
  { fr: 'de cendre', en: 'of ash' }, { fr: "d'émeraude", en: 'of emerald' }, { fr: 'de rubis', en: 'of ruby' },
  { fr: 'de saphir', en: 'of sapphire' }, { fr: "d'onyx", en: 'of onyx' }, { fr: 'de nacre', en: 'of pearl' },
  { fr: "d'ivoire", en: 'of ivory' }, { fr: 'de bronze', en: 'of bronze' }, { fr: 'de pourpre', en: 'of crimson' },
  { fr: 'de brume', en: 'of mist' }, { fr: 'des vents', en: 'of the winds' }, { fr: "de l'orage", en: 'of the storm' },
  { fr: 'de la faille', en: 'of the rift' },
];

// Construit un nom GARANTI unique (FR et EN) à partir des saveurs d'effets.
// Préférence : « Forme Principal » → « Forme Principal et Secondaire » →
// + épithète. Les ensembles `usedFr`/`usedEn` assurent l'unicité globale.
function makeUniqueName(flavors, counter, usedFr, usedEn) {
  const primary = flavors[0] || { word: 'du Mystère', word_en: 'of Mystery' };
  const secondary = flavors[1] || null;
  const start = counter % FORMS.length;
  const render = (f, sec, ep) => ({
    fr: `${FORMS[f]} ${primary.word}${sec && secondary ? ` et ${secondary.word}` : ''}${ep >= 0 ? ` ${EPITHETS[ep].fr}` : ''}`,
    en: `${FORMS_EN[f]} ${primary.word_en}${sec && secondary ? ` and ${secondary.word_en}` : ''}${ep >= 0 ? ` ${EPITHETS[ep].en}` : ''}`,
  });
  // Ordre de préférence (du + court au + long) : « Forme Primaire » →
  // « Forme Primaire Épithète » → « Forme Primaire et Secondaire » →
  // combinaison (dernier recours). Garde des noms courts ET uniques.
  const tiers = [];
  for (let i = 0; i < FORMS.length; i++) tiers.push([(start + i) % FORMS.length, false, -1]);
  for (let e = 0; e < EPITHETS.length; e++) for (let i = 0; i < FORMS.length; i++) tiers.push([(start + i) % FORMS.length, false, e]);
  if (secondary) for (let i = 0; i < FORMS.length; i++) tiers.push([(start + i) % FORMS.length, true, -1]);
  if (secondary) for (let e = 0; e < EPITHETS.length; e++) for (let i = 0; i < FORMS.length; i++) tiers.push([(start + i) % FORMS.length, true, e]);
  for (const [f, sec, ep] of tiers) {
    const { fr, en } = render(f, sec, ep);
    if (!usedFr.has(fr) && !usedEn.has(en)) { usedFr.add(fr); usedEn.add(en); return { name: fr, name_en: en }; }
  }
  // Repli (espace de noms épuisé — ne devrait pas arriver) : suffixe d'index.
  const { fr, en } = render(start, !!secondary, 0);
  usedFr.add(`${fr} ${counter}`); usedEn.add(`${en} ${counter}`);
  return { name: `${fr} ${counter}`, name_en: `${en} ${counter}` };
}

// Assemble le trigger on:'use' final à partir des actions du distributeur
// (potion-effects.mjs) + table de hasard optionnelle. Garantit ≥1 effet.
function assembleEffects(actions, rollTable) {
  const trigger = { kind: 'trigger', on: 'use' };
  if (actions.length) trigger.do = actions;
  if (rollTable) { trigger.roll = 'd6'; trigger.table = rollTable; }
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
    name: ing.name, name_en: ing.name_en, icon: ing.icon, img: ing.img, slot: 'consumable', family: 'ingredient',
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

const built = combos.map(([i, j, k]) => ({ i, j, k, ings: [INGREDIENTS[i], INGREDIENTS[j], INGREDIENTS[k]] }));

// Rareté : répartition déterministe (RARITY_SPLIT) via mélange semé des combos.
// La puissance n'est plus un critère (distribution d'effets pilotée, pas dérivée).
const rarRng = mulberry32(20260626);
const order = built.map((_, idx) => idx);
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rarRng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
const nCommon = Math.round(built.length * RARITY_SPLIT.commun);
const nRare = Math.round(built.length * RARITY_SPLIT.rare);
order.forEach((bi, rank) => { built[bi].rarity = rank < nCommon ? 'commun' : rank < nCommon + nRare ? 'rare' : 'legendaire'; });

// Construit potions + recettes via le distributeur d'effets équilibré.
const potionsOut = {};
const recipes = [];
const effCounts = [];
const usedFr = new Set();
const usedEn = new Set();
let formCounter = 0;
built.forEach((b) => {
  const key = `pot${pad2(b.i)}${pad2(b.j)}${pad2(b.k)}`;
  const rng = mulberry32(comboSeed(b.i, b.j, b.k));
  const { actions, rollTable, flavor, art, flavors } = buildPotionEffects(rng, b.rarity);
  const { name, name_en } = makeUniqueName(flavors, formCounter++, usedFr, usedEn);
  const icon = b.rarity === 'legendaire' ? LEGENDARY_ICON : flavor.icon;
  const { effects, descParts, descPartsEn } = assembleEffects(actions, rollTable);
  effCounts.push((effects[0].do?.length || 0) + (effects[0].table ? 1 : 0));
  const desc = `Potion ${b.rarity}. ${descParts.slice(0, 5).join(', ') || 'effet mineur'}.`;
  const desc_en = `${RARITY_EN[b.rarity] || 'Common'} potion. ${descPartsEn.slice(0, 5).join(', ') || 'minor effect'}.`;
  // Visuel : fiole choisie par l'effet DOMINANT (art du distributeur) + index
  // déterministe (hash de la combinaison) → variété stable et cohérente.
  const artList = art && art.length ? art : ['r2c2', 'r4c2', 'r3c3', 'r1c2'];
  const img = 'alc-pot-' + artList[Math.abs(b.i * 131 + b.j * 17 + b.k * 7) % artList.length];
  potionsOut[key] = {
    name, name_en, icon, img, slot: 'consumable', family: 'potion', rarity: b.rarity, price: 0, lootOnly: true,
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
