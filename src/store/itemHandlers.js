import { ITEMS, SLOTS } from '../data/items.js';
import { moveForward } from '../logic/pathfinding.js';
import { LOOT } from '../logic/balanceConfig.js';
import { saveGame } from './persistence.js';
import { runEffects, consumableActions, announce } from './effectEngine.js';

export const BAG_SIZE = 12;
export const SHOP_STOCK_SIZE = 4;

export function sellPrice(item) {
  return Math.ceil(item.price / 2);
}

// --- Sac positionnel ---
// Le sac est un tableau de BAG_SIZE cases (itemKey | null) : les objets gardent
// leur case pour le drag & drop de l'inventaire. Tolère les anciennes
// sauvegardes (tableaux compacts plus courts).
export function normalizeBag(bag) {
  const arr = (Array.isArray(bag) ? bag.slice(0, BAG_SIZE) : []).map((k) => (k && ITEMS[k] ? k : null));
  while (arr.length < BAG_SIZE) arr.push(null);
  return arr;
}

export function bagCount(bag) {
  return (bag || []).filter(Boolean).length;
}

function firstFreeCell(bag) {
  return bag.indexOf(null);
}

// Ajoute un objet dans la premiere case libre. Retourne null si sac plein.
function bagWith(bag, itemKey) {
  const arr = normalizeBag(bag);
  const i = firstFreeCell(arr);
  if (i === -1) return null;
  arr[i] = itemKey;
  return arr;
}

// L'equipe peut-elle recevoir cet objet sans le perdre ? (slot d'equipement
// libre, ou une case de sac disponible). A verifier AVANT tout achat — sinon
// grantItem convertit l'objet en pieces de revente et l'acheteur perd la
// difference.
export function canReceiveItem(team, itemKey) {
  const item = ITEMS[itemKey];
  if (!item) return false;
  if (item.slot !== 'consumable' && !(team.equipment || {})[item.slot]) return true;
  return normalizeBag(team.bag).includes(null);
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

// Boutique : les objets lootOnly (légendaires) sont exclus pour que le loot
// reste désirable.
export function generateShopStock(count = SHOP_STOCK_SIZE, enabledKeys = Object.keys(ITEMS)) {
  return pickWeightedItems(count, enabledKeys, (item) =>
    item.lootOnly ? 0 : item.rarity === 'commun' ? LOOT.shopWeightCommon : LOOT.shopWeightOther
  );
}

// Tirage d'un objet de loot (coffres, récompense de duel...) parmi les objets
// activés. legendaryChance : probabilité (0-1) de tomber sur un légendaire.
// opts.category : 'all' (défaut), 'consumable' ou 'equipment' pour restreindre le pool.
// Retourne null si aucun objet n'est activé dans la catégorie.
export function pickLootItem(legendaryChance = 0.15, enabledKeys = Object.keys(ITEMS), { category = 'all' } = {}) {
  let valid = enabledKeys.filter((k) => ITEMS[k]);
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
  return pickWeightedItems(count, enabledKeys, (item) =>
    item.rarity === 'legendaire' ? 4 : item.rarity === 'rare' ? 3 : 1
  );
}

export function buyItem(set, get, itemKey) {
  const { teams, currentTeam, shopStock, showShop, addLog } = get();
  const team = teams[currentTeam];
  const item = ITEMS[itemKey];
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
    newTeams[currentTeam] = { ...team, money: team.money - price, equipment };
    addLog(`🛒 ${team.emoji} ${team.name} équipe ${item.icon} ${item.name} ! (-${price} 💰)`);
  } else {
    const bag = bagWith(team.bag, itemKey);
    if (!bag) return; // sac plein
    newTeams[currentTeam] = { ...team, money: team.money - price, bag };
    addLog(`🛒 ${team.emoji} ${team.name} achète ${item.icon} ${item.name} ! (-${price} 💰)`);
  }

  const restStock = stock.filter((k) => k !== itemKey);
  set(mn
    ? { teams: newTeams, showShop: { ...showShop, stock: restStock } }
    : { teams: newTeams, shopStock: restStock });
  saveGame(get());
}

export function sellEquipment(set, get, slot) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const itemKey = team.equipment?.[slot];
  const item = ITEMS[itemKey];
  if (!item) return;

  const refund = sellPrice(item);
  const newTeams = [...teams];
  newTeams[currentTeam] = {
    ...team,
    money: team.money + refund,
    equipment: { ...team.equipment, [slot]: null },
  };
  addLog(`♻️ ${team.emoji} ${team.name} revend ${item.icon} ${item.name} (+${refund} 💰).`);
  set({ teams: newTeams });
  saveGame(get());
}

export function sellBagItem(set, get, bagIndex) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const bag = normalizeBag(team.bag);
  const item = ITEMS[bag[bagIndex]];
  if (!item) return;

  const refund = sellPrice(item);
  bag[bagIndex] = null;
  const newTeams = [...teams];
  newTeams[currentTeam] = { ...team, money: team.money + refund, bag };
  addLog(`♻️ ${team.emoji} ${team.name} revend ${item.icon} ${item.name} (+${refund} 💰).`);
  set({ teams: newTeams });
  saveGame(get());
}

// --- Drag & drop de l'inventaire ---
// Cles de case : 'equip:head' | 'equip:body' | 'equip:feet' | 'bag:0'..'bag:11'

function readCell(equipment, bag, key) {
  return key.startsWith('equip:') ? equipment[key.slice(6)] : bag[+key.slice(4)];
}

export function isValidMove(team, fromKey, toKey) {
  if (!toKey || toKey === fromKey) return false;
  const equipment = team.equipment || { head: null, body: null, feet: null };
  const bag = normalizeBag(team.bag);
  const itemKey = readCell(equipment, bag, fromKey);
  const item = ITEMS[itemKey];
  if (!item) return false;

  if (toKey.startsWith('equip:')) {
    return item.slot === toKey.slice(6);
  }
  // cible = sac
  const targetKey = readCell(equipment, bag, toKey);
  if (!targetKey) return true;
  if (fromKey.startsWith('bag:')) return true; // echange libre dans le sac
  // depuis l'equipement : l'objet deloge doit pouvoir prendre la place
  return ITEMS[targetKey]?.slot === fromKey.slice(6);
}

export function moveInventoryItem(set, get, fromKey, toKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  if (!isValidMove(team, fromKey, toKey)) return;

  const equipment = { ...(team.equipment || { head: null, body: null, feet: null }) };
  const bag = normalizeBag(team.bag);
  const write = (key, value) => {
    if (key.startsWith('equip:')) equipment[key.slice(6)] = value;
    else bag[+key.slice(4)] = value;
  };
  const a = readCell(equipment, bag, fromKey);
  const b = readCell(equipment, bag, toKey);
  write(toKey, a);
  write(fromKey, b);

  const newTeams = [...teams];
  newTeams[currentTeam] = { ...team, equipment, bag };
  set({ teams: newTeams });
  if (toKey.startsWith('equip:')) {
    addLog(`\u{1F392} ${team.emoji} ${team.name} équipe ${ITEMS[a].icon} ${ITEMS[a].name} !`);
  } else if (fromKey.startsWith('equip:')) {
    addLog(`\u{1F392} ${team.emoji} ${team.name} range ${ITEMS[a].icon} ${ITEMS[a].name} dans le sac.`);
  }
  saveGame(get());
}

// Cascade d'attribution d'un objet — LA politique unique du jeu, partagée par
// la boutique, les coffres, le marchand, le pillage et le butin de combat :
// équipement avec slot libre → équipé ; sinon → sac ; sac plein → revendu.
// Pure (pas de set/log) : retourne { team, outcome, refund } avec
// outcome ∈ 'equipped' | 'bagged' | 'refunded', chaque appelant formate
// son propre message à partir de l'outcome.
export function placeItem(team, itemKey) {
  const item = ITEMS[itemKey];
  if (!item) return { team, outcome: 'refunded', refund: 0 }; // clé inconnue/supprimée : no-op sûr
  const equipment = { ...(team.equipment || { head: null, body: null, feet: null }) };
  if (item.slot !== 'consumable' && !equipment[item.slot]) {
    equipment[item.slot] = itemKey;
    return { team: { ...team, equipment }, outcome: 'equipped', refund: 0 };
  }
  const bag = bagWith(team.bag, itemKey);
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
  const itemKey = bag[bagIndex];
  const item = ITEMS[itemKey];
  if (!item || item.slot !== 'consumable') return;

  bag[bagIndex] = null;
  const newTeams = [...teams];
  newTeams[currentTeam] = { ...team, bag };
  set({ teams: newTeams, showInventory: false });
  addLog(`${item.icon} ${team.emoji} ${team.name} utilise ${item.name} !`);

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
