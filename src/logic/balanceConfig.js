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

export const DEFAULTS = { powers: DEFAULT_POWERS, loot: DEFAULT_LOOT, sets: DEFAULT_SETS };

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
  // Sets : restaure name/bonus2/bonus3 d'origine (clone profond).
  for (const [k, d] of Object.entries(DEFAULT_SETS)) {
    if (!SETS[k]) continue;
    SETS[k].name = d.name;
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
        if (Array.isArray(o.tree[b])) o.tree[b].forEach((br, j) => { if (br?.effect && p.tree[b][j]) deepAssign(p.tree[b][j].effect, br.effect); });
      }
    }
  }

  if (ov.loot) Object.assign(LOOT, ov.loot);

  // Bonus de sets modifiés (name / bonus2 / bonus3).
  for (const [k, o] of Object.entries(ov.sets || {})) {
    const s = SETS[k];
    if (!s || !o) continue;
    if (o.name != null) s.name = o.name;
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
