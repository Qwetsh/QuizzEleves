import { ITEMS, SLOTS } from '../data/items.js';
import { matchRecipe } from '../data/recipes.js';
import { itemKeyOf, itemEnchantsOf } from '../logic/itemEffects.js';
import { moveForward } from '../logic/pathfinding.js';
import { LOOT } from '../logic/balanceConfig.js';
import { saveGame } from './persistence.js';
import { runEffects, consumableActions, announce } from './effectEngine.js';

export const BAG_SIZE = 12;
// Vitrine de la boutique : N consommables + N équipements affichés en même temps.
// Le stock ne tourne plus tout seul : chaque achat est remplacé aussitôt par un
// nouvel objet de la MÊME catégorie (cf. buyItem + pickReplacement).
export const SHOP_CONSUMABLE_SLOTS = 8;
export const SHOP_EQUIPMENT_SLOTS = 8;
// Plafond d'une pile de consommables identiques (au-delà → nouvelle case).
export const STACK_MAX = 9;

export function sellPrice(item) {
  return Math.ceil(item.price / 2);
}

// Prix du moins cher des objets actuellement en arrivage (stock = tableau de
// clés). Sert au prompt « Visiter la boutique ? » : on ne le propose que si
// l'équipe peut s'offrir au moins un objet. Infinity si le stock est vide.
export function cheapestStockPrice(stock) {
  const prices = (Array.isArray(stock) ? stock : [])
    .map((k) => ITEMS[k]?.price)
    .filter((p) => typeof p === 'number');
  return prices.length ? Math.min(...prices) : Infinity;
}

// --- Sac positionnel & PILES ---
// Une case du sac est : null | "clé" (1 exemplaire) | { key, n } (pile de n≥2).
// On garde la forme « chaîne » pour 1 exemplaire (rétro-compatible avec les
// sauvegardes et la plupart du code). Seuls les CONSOMMABLES se stackent ;
// l'équipement reste toujours à 1 par case.
export const cellKey = (c) => (c == null ? null : typeof c === 'string' ? c : c.key);
export const cellN = (c) => (c == null ? 0 : typeof c === 'string' ? 1 : (Number(c.n) || 1));
// Enchantements portés par une case (Enchantement) — vide si objet « nu ».
export const cellEnchants = (c) => (c && typeof c === 'object' && Array.isArray(c.enchants) ? c.enchants : []);
// Forme canonique : chaîne si 1 exemplaire nu ; objet { key, n } pour une pile ;
// objet { key, n, enchants } pour une pièce enchantée (toujours non empilable).
export const mkCell = (key, n, enchants) => {
  if (enchants && enchants.length) return { key, n: Math.max(1, n || 1), enchants };
  return n <= 1 ? key : { key, n };
};

// Le sac est un tableau de BAG_SIZE cases : les objets gardent leur case pour le
// drag & drop. Tolère les anciennes sauvegardes (tableaux compacts plus courts,
// et entrées sous forme de simples clés).
export function normalizeBag(bag) {
  const arr = (Array.isArray(bag) ? bag.slice(0, BAG_SIZE) : []).map((c) => {
    const k = cellKey(c);
    if (!k || !ITEMS[k]) return null;
    return mkCell(k, Math.min(Math.max(1, cellN(c)), STACK_MAX), cellEnchants(c));
  });
  while (arr.length < BAG_SIZE) arr.push(null);
  return arr;
}

// Nombre de CASES occupées (pour « sac plein »).
export function bagCount(bag) {
  return (bag || []).filter(Boolean).length;
}

// Nombre total d'UNITÉS (somme des piles) — pour les badges « combien d'objets ».
export function bagUnitCount(bag) {
  return (bag || []).reduce((s, c) => s + cellN(c), 0);
}

function firstFreeCell(bag) {
  return bag.indexOf(null);
}

// Ajoute un objet : empile sur une pile compatible (même consommable, sous le
// plafond) sinon première case libre. Retourne null si rien de possible (plein).
function bagWith(bag, itemKey, enchants = []) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const arr = normalizeBag(bag);
  // Les objets ENCHANTÉS ne s'empilent jamais (chaque instance est unique).
  if (item.slot === 'consumable' && !(enchants && enchants.length)) {
    const i = arr.findIndex((c) => cellKey(c) === itemKey && !cellEnchants(c).length && cellN(c) < STACK_MAX);
    if (i !== -1) { arr[i] = mkCell(itemKey, cellN(arr[i]) + 1); return arr; }
  }
  const free = firstFreeCell(arr);
  if (free === -1) return null;
  arr[free] = mkCell(itemKey, 1, enchants);
  return arr;
}

// L'equipe peut-elle recevoir cet objet sans le perdre ? (slot d'equipement
// libre, case de sac libre, ou pile compatible non pleine). A verifier AVANT
// tout achat — sinon grantItem convertit l'objet en pieces de revente.
export function canReceiveItem(team, itemKey) {
  const item = ITEMS[itemKey];
  if (!item) return false;
  if (item.slot !== 'consumable' && !(team.equipment || {})[item.slot]) return true;
  const bag = normalizeBag(team.bag);
  if (bag.includes(null)) return true;
  if (item.slot === 'consumable') return bag.some((c) => cellKey(c) === itemKey && cellN(c) < STACK_MAX);
  return false;
}

// --- Stock rotatif de la boutique ---

// Tirage pondéré sans doublon parmi les objets activés. weightOf(item) donne
// le poids entier d'un objet (0 = exclu). Sert à la boutique ET au marchand
// ambulant (eventHandlers) — un seul sampler à maintenir.
export function pickWeightedItems(count, enabledKeys, weightOf) {
  const weighted = [];
  for (const key of enabledKeys) {
    const item = ITEMS[key];
    if (!item) continue;
    const weight = weightOf(item);
    for (let i = 0; i < weight; i++) weighted.push(key);
  }
  if (weighted.length === 0) return [];
  const distinct = new Set(weighted).size;
  const stock = [];
  const used = new Set();
  let guard = 0;
  while (stock.length < count && used.size < distinct && guard++ < 500) {
    const key = weighted[Math.floor(Math.random() * weighted.length)];
    if (!used.has(key)) { used.add(key); stock.push(key); }
  }
  return stock;
}

// Poids d'un objet dans la boutique normale (lootOnly/légendaire exclus pour
// que le loot reste désirable).
const shopWeightOf = (item) =>
  item.lootOnly ? 0 : item.rarity === 'commun' ? LOOT.shopWeightCommon : LOOT.shopWeightOther;

const isConsumableKey = (k) => ITEMS[k]?.slot === 'consumable';

// Tire `count` objets d'une catégorie ('consumable' | 'equipment') parmi les
// objets activés, en excluant les clés déjà présentes (`exclude`).
export function pickShopItems(category, count, enabledKeys = Object.keys(ITEMS), exclude = [], allowFamilies = []) {
  const ex = new Set(exclude);
  const fam = new Set(allowFamilies); // familles autorisées en vitrine (ext. active)
  const pool = enabledKeys.filter((k) => {
    const it = ITEMS[k];
    if (!it || ex.has(k)) return false;
    if (it.family && !fam.has(it.family)) return false; // ingrédient/potion/parchemin : seulement si autorisé
    return category === 'consumable' ? it.slot === 'consumable' : it.slot !== 'consumable';
  });
  return pickWeightedItems(count, pool, shopWeightOf);
}

// Vitrine de la boutique : SHOP_CONSUMABLE_SLOTS consommables + SHOP_EQUIPMENT_SLOTS
// équipements. `allowFamilies` (ex. ['ingredient','parchment']) ajoute ces familles
// quand les extensions Alchimie/Enchantement sont actives.
export function generateShopStock(enabledKeys = Object.keys(ITEMS), allowFamilies = []) {
  return [
    ...pickShopItems('consumable', SHOP_CONSUMABLE_SLOTS, enabledKeys, [], allowFamilies),
    ...pickShopItems('equipment', SHOP_EQUIPMENT_SLOTS, enabledKeys),
  ];
}

// Objet de remplacement après un achat : même catégorie que `boughtKey`, absent
// du stock courant ET différent de l'objet acheté (pour qu'il ne réapparaisse
// pas aussitôt). null si le pool est épuisé.
export function pickReplacement(boughtKey, stock = [], enabledKeys = Object.keys(ITEMS), allowFamilies = []) {
  const category = isConsumableKey(boughtKey) ? 'consumable' : 'equipment';
  // L'équipement ne reçoit jamais de famille ; les consommables oui (ext. active).
  const picked = pickShopItems(category, 1, enabledKeys, [...stock, boughtKey], category === 'consumable' ? allowFamilies : []);
  return picked[0] || null;
}

// Tirage d'un objet de loot (coffres, récompense de duel...) parmi les objets
// activés. legendaryChance : probabilité (0-1) de tomber sur un légendaire.
// opts.category : 'all' (défaut), 'consumable' ou 'equipment' pour restreindre le pool.
// Retourne null si aucun objet n'est activé dans la catégorie.
export function pickLootItem(legendaryChance = 0.15, enabledKeys = Object.keys(ITEMS), { category = 'all' } = {}) {
  let valid = enabledKeys.filter((k) => ITEMS[k] && !ITEMS[k].family); // pas d'ingrédient/potion/parchemin en loot aléatoire
  if (category === 'consumable') valid = valid.filter((k) => ITEMS[k].slot === 'consumable');
  else if (category === 'equipment') valid = valid.filter((k) => ITEMS[k].slot !== 'consumable');
  if (valid.length === 0) return null;
  const isLegendary = Math.random() < legendaryChance;
  let pool = valid.filter((k) => (ITEMS[k].rarity === 'legendaire') === isLegendary);
  // Rabattement sur l'autre pool si la rarete tiree n'a aucun objet active
  if (pool.length === 0) pool = valid;
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Achat / revente ---

// Stock du Marché Noir : INCLUT les objets lootOnly/légendaires (introuvables en
// boutique normale) avec un fort poids — l'attrait « louche » de l'event.
export function generateBlackMarketStock(count = 5, enabledKeys = Object.keys(ITEMS)) {
  // Pas d'ingrédient/potion/parchemin au Marché Noir (familles alchimie/enchant).
  const pool = enabledKeys.filter((k) => ITEMS[k] && !ITEMS[k].family);
  return pickWeightedItems(count, pool, (item) =>
    item.rarity === 'legendaire' ? 4 : item.rarity === 'rare' ? 3 : 1
  );
}

// teamIndex (optionnel) : par défaut l'équipe active ; précisé pour un achat
// piloté depuis un téléphone (cf. applyTeamIntent).
export function buyItem(set, get, itemKey, teamIndex) {
  const { teams, currentTeam, shopStock, showShop, addLog } = get();
  const idx = teamIndex ?? currentTeam;
  const team = teams[idx];
  const item = ITEMS[itemKey];
  if (!team) return;
  // Mode Marché Noir : stock + remise portés par showShop ; sinon boutique normale.
  const mn = showShop && typeof showShop === 'object' && showShop.marcheNoir;
  const stock = mn ? (showShop.stock || []) : shopStock;
  if (!item || !stock.includes(itemKey)) return;
  const price = mn ? Math.max(1, Math.round(item.price * (showShop.discount ?? 1))) : item.price;
  if ((team.money ?? 0) < price) return;

  const newTeams = [...teams];
  const equipment = { ...(team.equipment || { head: null, body: null, feet: null }) };

  // Equipement avec slot libre : equipe directement ; sinon (slot occupe ou
  // consommable) : va dans le sac — le joueur gere son equipement par drag & drop
  if (item.slot !== 'consumable' && !equipment[item.slot]) {
    equipment[item.slot] = itemKey;
    newTeams[idx] = { ...team, money: team.money - price, equipment };
    addLog(`🛒 ${team.emoji} ${team.name} équipe ${item.icon} ${item.name} ! (-${price} 💰)`);
  } else {
    const bag = bagWith(team.bag, itemKey);
    if (!bag) return; // sac plein
    newTeams[idx] = { ...team, money: team.money - price, bag };
    addLog(`🛒 ${team.emoji} ${team.name} achète ${item.icon} ${item.name} ! (-${price} 💰)`);
  }

  const restStock = stock.filter((k) => k !== itemKey);
  if (mn) {
    // Marché Noir : stock clandestin qui s'épuise (pas de réassort).
    set({ teams: newTeams, showShop: { ...showShop, stock: restStock } });
  } else {
    // Boutique : un nouvel objet de la même catégorie arrive aussitôt.
    const replacement = pickReplacement(itemKey, restStock, get().enabledItems, get().shopFamilies?.() || []);
    set({ teams: newTeams, shopStock: replacement ? [...restStock, replacement] : restStock });
  }
  saveGame(get());
}

// teamIndex (optionnel) : par défaut l'équipe active ; précisé pour les actions
// pilotées par un téléphone (édition à distance d'une équipe donnée).
export function sellEquipment(set, get, slot, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const idx = teamIndex ?? currentTeam;
  const team = teams[idx];
  const itemKey = itemKeyOf(team?.equipment?.[slot]);
  const item = ITEMS[itemKey];
  if (!item) return;

  const refund = sellPrice(item);
  const newTeams = [...teams];
  newTeams[idx] = {
    ...team,
    money: team.money + refund,
    equipment: { ...team.equipment, [slot]: null },
  };
  addLog(`♻️ ${team.emoji} ${team.name} revend ${item.icon} ${item.name} (+${refund} 💰).`);
  set({ teams: newTeams });
  saveGame(get());
}

// Revend UNE unité de la case (la pile diminue ; la case se libère à 0).
export function sellBagItem(set, get, bagIndex, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const idx = teamIndex ?? currentTeam;
  const team = teams[idx];
  const bag = normalizeBag(team.bag);
  const cell = bag[bagIndex];
  const key = cellKey(cell);
  const item = ITEMS[key];
  if (!item) return;

  const refund = sellPrice(item);
  bag[bagIndex] = cellN(cell) > 1 ? mkCell(key, cellN(cell) - 1) : null;
  const newTeams = [...teams];
  newTeams[idx] = { ...team, money: team.money + refund, bag };
  addLog(`♻️ ${team.emoji} ${team.name} revend ${item.icon} ${item.name} (+${refund} 💰).`);
  set({ teams: newTeams });
  saveGame(get());
}

// --- Drag & drop de l'inventaire ---
// Cles de case : 'equip:head' | 'equip:body' | 'equip:feet' | 'bag:0'..'bag:11'

// Cellule BRUTE d'une case (chaîne pour l'équipement, cell pour le sac).
function rawCell(equipment, bag, key) {
  return key.startsWith('equip:') ? equipment[key.slice(6)] : bag[+key.slice(4)];
}

export function isValidMove(team, fromKey, toKey) {
  if (!toKey || toKey === fromKey) return false;
  const equipment = team.equipment || { head: null, body: null, feet: null };
  const bag = normalizeBag(team.bag);
  const itemKey = cellKey(rawCell(equipment, bag, fromKey));
  const item = ITEMS[itemKey];
  if (!item) return false;

  if (toKey.startsWith('equip:')) {
    return item.slot === toKey.slice(6);
  }
  // cible = sac
  const targetKey = cellKey(rawCell(equipment, bag, toKey));
  if (!targetKey) return true;
  if (fromKey.startsWith('bag:')) return true; // echange libre dans le sac
  // depuis l'equipement : l'objet deloge doit pouvoir prendre la place
  return ITEMS[targetKey]?.slot === fromKey.slice(6);
}

export function moveInventoryItem(set, get, fromKey, toKey, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const idx = teamIndex ?? currentTeam;
  const team = teams[idx];
  if (!team || !isValidMove(team, fromKey, toKey)) return;

  const equipment = { ...(team.equipment || { head: null, body: null, feet: null }) };
  const bag = normalizeBag(team.bag);
  // Écrit une valeur : l'équipement ne stocke que la CLÉ (jamais de pile) ; le
  // sac conserve la cellule telle quelle (préserve une pile lors d'un échange).
  const write = (key, value) => {
    if (key.startsWith('equip:')) {
      // Équipement : clé nue, OU instance { key, enchants } si la pièce est enchantée.
      const ench = cellEnchants(value);
      equipment[key.slice(6)] = ench.length ? { key: cellKey(value), enchants: ench } : cellKey(value);
    } else {
      bag[+key.slice(4)] = value;
    }
  };
  const a = rawCell(equipment, bag, fromKey);
  const b = rawCell(equipment, bag, toKey);
  write(toKey, a);
  write(fromKey, b);

  const newTeams = [...teams];
  newTeams[idx] = { ...team, equipment, bag };
  set({ teams: newTeams });
  const movedItem = ITEMS[cellKey(a)];
  if (toKey.startsWith('equip:')) {
    addLog(`\u{1F392} ${team.emoji} ${team.name} équipe ${movedItem.icon} ${movedItem.name} !`);
  } else if (fromKey.startsWith('equip:')) {
    addLog(`\u{1F392} ${team.emoji} ${team.name} range ${movedItem.icon} ${movedItem.name} dans le sac.`);
  }
  saveGame(get());
}

// Cascade d'attribution d'un objet — LA politique unique du jeu, partagée par
// la boutique, les coffres, le marchand, le pillage et le butin de combat :
// équipement avec slot libre → équipé ; sinon → sac ; sac plein → revendu.
// Pure (pas de set/log) : retourne { team, outcome, refund } avec
// outcome ∈ 'equipped' | 'bagged' | 'refunded', chaque appelant formate
// son propre message à partir de l'outcome.
// `itemOrInstance` : une clé "casque" OU une instance { key, enchants } (Enchantement).
export function placeItem(team, itemOrInstance) {
  const itemKey = itemKeyOf(itemOrInstance);
  const enchants = itemEnchantsOf(itemOrInstance);
  const item = ITEMS[itemKey];
  if (!item) return { team, outcome: 'refunded', refund: 0 }; // clé inconnue/supprimée : no-op sûr
  const equipment = { ...(team.equipment || { head: null, body: null, feet: null }) };
  if (item.slot !== 'consumable' && !equipment[item.slot]) {
    equipment[item.slot] = enchants.length ? { key: itemKey, enchants } : itemKey;
    return { team: { ...team, equipment }, outcome: 'equipped', refund: 0 };
  }
  const bag = bagWith(team.bag, itemKey, enchants);
  if (!bag) {
    const refund = sellPrice(item);
    return { team: { ...team, money: team.money + refund }, outcome: 'refunded', refund };
  }
  return { team: { ...team, bag }, outcome: 'bagged', refund: 0 };
}

// Ajoute un objet looté en journalisant l'issue de la cascade.
// Retourne l'issue { outcome, refund } pour que l'appelant puisse, par ex.,
// déclencher (ou non) le visuel de gain d'objet selon l'outcome.
export function grantItem(set, get, teamIndex, itemKey) {
  const { teams, addLog } = get();
  const team = teams[teamIndex];
  const item = ITEMS[itemKey];
  if (!team || !item) return null;

  const r = placeItem(team, itemKey);
  const newTeams = [...teams];
  newTeams[teamIndex] = r.team;

  if (r.outcome === 'equipped') {
    addLog(`🎁 ${team.emoji} ${team.name} équipe ${item.icon} ${item.name} (${SLOTS[item.slot].name}) !`);
  } else if (r.outcome === 'refunded') {
    addLog(`🎒 Sac plein ! ${item.icon} ${item.name} est revendu (+${r.refund} 💰).`);
  } else {
    addLog(`🎁 ${team.emoji} ${team.name} obtient ${item.icon} ${item.name} !`);
  }

  set({ teams: newTeams });
  return { outcome: r.outcome, refund: r.refund };
}

// --- Consommables ---

export function useConsumable(set, get, bagIndex) {
  const { teams, currentTeam, finished, rolling, showQuestion, showEvent, showFight, pendingActions, addLog } = get();
  if (finished || rolling || showQuestion || showEvent || showFight) return;
  if (pendingActions) return; // une séquence d'effets est déjà en cours
  const team = teams[currentTeam];
  const bag = normalizeBag(team.bag);
  const cell = bag[bagIndex];
  const itemKey = cellKey(cell);
  const item = ITEMS[itemKey];
  if (!item || item.slot !== 'consumable') return;

  // Parchemin d'enchantement : ne s'applique pas comme un effet — il faut choisir
  // une PIÈCE équipée à enchanter (sélecteur). Voir enchantWith.
  if (item.family === 'parchment') {
    const slots = ['head', 'body', 'feet'].filter((s) => itemKeyOf(team.equipment?.[s]));
    if (!slots.length) { addLog(`📜 ${team.emoji} ${team.name} : aucune pièce équipée à enchanter !`); return; }
    set({ showEnchantPicker: { bagIndex, slots }, showInventory: false });
    return;
  }

  // Consomme UNE unité (la pile diminue ; la case se libère à 0).
  bag[bagIndex] = cellN(cell) > 1 ? mkCell(itemKey, cellN(cell) - 1) : null;
  const newTeams = [...teams];
  // Alchimie : utiliser un ingrédient seul le RÉVÈLE dans le grimoire de l'équipe.
  const teamPatch = { bag };
  if (item.family === 'ingredient') {
    const known = team.knownIngredients || [];
    if (!known.includes(itemKey)) teamPatch.knownIngredients = [...known, itemKey];
  }
  newTeams[currentTeam] = { ...team, ...teamPatch };
  set({ teams: newTeams, showInventory: false });
  addLog(`${item.icon} ${team.emoji} ${team.name} utilise ${item.name} !`);
  get().recordStat?.('itemUses', { teamIdx: currentTeam, key: itemKey });

  // Tout (legacy {type,value} + composable {kind:'trigger'}) passe par le moteur.
  const actions = consumableActions(item);
  if (!actions.length) {
    // Aucun effet produit : soit une probabilité de déclenchement a échoué,
    // soit l'objet n'a aucun effet actionnable. On le signale visuellement
    // (sinon l'objet disparaît sans aucun retour).
    const wasGamble = (item.effects || []).some((fx) => typeof fx.chance === 'number'); // legacy ET triggers portent `chance`
    if (wasGamble) {
      addLog(`💨 ${item.name} : raté, aucun effet cette fois…`);
      announce(set, get, '💨', `Raté ! ${item.name} n'a rien fait`, '#9a8c7a');
    } else {
      addLog(`💨 ${item.name} n'a eu aucun effet.`);
      announce(set, get, '🤷', `${item.name} : aucun effet`, '#9a8c7a');
    }
    if (get().phase === 'game') saveGame(get());
    return;
  }
  runEffects(set, get, actions, { source: 'item', itemKey, bagIndex });
}

// === ENCHANTEMENT : applique un parchemin du sac sur une pièce équipée ========
// L'enchantement est ajouté à l'INSTANCE de la pièce (clé + enchants) — il suit
// donc l'objet (déséquiper, troc, etc.). Consomme le parchemin. { ok, reason? }.
export function enchantWith(set, get, teamIdx, bagIndex, slot) {
  const { teams } = get();
  const team = teams[teamIdx];
  if (!team) return { ok: false, reason: 'équipe invalide' };
  const bag = normalizeBag(team.bag);
  const pKey = cellKey(bag[bagIndex]);
  const parch = ITEMS[pKey];
  if (!parch || parch.family !== 'parchment' || !parch.enchant) return { ok: false, reason: 'pas un parchemin' };
  if (!['head', 'body', 'feet'].includes(slot)) return { ok: false, reason: 'emplacement invalide' };
  const cur = team.equipment?.[slot];
  const curKey = itemKeyOf(cur);
  if (!curKey || !ITEMS[curKey]) return { ok: false, reason: 'aucune pièce sur cet emplacement' };

  const enchants = [...itemEnchantsOf(cur), parch.enchant];
  const equipment = { ...team.equipment, [slot]: { key: curKey, enchants } };
  const nbag = [...bag];
  nbag[bagIndex] = cellN(bag[bagIndex]) > 1 ? mkCell(pKey, cellN(bag[bagIndex]) - 1) : null;
  const nt = [...teams];
  nt[teamIdx] = { ...team, equipment, bag: nbag };
  set({ teams: nt });
  get().addLog(`📜 ${team.emoji} ${team.name} enchante ${ITEMS[curKey].icon} ${ITEMS[curKey].name} (${SLOTS[slot].name}) avec ${parch.name} !`);
  if (get().phase === 'game') saveGame(get());
  return { ok: true };
}

// === ALCHIMIE : distillation de 3 ingrédients du sac en une potion ===========
// `indices` = 3 positions DISTINCTES du sac (ingrédients). Cherche une recette
// (multiset), consomme les 3, ajoute la potion (placeItem) et enregistre la
// recette dans le grimoire de l'équipe. Renvoie { ok, potion?, discovered? }.
export function craftPotion(set, get, teamIdx, indices) {
  const { teams, addLog } = get();
  const team = teams[teamIdx];
  if (!team) return { ok: false, reason: 'équipe invalide' };
  const bag = normalizeBag(team.bag);
  const idx = [...new Set((indices || []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < bag.length);
  if (idx.length !== 3) return { ok: false, reason: '3 ingrédients distincts requis' };
  const keys = idx.map((i) => cellKey(bag[i]));
  if (keys.some((k) => !k || ITEMS[k]?.family !== 'ingredient')) return { ok: false, reason: 'ingrédients invalides' };

  // Consomme une unité de chaque ingrédient.
  let t = { ...team, bag: [...bag] };
  for (const i of idx) { const c = t.bag[i]; t.bag[i] = cellN(c) > 1 ? mkCell(cellKey(c), cellN(c) - 1) : null; }

  const recipe = matchRecipe(keys);
  const nt = [...teams];
  if (recipe && ITEMS[recipe.potion]) {
    t = placeItem(t, recipe.potion).team;
    const known = t.knownRecipes || [];
    const discovered = !known.includes(recipe.id);
    if (discovered) t = { ...t, knownRecipes: [...known, recipe.id] };
    nt[teamIdx] = t; set({ teams: nt });
    addLog(`⚗️ ${team.emoji} ${team.name} distille ${ITEMS[recipe.potion].icon} ${ITEMS[recipe.potion].name} !${discovered ? ' ✨ Recette découverte !' : ''}`);
    if (get().phase === 'game') saveGame(get());
    return { ok: true, potion: recipe.potion, discovered };
  }
  nt[teamIdx] = t; set({ teams: nt });
  addLog(`💨 ${team.emoji} ${team.name} : distillation ratée (eau trouble).`);
  if (get().phase === 'game') saveGame(get());
  return { ok: false, reason: 'aucune recette' };
}
