// Config d'équilibrage centralisée — source de vérité : table Supabase
// public.quete_balance (PersoDB), avec un CACHE localStorage qui sert de
// secours hors-ligne. Seules les valeurs MODIFIÉES par rapport au code source
// sont stockées (overrides) ; le reste vient des defaults figés ici.
//
// Cycle de vie :
//   1. au boot (main.jsx) : applyCachedBalance() lit le cache (synchrone,
//      offline-safe) et mute ITEMS/POWERS/LOOT en place ;
//   2. en arrière-plan : refreshBalance() récupère la version Supabase, met à
//      jour le cache et ré-applique ;
//   3. l'éditeur (dev) : saveBalance() écrit cache + Supabase et ré-applique.
//
// L'application MUTE les objets ITEMS/POWERS importés partout (par référence) :
// tout le jeu lit donc les valeurs équilibrées sans changement ailleurs.
import { POWERS } from '../data/powers.js';
import { SETS } from '../data/sets.js';
import { INGREDIENT_LOOT } from '../data/ingredientLoot.js';
import { supabase, BALANCE_TABLE, BALANCE_ROW_ID } from './supabaseClient.js';

// Snapshot des valeurs par défaut, capturé À L'IMPORT (donc avant toute
// mutation). Sert de base de reset et de référence pour l'éditeur.
// NB : les OBJETS ne passent plus par ici — ils sont pilotés par la table
// quete_items (voir src/logic/itemsConfig.js). balanceConfig gère pouvoirs,
// loot et bonus de sets.
const clone = (v) => JSON.parse(JSON.stringify(v));
const DEFAULT_POWERS = clone(POWERS);
const DEFAULT_SETS = clone(SETS);

// Paramètres de loot/économie auparavant codés en dur aux points d'appel,
// désormais lus depuis cet objet mutable (voir itemHandlers, eventHandlers,
// fightHandlers, gameStore). Les valeurs ci-dessous = comportement d'origine.
const DEFAULT_LOOT = {
  chestLegendaryChance: 0.2,   // coffre au trésor (événement)
  fightLegendaryChance: 0.1,   // butin de duel
  answerLegendaryChance: 0.1,  // loot d'ÉQUIPEMENT de bonne réponse
  answerLootRate: 0.1,         // proba max du loot d'ÉQUIPEMENT de bonne réponse (× temps restant)
  answerConsumableRate: 0.12,  // proba max du loot de CONSOMMABLE de bonne réponse (× temps restant, indépendant)
  shopWeightCommon: 3,         // poids d'un objet commun dans le stock boutique
  shopWeightOther: 2,          // poids d'un objet rare/légendaire (hors lootOnly)
  shopPromptDelay: 3,          // tours sans voir la boutique avant de proposer « Visiter la boutique ? »
  // --- Alchimie : loot d'INGRÉDIENTS (canal séparé, plus généreux) ---
  answerIngredientRate: 0.18,  // proba max d'un drop d'ingrédient (× temps restant)
  ingredientMultiDrop: { chance: 0.35, max: 2 }, // après un drop : chance d'en avoir d'autres (jusqu'à max EN PLUS)
  // Poids + matière favorite par ingrédient (défauts générés ; éditables).
  ingredients: { ...INGREDIENT_LOOT },
};

export const LOOT = { ...DEFAULT_LOOT };

// --- Forge de dés (extension « forge ») : tout est calibrable, rien en dur ---
// Points de départ issus de la spec (à équilibrer en jouant). La logique lit
// FORGE.* (voir forgeEffects.js) ; l'éditeur exposera ces valeurs en Phase 2.
const DEFAULT_FORGE = {
  budgetMax: 12,                    // puissance max d'une face (déplacement + effet)
  relance: { enchainement: false }, // §6.2 : une face-Relance retombant sur Relance NE re-relance pas (défaut)
  // Lot de départ (spec §5). Pour chaque effet : `tiers` = valeur par palier,
  // `costs` = coût de PUISSANCE du palier (la puissance d'une face = valeur de
  // déplacement + coût de l'effet). Les métadonnées (icône, famille, timing)
  // vivent dans forgeEffects.js (FORGE_EFFECTS).
  effects: {
    prime:           { tiers: [10, 25, 50],            costs: [2, 4, 6] }, // 💰 +or sec (lancer)
    aubaine:         { tiers: [1.5, 2, 3],             costs: [2, 4, 6] }, // 💰× ×or de la bonne réponse (bonne réponse)
    recharge:        { tiers: [1, 2, 'full'],          costs: [2, 4, 6] }, // 🔋 +charge de pouvoir (lancer)
    indice:          { tiers: [1, 2],                  costs: [2, 4] },    // 💡 −mauvaises réponses (avant question)
    repit:           { tiers: [5, 10],                 costs: [2, 4] },    // ⏳ +temps (avant question)
    questionFraiche: { tiers: [true],                  costs: [4] },       // 🔄 retire la question, en tire une autre
    egide:           { tiers: [2, 4, 'cancel'],        costs: [2, 4, 6] }, // 🛡️ réduction de recul ce tour, MAX avec Bouclier
    gardeSerie:      { tiers: [true],                  costs: [4] },       // 🔗 la série ne casse pas en cas d'erreur
    butin:           { tiers: [0.5, 'guaranteed'],     costs: [2, 6] },   // 🎁 bonus de loot sur bonne réponse (+50% chance / garanti)
    relance:         { tiers: [true],                  costs: [4] },       // 🎲 relance le dé (seule la dernière face compte)
  },
  // Boutique : la vitrine pioche dans le CATALOGUE ci-dessous, pondéré par rareté
  // (plus de génération procédurale). priceByBand/rarityByBand conservés pour la
  // rétro-compat mais inutilisés par la sélection.
  priceByBand: [25, 60, 120, 250, 400, 650],
  rarityByBand: [10, 10, 6, 3, 3, 1],
  shopWeight: { commun: 10, rare: 4, legendaire: 1 }, // poids de tirage en vitrine
  // Catalogue curé de faces forgeables (éditable dans l'éditeur). Chaque face
  // cible un slot précis (1→6) et ne se forge que là. `value` = déplacement,
  // `effect` = { type, tier } réutilisant FORGE.effects (valeurs des paliers).
  catalog: [
    // — Slot 1 —
    { key: 's1-sprint',    name: 'Sprint',           name_en: 'Sprint',         rarity: 'commun',     price: 60,  slot: 1, value: 6, effect: null },
    { key: 's1-prime0',    name: 'Petite prime',     name_en: 'Small bounty',   rarity: 'commun',     price: 50,  slot: 1, value: 2, effect: { type: 'prime', tier: 0 } },
    { key: 's1-recharge1', name: 'Recharge ++',      name_en: 'Recharge ++',    rarity: 'rare',       price: 180, slot: 1, value: 1, effect: { type: 'recharge', tier: 1 } },
    { key: 's1-relance',   name: 'Relance',          name_en: 'Reroll',         rarity: 'rare',       price: 150, slot: 1, value: 1, effect: { type: 'relance', tier: 0 } },
    // — Slot 2 —
    { key: 's2-foulee',    name: 'Foulée',           name_en: 'Stride',         rarity: 'commun',     price: 45,  slot: 2, value: 5, effect: null },
    { key: 's2-repit0',    name: 'Répit',            name_en: 'Respite',        rarity: 'commun',     price: 55,  slot: 2, value: 3, effect: { type: 'repit', tier: 0 } },
    { key: 's2-aubaine0',  name: 'Aubaine',          name_en: 'Windfall',       rarity: 'rare',       price: 160, slot: 2, value: 2, effect: { type: 'aubaine', tier: 0 } },
    { key: 's2-egide2',    name: 'Égide absolue',    name_en: 'Absolute aegis', rarity: 'legendaire', price: 480, slot: 2, value: 0, effect: { type: 'egide', tier: 2 } },
    // — Slot 3 —
    { key: 's3-bond',      name: 'Bond',             name_en: 'Leap',           rarity: 'commun',     price: 60,  slot: 3, value: 6, effect: null },
    { key: 's3-indice0',   name: 'Indice',           name_en: 'Hint',           rarity: 'commun',     price: 60,  slot: 3, value: 3, effect: { type: 'indice', tier: 0 } },
    { key: 's3-prime1',    name: 'Prime',            name_en: 'Bounty',         rarity: 'rare',       price: 200, slot: 3, value: 2, effect: { type: 'prime', tier: 1 } },
    { key: 's3-garde',     name: 'Garde de série',   name_en: 'Streak guard',   rarity: 'rare',       price: 220, slot: 3, value: 2, effect: { type: 'gardeSerie', tier: 0 } },
    // — Slot 4 —
    { key: 's4-trot',      name: 'Trot',             name_en: 'Trot',           rarity: 'commun',     price: 35,  slot: 4, value: 4, effect: null },
    { key: 's4-egide0',    name: 'Égide',            name_en: 'Aegis',          rarity: 'commun',     price: 65,  slot: 4, value: 3, effect: { type: 'egide', tier: 0 } },
    { key: 's4-butin0',    name: 'Butin',            name_en: 'Spoils',         rarity: 'rare',       price: 170, slot: 4, value: 2, effect: { type: 'butin', tier: 0 } },
    { key: 's4-recharge2', name: 'Recharge totale',  name_en: 'Full recharge',  rarity: 'legendaire', price: 450, slot: 4, value: 0, effect: { type: 'recharge', tier: 2 } },
    // — Slot 5 —
    { key: 's5-galop',     name: 'Galop',            name_en: 'Gallop',         rarity: 'commun',     price: 45,  slot: 5, value: 5, effect: null },
    { key: 's5-repit1',    name: 'Long répit',       name_en: 'Long respite',   rarity: 'rare',       price: 150, slot: 5, value: 2, effect: { type: 'repit', tier: 1 } },
    { key: 's5-qfraiche',  name: 'Question fraîche', name_en: 'Fresh question', rarity: 'rare',       price: 190, slot: 5, value: 1, effect: { type: 'questionFraiche', tier: 0 } },
    { key: 's5-aubaine2',  name: 'Aubaine royale',   name_en: 'Royal windfall', rarity: 'legendaire', price: 520, slot: 5, value: 1, effect: { type: 'aubaine', tier: 2 } },
    // — Slot 6 —
    { key: 's6-saut',      name: 'Grand saut',       name_en: 'Great jump',     rarity: 'commun',     price: 60,  slot: 6, value: 6, effect: null },
    { key: 's6-indice1',   name: 'Double indice',    name_en: 'Double hint',    rarity: 'rare',       price: 210, slot: 6, value: 2, effect: { type: 'indice', tier: 1 } },
    { key: 's6-prime2',    name: 'Grande prime',     name_en: 'Great bounty',   rarity: 'legendaire', price: 500, slot: 6, value: 1, effect: { type: 'prime', tier: 2 } },
    { key: 's6-butin1',    name: 'Butin garanti',    name_en: 'Sure spoils',    rarity: 'legendaire', price: 600, slot: 6, value: 0, effect: { type: 'butin', tier: 1 } },
  ],
};
export const FORGE = clone(DEFAULT_FORGE);

// --- Événements de terrain (extension « weather ») : tout est calibrable ---
// Points de départ issus de la spec (à équilibrer en jouant). La logique lit
// WEATHER.* (voir weatherHandlers.js) ; l'éditeur exposera ces valeurs.
const DEFAULT_WEATHER = {
  // Cadence : tirage tous les min..max tours, JAMAIS avant `min` tours d'écart
  // depuis la dernière météo (cooldown). Probabilité montant à 1 au tour `max`.
  cadence: { min: 3, max: 5 },
  // Poids de rareté par météo (tirage pondéré). Une météo absente / poids 0 ne
  // sort jamais en automatique (mais reste forçable en admin). Le séisme et la
  // pluie maudite sont câblés en Phases 2/3 → poids 0 par défaut pour l'instant.
  weights: {
    ventContraire: 4, ventArriere: 4, soleil: 4,
    orage: 1, pluieAcide: 1, seisme: 1, pluieMaudite: 1,
  },
  // Préavis (1 tour à l'avance) par météo : override du défaut du catalogue.
  preavis: {
    ventContraire: false, ventArriere: false, soleil: false,
    orage: true, pluieAcide: true, seisme: true, pluieMaudite: true,
  },
  // Durée (tours) des météos AMBIANTES.
  durations: { ventContraire: 2, ventArriere: 2 },
  // Vent : facteur appliqué à la valeur FINALE de déplacement (après dé/Relance).
  vent: { contraireFactor: 0.5, arriereFactor: 2 },
  // Soleil : nombre de charges rechargées par équipe (plafonné à MAX_CHARGES).
  soleil: { charge: 1 },
  // Orage : recul (dé) des équipes touchées + proportion de cases frappées.
  orage: { die: 'd10', tileRatio: 0.2 },
  // Pluie acide : or perdu si l'équipe ne porte aucun équipement.
  pluieAcide: { gold: 15 },
  // Séisme (Phase 2) : nombre de secousses (ticks) × 1 déplacement aléatoire.
  seisme: { ticks: 6 },
  // Pluie maudite (Phase 3) : pool de malédictions tirées au hasard (poids).
  pluieMaudite: {
    pool: {
      blockPowers: { weight: 1, turns: 1 },
      blockConsumables: { weight: 1, turns: 1 },
      blockShop: { weight: 1, turns: 1 },
      forceHardcore: { weight: 1 },
      curseTimer: { weight: 1, divisor: 2, interval: 2 },
      loseItem: { weight: 1 },
      loseGold: { weight: 1, die: 'd10' },
    },
  },
};
export const WEATHER = clone(DEFAULT_WEATHER);

export const DEFAULTS = { powers: DEFAULT_POWERS, loot: DEFAULT_LOOT, sets: DEFAULT_SETS, forge: DEFAULT_FORGE, weather: DEFAULT_WEATHER };

const LS_KEY = 'quete_balance_overrides_v1';

// Fusion récursive de champs scalaires (override partiel d'un effet de niveau)
function deepAssign(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

// Remet ITEMS/POWERS/LOOT à leurs valeurs d'origine (idempotence des apply)
function resetToDefaults() {
  for (const [k, d] of Object.entries(DEFAULT_POWERS)) {
    const p = POWERS[k];
    if (!p) continue;
    p.price = d.price;
    p.activationCost = d.activationCost;
    p.upgradeCosts = d.upgradeCosts.slice();
    // Clone PROFOND (effet inclus) : deepAssign des overrides ne doit jamais
    // muter les valeurs par défaut (idempotence préservée même si un effet
    // contient un objet imbriqué à l'avenir).
    p.levels = d.levels.map((lv) => JSON.parse(JSON.stringify(lv)));
    if (d.tree) p.tree = clone(d.tree); // arbre Maîtrise (scale 1-10 + branches + coûts)
  }
  Object.assign(LOOT, DEFAULT_LOOT);
  // Sous-objets : cloner (sinon LOOT partagerait la référence des defaults et un
  // override mutant les casserait).
  LOOT.ingredients = clone(DEFAULT_LOOT.ingredients);
  LOOT.ingredientMultiDrop = { ...DEFAULT_LOOT.ingredientMultiDrop };
  // Forge : reset profond (sous-objets effects/relance + tableaux).
  Object.assign(FORGE, clone(DEFAULT_FORGE));
  // Météo : reset profond (sous-objets cadence/weights/pool…).
  Object.assign(WEATHER, clone(DEFAULT_WEATHER));
  // Sets : supprime les sets CUSTOM créés par overrides (absents des défauts),
  // puis restaure name/icon/color/bonus d'origine des sets de base (clone profond).
  for (const k of Object.keys(SETS)) { if (!DEFAULT_SETS[k]) delete SETS[k]; }
  for (const [k, d] of Object.entries(DEFAULT_SETS)) {
    if (!SETS[k]) continue;
    SETS[k].name = d.name;
    if (d.name_en !== undefined) SETS[k].name_en = d.name_en;
    SETS[k].icon = d.icon;
    SETS[k].color = d.color;
    delete SETS[k].size;
    SETS[k].bonus2 = clone(d.bonus2 || []);
    SETS[k].bonus3 = clone(d.bonus3 || []);
  }
}

// Applique un jeu d'overrides (peut être {}). Reset d'abord pour que retirer
// un override revienne bien à la valeur par défaut.
export function applyBalance(overrides) {
  resetToDefaults();
  const ov = overrides || {};

  for (const [k, o] of Object.entries(ov.powers || {})) {
    const p = POWERS[k];
    if (!p || !o) continue;
    if (o.price != null) p.price = o.price;
    if (o.activationCost != null) p.activationCost = o.activationCost;
    if (Array.isArray(o.upgradeCosts)) p.upgradeCosts = o.upgradeCosts.slice();
    if (Array.isArray(o.levels)) {
      o.levels.forEach((lvOv, i) => { if (lvOv && p.levels[i]) deepAssign(p.levels[i].effect, lvOv); });
    }
    // Arbre Maîtrise : coûts L1→10, valeurs par niveau (scale) et effets de branches.
    if (o.tree && p.tree) {
      if (Array.isArray(o.tree.upgradeCosts)) p.tree.upgradeCosts = o.tree.upgradeCosts.slice();
      if (Array.isArray(o.tree.scale)) o.tree.scale.forEach((s, i) => { if (s && p.tree.scale[i]) deepAssign(p.tree.scale[i], s); });
      for (const b of ['branch5', 'branch10']) {
        if (Array.isArray(o.tree[b])) o.tree[b].forEach((br, j) => {
          if (!br || !p.tree[b][j]) return;
          if (br.effect) deepAssign(p.tree[b][j].effect, br.effect);
          // Renforts de voie (tiers L7/L9) : override par palier.
          if (Array.isArray(br.tiers) && Array.isArray(p.tree[b][j].tiers)) {
            br.tiers.forEach((tier, t) => { if (tier && p.tree[b][j].tiers[t]) deepAssign(p.tree[b][j].tiers[t], tier); });
          }
        });
      }
    }
  }

  if (ov.loot) Object.assign(LOOT, ov.loot);

  // Forge : fusion récursive (paliers d'effets, coûts, prix/rareté de bande).
  if (ov.forge) deepAssign(FORGE, ov.forge);

  // Météo : fusion récursive (cadence, poids, durées, facteurs, pool…).
  if (ov.weather) deepAssign(WEATHER, ov.weather);

  // Sets : modifications des sets de base ET CRÉATION de sets personnalisés
  // (override portant `custom:true` → la clé est ajoutée à SETS).
  for (const [k, o] of Object.entries(ov.sets || {})) {
    if (!o) continue;
    let s = SETS[k];
    if (!s) {
      if (!o.custom) continue; // clé inconnue non-custom → ignorer
      s = SETS[k] = { name: o.name || k, bonus2: [], bonus3: [] };
    }
    if (o.name != null) s.name = o.name;
    if (o.name_en != null) s.name_en = o.name_en;
    if (o.icon != null) s.icon = o.icon;
    if (o.color != null) s.color = o.color;
    if (o.size != null) s.size = o.size;
    if (Array.isArray(o.bonus2)) s.bonus2 = clone(o.bonus2);
    if (Array.isArray(o.bonus3)) s.bonus3 = clone(o.bonus3);
  }
}

// --- Cache localStorage (secours hors-ligne) ---
export function readCache() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}
function writeCache(ov) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ov || {})); } catch { /* quota / mode privé */ }
}

// Boot synchrone : applique tout de suite le dernier état connu (offline-safe)
export function applyCachedBalance() {
  const ov = readCache();
  applyBalance(ov);
  return ov;
}

// Récupère la config Supabase, met à jour le cache et ré-applique. Non bloquant.
export async function refreshBalance() {
  const { data, error } = await supabase
    .from(BALANCE_TABLE).select('data').eq('id', BALANCE_ROW_ID).maybeSingle();
  if (error) throw error;
  const ov = data?.data || {};
  writeCache(ov);
  applyBalance(ov);
  return ov;
}

// Écrit les overrides : cache local d'abord (toujours), puis Supabase.
export async function saveBalance(ov) {
  // Retire une éventuelle clé `items` résiduelle (les objets sont gérés par
  // quete_items désormais, plus par les overrides d'équilibrage).
  const { items, ...clean } = ov || {};
  writeCache(clean);
  applyBalance(clean);
  const { error } = await supabase
    .from(BALANCE_TABLE)
    .upsert({ id: BALANCE_ROW_ID, data: clean, updated_at: new Date().toISOString() });
  if (error) throw error;
  return clean;
}
