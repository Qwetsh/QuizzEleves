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
import { supabase, BALANCE_TABLE, BALANCE_ROW_ID } from './supabaseClient.js';

// Snapshot des valeurs par défaut, capturé À L'IMPORT (donc avant toute
// mutation). Sert de base de reset et de référence pour l'éditeur.
// NB : les OBJETS ne passent plus par ici — ils sont pilotés par la table
// quete_items (voir src/logic/itemsConfig.js). balanceConfig ne gère que les
// pouvoirs et les paramètres de loot.
const clone = (v) => JSON.parse(JSON.stringify(v));
const DEFAULT_POWERS = clone(POWERS);

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
};

export const LOOT = { ...DEFAULT_LOOT };

export const DEFAULTS = { powers: DEFAULT_POWERS, loot: DEFAULT_LOOT };

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
    p.levels = d.levels.map((lv) => ({ ...lv, effect: { ...lv.effect } }));
  }
  Object.assign(LOOT, DEFAULT_LOOT);
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
  }

  if (ov.loot) Object.assign(LOOT, ov.loot);
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
