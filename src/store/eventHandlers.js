import { POWERS, MAX_CHARGES, addCharge } from '../data/powers.js';
import { moveForward, findPrevJunction, buildPredecessors } from '../logic/pathfinding.js';
import { pickQuestion } from '../logic/questionPicker.js';
import { applyRecul } from '../logic/turnHelpers.js';
import { hasEffect, reducedSteal, reducedTax, equippedSetCounts, isItemStealImmune } from '../logic/itemEffects.js';
import { ITEMS, SLOTS, RARITIES } from '../data/items.js';
import { SETS } from '../data/sets.js';
import { pickLootItem, grantItem, canReceiveItem, placeItem, pickWeightedItems, normalizeBag, bagCount, generateBlackMarketStock, cellKey, cellN, mkCell } from './itemHandlers.js';
import { LOOT } from '../logic/balanceConfig.js';
import { EVENTS } from '../data/events.js';
import { extOn } from '../extensions/registry.js';
import { runEffects } from './effectEngine.js';
import { tg, tgPlural } from '../i18n';
import { loc, locName } from '../i18n/content';

// Etal du marchand ambulant : 3 objets distincts parmi les objets actives,
// ponderes par rarete (les legendaires sont rares mais possibles — contrairement
// a la boutique)
function generateMerchantStock(count = 3, enabledKeys = Object.keys(ITEMS)) {
  // Pas d'ingrédient/potion/parchemin (familles alchimie/enchant) chez le marchand.
  const pool = enabledKeys.filter((k) => ITEMS[k] && !ITEMS[k].family);
  return pickWeightedItems(count, pool, (item) =>
    item.rarity === 'commun' ? 3 : item.rarity === 'rare' ? 2 : 1
  );
}

export function merchantPrice(item) {
  // Remise du marchand ambulant, éditable (params.discountPct, défaut 30%).
  const pct = EVENTS.marchandAmbulant?.params?.discountPct ?? 30;
  return Math.ceil(item.price * (1 - pct / 100));
}

// --- Animation helpers ---

function toWaypoints(board, path) {
  return path.map((id) => ({ x: board[id].x, y: board[id].y }));
}

// Chemin avant jusqu'a la prochaine jonction (ou arrivee) en suivant next[0].
// Retourne le chemin complet [from, ..., jonction] ou null si rien devant.
function forwardPathToJunction(board, from) {
  const path = [from];
  let pos = from;
  const visited = new Set();
  while (pos) {
    if (visited.has(pos)) break;
    visited.add(pos);
    const node = board[pos];
    if (!node || node.next.length === 0) break;
    pos = node.next[0];
    path.push(pos);
    if (board[pos].type === 'jonction' || board[pos].type === 'arrivee') return path;
  }
  return null;
}

// Chemin arriere de `from` jusqu'a `target` en suivant les predecesseurs.
function backPathTo(board, from, target) {
  const preds = buildPredecessors(board);
  const path = [from];
  let pos = from;
  let guard = 0;
  while (pos !== target && guard++ < 1000) {
    const p = preds[pos];
    if (!p || p.length === 0) break;
    pos = p[0];
    path.push(pos);
  }
  return path;
}

// --- Event flow actions ---

export function triggerEvent(set, get, picked) {
  // Phase « roulette » : suspense avant la révélation (l'icône/le nom de
  // l'événement sont masqués tant qu'on n'a pas révélé). Voir RoulettePhase.
  set({ showEvent: { ...picked, phase: 'roulette', data: {} }, eventApplied: false });
}

// Fin de la roulette : on dévoile l'événement (passage à la phase d'intro).
export function revealEvent(set, get) {
  const { showEvent } = get();
  if (!showEvent || showEvent.phase !== 'roulette') return;
  set({ showEvent: { ...showEvent, phase: 'intro' } });
}

export function acceptEvent(set, get) {
  const { showEvent } = get();
  if (!showEvent) return;
  const { key } = showEvent;

  // Événement « scripté » : il porte une liste d'ACTIONS du moteur d'effets
  // (buff, randomPathNext, loot, money, placeTrap…). On ferme la modale et on
  // délègue au moteur ; la fin de file (source 'event') enchaîne nextTurn.
  if (Array.isArray(showEvent.event?.actions) && showEvent.event.actions.length) {
    set({ showEvent: null, eventApplied: true });
    runEffects(set, get, showEvent.event.actions, { source: 'event' });
    return;
  }

  const needsTarget = ['decharge', 'sacrifice', 'duel', 'don', 'vol', 'echange', 'volArgent', 'pillage'];
  if (needsTarget.includes(key)) {
    set({ showEvent: { ...showEvent, phase: 'target' } });
    return;
  }

  if (key === 'marchandAmbulant') {
    const count = showEvent.event?.params?.count ?? 3;
    const merchandise = generateMerchantStock(count, get().lootableItems());
    if (merchandise.length === 0) {
      // Aucun objet active : le marchand n'a rien a vendre
      set({ showEvent: { ...showEvent, phase: 'result', data: { ...showEvent.data, message: tg('log.ev.merchantEmpty') } }, eventApplied: true });
      return;
    }
    set({ showEvent: { ...showEvent, phase: 'choice', data: { ...showEvent.data, merchandise } } });
    return;
  }

  if (key === 'troisCoffres') {
    const count = showEvent.event?.params?.count ?? 3;
    const gifts = generateMerchantStock(count, get().lootableItems());
    if (gifts.length === 0) {
      set({ showEvent: { ...showEvent, phase: 'result', data: { ...showEvent.data, message: tg('log.ev.chestsEmpty') } }, eventApplied: true });
      return;
    }
    set({ showEvent: { ...showEvent, phase: 'choice', data: { ...showEvent.data, gifts } } });
    return;
  }

  if (key === 'rejouer' || key === 'quitteDouble' || key === 'tempete') {
    eventRollDice(set, get);
    return;
  }

  if (key === 'pari' || key === 'bonus' || key === 'jackpot' || key === 'sphinx' || key === 'tournoi' || key === 'vaTout') {
    eventAskQuestion(set, get);
    return;
  }

  if (key === 'troc') {
    const t = get().teams[get().currentTeam];
    const hasItems = Object.values(t?.equipment || {}).some((k) => ITEMS[cellKey(k)])
      || (t?.bag || []).some((c) => ITEMS[cellKey(c)]);
    if (!hasItems) {
      set({ showEvent: { ...showEvent, phase: 'result', data: { ...showEvent.data, message: tg('log.ev.nothingToTrade') } }, eventApplied: true });
      return;
    }
    set({ showEvent: { ...showEvent, phase: 'choice' } });
    return;
  }

  if (key === 'recharge') {
    set({ showEvent: { ...showEvent, phase: 'choice' } });
    return;
  }

  if (key === 'bossProf') {
    // Choix du mini-jeu (la liste est construite côté UI depuis le registre).
    set({ showEvent: { ...showEvent, phase: 'choice' } });
    return;
  }

  if (key === 'marcheNoir') {
    // Ouvre la BOUTIQUE en mode « marché noir » : stock louche (objets rares/
    // légendaires normalement introuvables) + remise. Fermer la boutique
    // termine le tour (cf. closeShop). On clôt l'event tout de suite.
    const P = showEvent.event?.params || {};
    const stock = generateBlackMarketStock(P.count ?? 5, get().lootableItems());
    const discount = 1 - (P.discountPct ?? 30) / 100;
    // Voir le Marché Noir compte comme une visite de boutique → reset du prompt.
    const nt = get().teams.slice();
    if (nt[get().currentTeam]) nt[get().currentTeam] = { ...nt[get().currentTeam], turnsSinceShop: 0 };
    set({ showEvent: null, eventApplied: true, showShopPrompt: false, teams: nt, showShop: { marcheNoir: true, stock, discount } });
    return;
  }

  applyEventEffect(set, get);
}

export function declineEvent(set, get) {
  const { addLog, teams, currentTeam } = get();
  const team = teams[currentTeam];
  addLog(tg('log.ev.decline', { emoji: team.emoji, name: team.name }));
  set({ showEvent: null });
  get().finishEventTurn();
}

export function eventSelectTarget(set, get, targetIndex) {
  const { showEvent, teams } = get();
  if (!showEvent) return;
  const { key } = showEvent;

  if (key === 'duel') {
    set({ showEvent: { ...showEvent, phase: 'question', data: { ...showEvent.data, targetIndex } } });
    eventAskQuestion(set, get);
    return;
  }

  // Decharge electrique : cible choisie, puis lancer de de pour le recul
  if (key === 'decharge') {
    set({ showEvent: { ...showEvent, data: { ...showEvent.data, targetIndex } } });
    eventRollDice(set, get);
    return;
  }

  // Vol : si la cible a au moins une charge, choix du pouvoir vole puis du
  // pouvoir recharge ; sinon resultat direct ("rien a voler")
  if (key === 'vol') {
    const target = teams[targetIndex];
    const hasCharges = Object.entries(target?.powers || {}).some(([pk, p]) => POWERS[pk] && p?.charges > 0);
    if (hasCharges) {
      set({ showEvent: { ...showEvent, phase: 'choice', data: { ...showEvent.data, targetIndex } } });
      return;
    }
  }

  // Pillage : si la cible possede au moins un objet, choix de l'objet vole ;
  // sinon resultat direct ("rien a piller")
  if (key === 'pillage') {
    const target = teams[targetIndex];
    // Immunité au vol d'objet : la cible est protégée → « rien à piller » (marqué).
    if (isItemStealImmune(target)) {
      set({ showEvent: { ...showEvent, data: { ...showEvent.data, targetIndex, itemImmune: true } } });
      applyEventEffect(set, get);
      return;
    }
    // Ne compter que les objets EXISTANTS au catalogue (une clé périmée/supprimée
    // ne se rend pas dans la liste → éviterait un soft-lock de la modale).
    const hasItems = Object.values(target?.equipment || {}).some((k) => ITEMS[cellKey(k)])
      || (target?.bag || []).some((c) => ITEMS[cellKey(c)]);
    if (hasItems) {
      set({ showEvent: { ...showEvent, phase: 'choice', data: { ...showEvent.data, targetIndex } } });
      return;
    }
  }

  set({ showEvent: { ...showEvent, data: { ...showEvent.data, targetIndex } } });
  applyEventEffect(set, get);
}

export function eventRollDice(set, get) {
  const { showEvent } = get();
  if (!showEvent) return;
  set({ showEvent: { ...showEvent, phase: 'dice', data: { ...showEvent.data, diceRolling: true, diceValue: null } } });

  const finalValue = Math.floor(Math.random() * 6) + 1;
  let count = 0;
  const interval = setInterval(() => {
    const current = get().showEvent;
    if (!current) { clearInterval(interval); return; }
    set({ showEvent: { ...current, data: { ...current.data, diceValue: Math.floor(Math.random() * 6) + 1 } } });
    count++;
    if (count >= 10) {
      clearInterval(interval);
      const ev = get().showEvent;
      if (!ev) return;
      set({ showEvent: { ...ev, data: { ...ev.data, diceValue: finalValue, diceRolling: false } } });
      setTimeout(() => {
        if (get().showEvent) applyEventEffect(set, get);
      }, 1000);
    }
  }, 80);
}

export function eventAskQuestion(set, get) {
  const { showEvent, questions, askedQuestions, addLog } = get();
  if (!showEvent) return;
  // Cet événement pose DÉJÀ sa propre question → pas de question supplémentaire
  // en fin de tour (on efface le flag posé à l'atterrissage).
  if (get().pendingEventQuestion) set({ pendingEventQuestion: null });

  // Thème forcé par l'événement (ex. Sphinx → 'hardcore'). Sinon, on essaie TOUTES
  // les matières du plateau (mélangées) — une « catégorie » multi-thèmes est résolue
  // en sous-thème concret via resolveSubjectFor (comme le flux de question normal),
  // sinon `questions[catégorie]` serait vide → faux « pas de question disponible ».
  const forced = showEvent.event?.subject;
  const board = Array.isArray(get().boardSubjects) && get().boardSubjects.length
    ? get().boardSubjects : Object.keys(questions);
  const candidates = forced ? [forced] : board.slice();
  for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }

  const cur = get().currentTeam;
  // 1re passe : questions non encore posées ; 2e passe : on recycle (asked vidé).
  const pick = (recycle) => {
    for (const raw of candidates) {
      const subject = get().resolveSubjectFor(raw, cur);
      const pool = questions[subject] || [];
      if (!pool.length) continue;
      const asked = recycle ? new Set() : (askedQuestions[subject] || new Set());
      const r = pickQuestion(pool, asked);
      if (r) return { subject, ...r };
    }
    return null;
  };
  const picked = pick(false) || pick(true);

  if (!picked) {
    addLog(tg('log.ev.noQuestion'));
    set({ showEvent: null });
    get().finishEventTurn();
    return;
  }

  const { subject, question: q, newAsked } = picked;
  set({
    showEvent: { ...showEvent, phase: 'question', data: { ...showEvent.data, eventQuestion: q, eventSubject: subject } },
    askedQuestions: { ...askedQuestions, [subject]: newAsked },
  });
}

export function eventAnswerQuestion(set, get, chosenIndex) {
  const { showEvent } = get();
  if (!showEvent?.data?.eventQuestion) return;
  const correct = chosenIndex === showEvent.data.eventQuestion.c;
  set({ showEvent: { ...showEvent, data: { ...showEvent.data, questionResult: correct, questionRevealed: true, questionSelected: chosenIndex } } });
  setTimeout(() => applyEventEffect(set, get), 2000);
}

// Va-tout : « Continuer » → réautorise un applyEventEffect et repose une question
// (la mise et la série sont conservées dans data).
export function eventVaToutContinue(set, get) {
  if (!get().showEvent) return;
  set({ eventApplied: false });
  eventAskQuestion(set, get);
}

// Va-tout : « Encaisser » → verse la mise accumulée et clôt l'événement.
export function eventVaToutCashOut(set, get) {
  const { showEvent, teams, currentTeam, addLog } = get();
  if (!showEvent) return;
  const pot = showEvent.data?.vaToutPot || 0;
  const nt = [...teams];
  nt[currentTeam] = { ...nt[currentTeam], money: (nt[currentTeam].money || 0) + pot };
  addLog(tg('log.ev.vaToutCashOut', { emoji: nt[currentTeam].emoji, name: nt[currentTeam].name, pot }));
  set({ teams: nt, showEvent: { ...showEvent, phase: 'result', data: { ...showEvent.data, message: tg('log.ev.vaToutResult', { pot }) } } });
  get().checkMoneyMilestone(currentTeam);
}

export function eventRechargeChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const newTeams = [...teams];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: currentCharges + 1 } };
  newTeams[currentTeam] = { ...team, powers: newPowers };
  const pName = locName(POWERS[powerKey]) || powerKey;
  addLog(tg('log.ev.recharge', { emoji: team.emoji, name: team.name, power: pName }));
  set({ teams: newTeams, showEvent: null });
  get().finishEventTurn();
}

// Vol : transfere 1 charge d'un pouvoir de la cible (stealKey) vers un
// pouvoir de l'equipe active (giveKey) — les deux choisis par le joueur.
export function eventVolApply(set, get, stealKey, giveKey) {
  const { showEvent, teams, currentTeam, addLog } = get();
  const targetIndex = showEvent?.data?.targetIndex;
  if (targetIndex == null) return;
  const team = teams[currentTeam];
  const target = teams[targetIndex];
  if (!target || !POWERS[stealKey] || !POWERS[giveKey]) return;
  if ((target.powers?.[stealKey]?.charges ?? 0) <= 0) return;

  const targetEntry = target.powers[stealKey];
  const myEntry = team.powers?.[giveKey] || { charges: 0, level: 1 };
  const newTeams = [...teams];
  newTeams[targetIndex] = { ...target, powers: { ...target.powers, [stealKey]: { ...targetEntry, charges: targetEntry.charges - 1 } } };
  newTeams[currentTeam] = { ...team, powers: { ...team.powers, [giveKey]: { ...myEntry, charges: addCharge(myEntry.charges) } } };
  addLog(tg('log.ev.volCharge', { emoji: team.emoji, name: team.name, stolen: locName(POWERS[stealKey]), vemoji: target.emoji, vname: target.name, given: locName(POWERS[giveKey]) }));
  set({ teams: newTeams, showEvent: null });
  get().finishEventTurn();
}

// Marche Noir : achat d'une charge d'un pouvoir possede a -50%.
export function eventMarcheNoirBuy(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const power = POWERS[powerKey];
  if (!power) return;
  const price = Math.ceil(power.price / 2);
  if ((team.money ?? 0) < price) return;

  const entry = team.powers?.[powerKey] || { charges: 0, level: 1 };
  // Plafond : pas d'achat (ni de dépense) si déjà au maximum de charges.
  if ((entry.charges ?? 0) >= MAX_CHARGES) return;
  const newTeams = [...teams];
  newTeams[currentTeam] = {
    ...team,
    money: team.money - price,
    powers: { ...team.powers, [powerKey]: { ...entry, charges: addCharge(entry.charges) } },
  };
  addLog(tg('log.ev.marcheNoirBuy', { emoji: team.emoji, name: team.name, power: locName(power), price }));
  set({ teams: newTeams, showEvent: null });
  get().finishEventTurn();
}

// Marchand ambulant : achat d'un objet de l'etal a -30%.
export function eventMerchantBuy(set, get, itemKey) {
  const { teams, currentTeam, addLog } = get();
  const team = teams[currentTeam];
  const item = ITEMS[itemKey];
  if (!item) return;
  const price = merchantPrice(item);
  if ((team.money ?? 0) < price) return;
  // Pas de place (slot occupe ET sac plein) : grantItem revendrait l'objet a
  // 50% alors qu'il vient d'etre paye 70% — on refuse l'achat (l'UI desactive)
  if (!canReceiveItem(team, itemKey)) return;

  const newTeams = [...teams];
  newTeams[currentTeam] = { ...team, money: team.money - price };
  set({ teams: newTeams });
  addLog(tg('log.ev.merchantBuy', { emoji: team.emoji, name: team.name, icon: item.icon, item: locName(item), price }));
  grantItem(set, get, currentTeam, itemKey);
  set({ showEvent: null });
  get().finishEventTurn();
}

// Les trois coffres : le joueur choisit UN des 3 objets proposes (data.gifts).
export function eventChooseGift(set, get, itemKey) {
  const { teams, currentTeam, addLog, showEvent } = get();
  const team = teams[currentTeam];
  const item = ITEMS[itemKey];
  // Securite : l'objet doit faire partie des 3 coffres proposes
  if (!item || !showEvent?.data?.gifts?.includes(itemKey)) return;

  const r = placeItem(team, itemKey);
  const newTeams = [...teams];
  newTeams[currentTeam] = r.team;

  if (r.outcome === 'refunded') {
    // Sac plein : l'objet est revendu, pas de cerémonie de gain
    addLog(tg('log.ev.giftBagFullLog', { icon: item.icon, item: locName(item), refund: r.refund }));
    set({ teams: newTeams, showEvent: { ...showEvent, phase: 'result', data: { ...showEvent.data, message: tg('log.ev.giftBagFullMsg', { icon: item.icon, item: locName(item), refund: r.refund }) } } });
    return;
  }
  addLog(tg(r.outcome === 'equipped' ? 'log.ev.giftEquip' : 'log.ev.giftGet', { emoji: team.emoji, name: team.name, icon: item.icon, item: locName(item) }));
  set({ teams: newTeams, showEvent: null, eventApplied: false });
  get().showLoot(itemKey, { title: '\u{1F48E} Ton choix !', thenClose: true });
}

// Troc du destin : sacrifie UN objet (pick) → recoit un objet AU HASARD.
export function eventTrade(set, get, pick) {
  const { teams, currentTeam, addLog, showEvent } = get();
  const team = teams[currentTeam];
  const equipment = { ...team.equipment };
  const bag = normalizeBag(team.bag);

  let givenKey = null;
  if (pick.kind === 'equipment') {
    givenKey = equipment[pick.slot];
    if (!givenKey || !ITEMS[givenKey]) return;
    equipment[pick.slot] = null;
  } else {
    const cell = bag[pick.index];
    givenKey = cellKey(cell);
    if (!givenKey || !ITEMS[givenKey]) return;
    bag[pick.index] = cellN(cell) > 1 ? mkCell(givenKey, cellN(cell) - 1) : null; // sacrifie 1 unité
  }
  const given = ITEMS[givenKey];
  const afterSacrifice = { ...team, equipment, bag };

  const newKey = pickLootItem(LOOT.chestLegendaryChance, get().lootableItems());
  if (!newKey) {
    const nt = [...teams]; nt[currentTeam] = afterSacrifice;
    addLog(tg('log.ev.tradeNothing', { emoji: team.emoji, icon: given.icon, item: locName(given) }));
    set({ teams: nt, showEvent: { ...showEvent, phase: 'result', data: { ...showEvent.data, message: tg('log.ev.tradeNothingMsg') } } });
    return;
  }
  const newItem = ITEMS[newKey];
  const r = placeItem(afterSacrifice, newKey);
  const nt = [...teams]; nt[currentTeam] = r.team;
  addLog(tg('log.ev.trade', { emoji: team.emoji, name: team.name, gicon: given.icon, given: locName(given), nicon: newItem.icon, newitem: locName(newItem) }));
  if (r.outcome === 'refunded') {
    set({ teams: nt, showEvent: { ...showEvent, phase: 'result', data: { ...showEvent.data, message: tg('log.ev.tradeBagFull', { icon: newItem.icon, item: locName(newItem), refund: r.refund }) } } });
    return;
  }
  set({ teams: nt, showEvent: null, eventApplied: false });
  get().showLoot(newKey, { title: '\u{1F504} Troc du destin !', thenClose: true });
}

// Pillage : vole UN objet a la cible — pick = { kind: 'equipment', slot } ou { kind: 'bag', index }.
export function eventPillageApply(set, get, pick) {
  const { showEvent, teams, currentTeam, addLog } = get();
  const targetIndex = showEvent?.data?.targetIndex;
  if (targetIndex == null) return;
  const team = teams[currentTeam];
  const target = teams[targetIndex];
  if (!target) return;

  let itemKey = null;
  const newTeams = [...teams];

  if (pick.kind === 'equipment') {
    itemKey = cellKey(target.equipment?.[pick.slot]);
    // Clé absente du catalogue (objet retiré d'une version future) : ignorer
    if (!itemKey || !ITEMS[itemKey]) return;
    newTeams[targetIndex] = { ...target, equipment: { ...target.equipment, [pick.slot]: null } };
  } else {
    const bag = normalizeBag(target.bag);
    const cell = bag[pick.index];
    itemKey = cellKey(cell);
    if (!itemKey) return;
    bag[pick.index] = cellN(cell) > 1 ? mkCell(itemKey, cellN(cell) - 1) : null; // vole 1 unité
    newTeams[targetIndex] = { ...target, bag };
  }

  const item = ITEMS[itemKey];
  set({ teams: newTeams });
  addLog(tg('log.ev.pillageApply', { emoji: team.emoji, name: team.name, icon: item.icon, item: locName(item), vemoji: target.emoji, vname: target.name }));
  const res = grantItem(set, get, currentTeam, itemKey);
  // Sac plein → objet revendu : pas de cérémonie de gain (cohérent avec le
  // coffre) ; on ferme l'événement et on enchaîne le tour.
  if (!res || res.outcome === 'refunded') {
    set({ showEvent: null });
    get().finishEventTurn();
    return;
  }
  // Révélation de l'objet pillé (visuel + effets) ; sa fermeture clôt
  // l'événement et passe la main (thenClose, comme le coffre).
  get().showLoot(itemKey, { title: tg('modal.loot.pillageTitle'), thenClose: true });
}

// --- The big switch ---

export function applyEventEffect(set, get) {
  if (get().eventApplied) return;
  set({ eventApplied: true });
  const { showEvent, teams, currentTeam, board, addLog } = get();
  if (!showEvent) return;
  const { key, data } = showEvent;
  // Valeurs chiffrées éditables (EVENT_PARAMS_SCHEMA) — fallback = défaut codé.
  const P = showEvent.event?.params || {};
  const team = teams[currentTeam];
  const newTeams = [...teams];
  let message = '';
  // Objet loote (coffre) — transmis au resultat pour la carte de revelation
  let lootKey = null;
  // Animations a jouer : [{ teamIndex, waypoints, type }]
  const moves = [];
  const pushMove = (teamIndex, path, type) => {
    if (path && path.length > 1) moves.push({ teamIndex, waypoints: toWaypoints(board, path), type });
  };
  // Recul d'événement via la chaîne de bouclier unifiée (buff noRecul → Bouclier
  // de bois → pouvoir Bouclier → équipement) — comme les questions et le moteur.
  // Met à jour newTeams[idx], pousse l'animation, et renvoie le nombre de cases
  // effectivement reculées (0 = totalement absorbé) + le drapeau « réduit ».
  const _masteryOn = extOn(get().extensions, 'mastery');
  const reculInto = (idx, base) => {
    const rec = applyRecul(newTeams[idx], board, base, _masteryOn);
    newTeams[idx] = { ...newTeams[idx], ...rec.patch };
    // Forteresse (Bouclier L10) : le recul devient une avance → animation vers
    // l'avant + ligne de journal dédiée (en plus du message propre à l'événement).
    pushMove(idx, rec.path, rec.forward ? 'forward' : 'back');
    if (rec.forward) addLog(tg('log.turn.fortressAdvance', { team: `${newTeams[idx].emoji} ${newTeams[idx].name}`, cases: rec.advance }));
    return { applied: rec.applied, reduced: !!rec.absorbedBy };
  };
  // Clause de message : « recul de N case(s) » ou « recul absorbé 🛡️ ».
  const reculTxt = (applied) => applied > 0
    ? tgPlural('log.ev.recul', applied)
    : tg('log.ev.reculAbsorbed');

  switch (key) {
    case 'vaTout': {
      // Quitte-ou-double accumulé : bonne réponse → la mise grossit (+5,+10,+15…)
      // et on propose de continuer ou d'encaisser ; mauvaise → mise PERDUE
      // (jamais banquée) + recul d'1D10. La mise n'est versée qu'à l'encaissement.
      const correct = data?.questionResult;
      const streak = data?.vaToutStreak || 0;
      const pot = data?.vaToutPot || 0;
      if (correct) {
        const newStreak = streak + 1;
        const gain = newStreak * (P.step ?? 5); // croissant : +5, +10, +15, +20…
        set({
          teams: newTeams,
          showEvent: { ...showEvent, phase: 'vaToutChoice', data: {
            ...data, vaToutStreak: newStreak, vaToutPot: pot + gain, lastGain: gain,
            questionResult: undefined, questionRevealed: false, questionSelected: undefined,
          } },
        });
        return; // boucle : on n'enchaîne PAS vers le résultat
      }
      // Raté : mise perdue (jamais ajoutée à l'or) + recul 1DN (failDie).
      const dv = Math.floor(Math.random() * (P.failDie ?? 10)) + 1;
      const { applied } = reculInto(currentTeam, dv);
      const rt = reculTxt(applied);
      message = pot > 0
        ? tg('log.ev.vaToutFailPot', { pot, recul: rt })
        : tg('log.ev.vaToutFail', { recul: `${rt.charAt(0).toUpperCase()}${rt.slice(1)}` });
      break;
    }
    case 'recul': {
      const { applied } = reculInto(currentTeam, P.back ?? 2);
      message = tg('log.ev.recul.msg', { emoji: team.emoji, name: team.name, recul: reculTxt(applied) });
      break;
    }
    case 'coupDePouce': {
      const result = moveForward(board, team.pos, P.forward ?? 3, { throughJunctions: true });
      newTeams[currentTeam] = { ...team, pos: result.finalPos };
      pushMove(currentTeam, result.path, 'forward');
      message = tg('log.ev.coupDePouce', { emoji: team.emoji, name: team.name });
      break;
    }
    case 'teleport': {
      const path = forwardPathToJunction(board, team.pos);
      if (path) {
        newTeams[currentTeam] = { ...team, pos: path[path.length - 1] };
        pushMove(currentTeam, path, 'forward');
        message = tg('log.ev.teleport', { emoji: team.emoji, name: team.name });
      } else {
        message = tg('log.ev.teleportNone');
      }
      break;
    }
    case 'oubli': {
      // Equipement (oubliProtect) : simple recul de 3 au lieu du retour au depart
      if (hasEffect(team, 'oubliProtect')) {
        const { applied } = reculInto(currentTeam, P.grappleBack ?? 3);
        message = tg('log.ev.oubliGrapple', { emoji: team.emoji, name: team.name, recul: reculTxt(applied) });
        break;
      }
      const { applied } = reculInto(currentTeam, 9999);
      message = applied > 0
        ? tg('log.ev.oubliStart', { emoji: team.emoji, name: team.name })
        : tg('log.ev.oubliShield', { emoji: team.emoji, name: team.name });
      break;
    }
    case 'embuscade': {
      const prevJ = findPrevJunction(board, team.pos);
      if (prevJ && prevJ !== team.pos) {
        newTeams[currentTeam] = { ...team, pos: prevJ };
        pushMove(currentTeam, backPathTo(board, team.pos, prevJ), 'back');
        message = tg('log.ev.embuscade', { emoji: team.emoji, name: team.name });
      } else {
        message = tg('log.ev.embuscadeNone');
      }
      break;
    }
    case 'tempete': {
      const dv = data?.diceValue || 1;
      const immune = [];
      for (let i = 0; i < teams.length; i++) {
        // Equipement (tempeteImmune) : l'equipe ne bouge pas
        if (hasEffect(newTeams[i], 'tempeteImmune')) {
          immune.push(`${newTeams[i].emoji} ${newTeams[i].name}`);
          continue;
        }
        reculInto(i, dv);
      }
      message = tgPlural('log.ev.tempete', dv, { n: dv });
      if (immune.length) message += tgPlural('log.ev.tempeteImmune', immune.length, { list: immune.join(', ') });
      break;
    }
    case 'rejouer': {
      const dv = data?.diceValue || 1;
      const result = moveForward(board, team.pos, dv, { throughJunctions: true });
      newTeams[currentTeam] = { ...team, pos: result.finalPos };
      pushMove(currentTeam, result.path, 'forward');
      message = tg('log.ev.rejouer', { emoji: team.emoji, name: team.name, n: dv });
      break;
    }
    case 'quitteDouble': {
      // Le de de l'evenement decide gagne/perdu ; la mise est le lancer
      // d'ARRIVEE sur la case evenement (preRollValue), pas le de de l'evenement.
      const dv = data?.diceValue || 1;
      const moveRoll = get().preRollValue || dv;
      if (dv >= (P.winThreshold ?? 4)) {
        const gain = moveRoll * (P.winMult ?? 2);
        const result = moveForward(board, team.pos, gain, { throughJunctions: true });
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        pushMove(currentTeam, result.path, 'forward');
        message = tg('log.ev.quitteDoubleWin', { dv, roll: moveRoll, gain });
      } else {
        const { applied } = reculInto(currentTeam, moveRoll);
        const rt = reculTxt(applied);
        message = tg('log.ev.quitteDoubleLose', { dv, recul: `${rt.charAt(0).toUpperCase()}${rt.slice(1)}` });
      }
      break;
    }
    case 'decharge': {
      const ti = data?.targetIndex;
      const dv = data?.diceValue || 1;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const { applied } = reculInto(ti, dv);
        message = tg('log.ev.decharge', { emoji: target.emoji, name: target.name, recul: reculTxt(applied) });
      }
      break;
    }
    case 'sacrifice': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const me = reculInto(currentTeam, P.selfBack ?? 2);
        const tgt = reculInto(ti, P.targetBack ?? 4);
        message = tg('log.ev.sacrifice', { emoji: team.emoji, recul1: reculTxt(me.applied), vemoji: target.emoji, recul2: reculTxt(tgt.applied) });
      }
      break;
    }
    case 'don': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        const result = moveForward(board, target.pos, P.forward ?? 3, { throughJunctions: true });
        newTeams[ti] = { ...target, pos: result.finalPos };
        pushMove(ti, result.path, 'forward');
        message = tg('log.ev.don', { emoji: target.emoji, name: target.name });
      }
      break;
    }
    case 'echange': {
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        newTeams[currentTeam] = { ...team, pos: target.pos };
        newTeams[ti] = { ...target, pos: team.pos };
        // Vol direct croise (pas de chemin case par case pour un echange)
        pushMove(currentTeam, [team.pos, target.pos], 'forward');
        pushMove(ti, [target.pos, team.pos], 'forward');
        message = tg('log.ev.echange', { emoji: team.emoji, vemoji: target.emoji });
      }
      break;
    }
    case 'vol': {
      // Cas "rien a voler" uniquement — le vol effectif passe par eventVolApply
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        message = tg('log.ev.volNothing', { emoji: newTeams[ti].emoji });
      }
      break;
    }
    case 'duel': {
      const ti = data?.targetIndex;
      const correct = data?.questionResult;
      if (ti != null && ti >= 0 && ti < teams.length) {
        const target = newTeams[ti];
        if (correct) {
          const { applied } = reculInto(currentTeam, P.winSelfBack ?? 2);
          message = tg('log.ev.duelWin', { vemoji: target.emoji, emoji: team.emoji, recul: reculTxt(applied) });
        } else {
          const { applied } = reculInto(ti, P.loseTargetBack ?? 2);
          message = tg('log.ev.duelLose', { vemoji: target.emoji, vemoji2: target.emoji, recul: reculTxt(applied) });
        }
      }
      break;
    }
    case 'pari': {
      const correct = data?.questionResult;
      if (correct) {
        const result = moveForward(board, team.pos, P.winForward ?? 3, { throughJunctions: true });
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        pushMove(currentTeam, result.path, 'forward');
        message = tg('log.ev.pariWin', { emoji: team.emoji });
      } else {
        const { applied } = reculInto(currentTeam, P.loseBack ?? 3);
        message = tg('log.ev.pariLose', { emoji: team.emoji, recul: reculTxt(applied) });
      }
      break;
    }
    case 'bonus': {
      const correct = data?.questionResult;
      if (correct) {
        const result = moveForward(board, team.pos, P.winForward ?? 3, { throughJunctions: true });
        newTeams[currentTeam] = { ...team, pos: result.finalPos };
        pushMove(currentTeam, result.path, 'forward');
        message = tg('log.ev.bonusWin', { emoji: team.emoji });
      } else {
        message = tg('log.ev.bonusLose');
      }
      break;
    }
    case 'tresor': {
      const lo = P.min ?? 15, hi = Math.max(lo, P.max ?? 25);
      const gain = lo + Math.floor(Math.random() * (hi - lo + 1));
      newTeams[currentTeam] = { ...team, money: team.money + gain };
      message = tg('log.ev.tresor', { emoji: team.emoji, name: team.name, gain });
      break;
    }
    case 'impot': {
      // Equipement (taxReduction) : impot attenue voire annule
      const loss = reducedTax(team, Math.floor(team.money * ((P.percent ?? 30) / 100)));
      newTeams[currentTeam] = { ...team, money: team.money - loss };
      message = loss > 0
        ? tg('log.ev.impotPay', { emoji: team.emoji, name: team.name, loss })
        : tg('log.ev.impotExempt', { emoji: team.emoji, name: team.name });
      break;
    }
    case 'volArgent': {
      const targetIndex = data?.targetIndex;
      if (targetIndex != null && targetIndex >= 0 && targetIndex < teams.length) {
        const target = teams[targetIndex];
        // Banque fortifiée (Bouclier L10) : or impossible à voler.
        const vaulted = target.powers?.bouclier?.spec10 === 'goldVault';
        // Equipement de la cible (stealProtection) : vol attenue voire annule
        const purse = target.money ?? 0;
        const stolen = vaulted ? 0 : reducedSteal(target, Math.min(P.amount ?? 10, purse));
        newTeams[targetIndex] = { ...target, money: target.money - stolen };
        newTeams[currentTeam] = { ...team, money: team.money + stolen };
        // Bourse vide ≠ protection : deux messages distincts.
        message = stolen > 0
          ? tg('log.ev.volArgent', { emoji: team.emoji, name: team.name, stolen, vemoji: target.emoji, vname: target.name })
          : (!vaulted && purse <= 0)
            ? tg('log.ev.volArgentEmpty', { vemoji: target.emoji, vname: target.name })
            : tg('log.ev.volArgentProt', { vemoji: target.emoji, vname: target.name });
      }
      break;
    }
    case 'taxeCommune': {
      const exempt = [];
      const reduced = [];
      const base = P.amount ?? 5;
      for (let i = 0; i < newTeams.length; i++) {
        // Equipement (taxReduction) : taxe attenuee par equipe
        const tax = reducedTax(newTeams[i], base);
        if (tax <= 0) exempt.push(`${newTeams[i].emoji} ${newTeams[i].name}`);
        else if (tax < base) reduced.push(`${newTeams[i].emoji} ${newTeams[i].name} (-${tax})`);
        newTeams[i] = { ...newTeams[i], money: Math.max(0, newTeams[i].money - tax) };
      }
      message = tg('log.ev.taxeCommune');
      if (reduced.length) message += tg('log.ev.taxeReduced', { list: reduced.join(', ') });
      if (exempt.length) message += tg('log.ev.taxeExempt', { list: exempt.join(', ') });
      break;
    }
    case 'jackpot': {
      const qResult = data?.questionResult;
      if (qResult === true) {
        newTeams[currentTeam] = { ...team, money: team.money + (P.win ?? 30) };
        message = tg('log.ev.jackpotWin', { emoji: team.emoji, name: team.name });
      } else {
        newTeams[currentTeam] = { ...team, money: Math.max(0, team.money - (P.lose ?? 10)) };
        message = tg('log.ev.jackpotLose', { emoji: team.emoji, name: team.name });
      }
      break;
    }
    case 'loterie': {
      // Pile ou face : chance% gros gain, sinon perte d'une mise.
      if (Math.random() < (P.chancePct ?? 50) / 100) {
        newTeams[currentTeam] = { ...team, money: team.money + (P.win ?? 40) };
        message = tg('log.ev.loterieWin', { emoji: team.emoji, name: team.name });
      } else {
        newTeams[currentTeam] = { ...team, money: Math.max(0, team.money - (P.lose ?? 15)) };
        message = tg('log.ev.loterieLose', { emoji: team.emoji, name: team.name });
      }
      break;
    }
    case 'sphinx': {
      // Question HARDCORE forcée (cf. eventAskQuestion) : gros enjeu.
      if (data?.questionResult === true) {
        newTeams[currentTeam] = { ...team, money: team.money + (P.win ?? 50) };
        message = tg('log.ev.sphinxWin', { emoji: team.emoji, name: team.name });
      } else {
        newTeams[currentTeam] = { ...team, money: Math.max(0, team.money - (P.lose ?? 20)) };
        message = tg('log.ev.sphinxLose', { emoji: team.emoji, name: team.name });
      }
      break;
    }
    case 'forge': {
      // Fond 2 consommables (UNITÉS, piles comprises) → forge 1 équipement aléatoire.
      const bag = normalizeBag(team.bag);
      const consumSlots = [];
      bag.forEach((c, i) => { if (cellKey(c) && ITEMS[cellKey(c)]?.slot === 'consumable') consumSlots.push(i); });
      const totalUnits = consumSlots.reduce((s, i) => s + cellN(bag[i]), 0);
      const burnCount = P.burnCount ?? 2;
      if (totalUnits < burnCount) { message = tg('log.ev.forgeNeed'); break; }
      const burnedIcons = [];
      let toBurn = burnCount;
      for (const i of consumSlots) {
        while (toBurn > 0 && cellN(bag[i]) > 0) {
          burnedIcons.push(ITEMS[cellKey(bag[i])].icon);
          bag[i] = cellN(bag[i]) > 1 ? mkCell(cellKey(bag[i]), cellN(bag[i]) - 1) : null;
          toBurn--;
        }
        if (toBurn === 0) break;
      }
      const eqKey = pickLootItem(LOOT.chestLegendaryChance, get().lootableItems(), { category: 'equipment' });
      const afterBurn = { ...team, bag };
      if (!eqKey) { newTeams[currentTeam] = afterBurn; message = tg('log.ev.forgeEmpty'); break; }
      const eq = ITEMS[eqKey];
      const r = placeItem(afterBurn, eqKey);
      newTeams[currentTeam] = r.team;
      if (r.outcome === 'refunded') {
        message = tg('log.ev.forgeRefund', { icon: eq.icon, item: locName(eq), refund: r.refund });
      } else {
        message = tg('log.ev.forge', { emoji: team.emoji, a: burnedIcons[0], b: burnedIcons[1], icon: eq.icon, item: locName(eq) });
        lootKey = eqKey;
      }
      break;
    }
    case 'reliquaire': {
      // Donne une pièce d'un SET déjà commencé (≥1 pièce équipée), slot non rempli
      // par cette pièce ; fallback : n'importe quelle pièce de set.
      const enabled = get().lootableItems();
      const started = Object.keys(equippedSetCounts(team));
      let candidates = started.length
        ? enabled.filter((k) => {
            const it = ITEMS[k];
            return it && it.set && it.slot !== 'consumable' && started.includes(it.set) && cellKey(team.equipment?.[it.slot]) !== k;
          })
        : [];
      if (candidates.length === 0) candidates = enabled.filter((k) => ITEMS[k]?.set && ITEMS[k].slot !== 'consumable');
      if (candidates.length === 0) { message = tg('log.ev.reliquaireEmpty'); break; }
      const relicKey = candidates[Math.floor(Math.random() * candidates.length)];
      const relic = ITEMS[relicKey];
      const r = placeItem(team, relicKey);
      newTeams[currentTeam] = r.team;
      if (r.outcome === 'refunded') {
        message = tg('log.ev.reliquaireRefund', { icon: relic.icon, item: locName(relic), refund: r.refund });
      } else {
        message = tg('log.ev.reliquaire', { emoji: team.emoji, icon: relic.icon, item: locName(relic), set: locName(SETS[relic.set]) || 'set' });
        lootKey = relicKey;
      }
      break;
    }
    case 'tournoi': {
      // Question : gagnant = l'équipe active loote un conso ; perdant = un adversaire le rafle.
      const prizeKey = pickLootItem(0, get().lootableItems(), { category: 'consumable' });
      if (!prizeKey) { message = tg('log.ev.tournoiEmpty'); break; }
      const prize = ITEMS[prizeKey];
      if (data?.questionResult === true) {
        const r = placeItem(team, prizeKey);
        newTeams[currentTeam] = r.team;
        message = r.outcome === 'refunded'
          ? tg('log.ev.tournoiWinRefund', { emoji: team.emoji, icon: prize.icon, item: locName(prize), refund: r.refund })
          : tg('log.ev.tournoiWin', { emoji: team.emoji, icon: prize.icon, item: locName(prize) });
      } else {
        const opps = teams.map((_, i) => i).filter((i) => i !== currentTeam);
        if (opps.length) {
          const oi = opps[Math.floor(Math.random() * opps.length)];
          const r = placeItem(teams[oi], prizeKey);
          newTeams[oi] = r.team;
          message = tg('log.ev.tournoiLose', { vemoji: teams[oi].emoji, vname: teams[oi].name, icon: prize.icon, item: locName(prize) });
        } else { message = tg('log.ev.tournoiNoOpp'); }
      }
      break;
    }
    case 'banquier': {
      const bonusAmount = team.correct * (P.perCorrect ?? 3);
      newTeams[currentTeam] = { ...team, money: team.money + bonusAmount };
      message = tg('log.ev.banquier', { emoji: team.emoji, name: team.name, amount: bonusAmount, correct: team.correct });
      break;
    }
    case 'coffre': {
      lootKey = pickLootItem(LOOT.chestLegendaryChance, get().lootableItems());
      const item = ITEMS[lootKey];
      if (!item) { message = tg('log.ev.coffreEmpty'); break; }
      const rarityName = loc(RARITIES[item.rarity], 'name') || '';

      const r = placeItem(team, lootKey);
      newTeams[currentTeam] = r.team;
      if (r.outcome === 'equipped') {
        message = tg('log.ev.coffreEquip', { emoji: team.emoji, name: team.name, icon: item.icon, item: locName(item), rarity: rarityName, slot: loc(SLOTS[item.slot], 'name') });
      } else if (r.outcome === 'refunded') {
        message = tg('log.ev.coffreRefund', { icon: item.icon, item: locName(item), rarity: rarityName, refund: r.refund });
        lootKey = null; // objet revendu : pas de révélation visuelle
      } else {
        message = tg('log.ev.coffreFind', { emoji: team.emoji, name: team.name, icon: item.icon, item: locName(item), rarity: rarityName });
      }
      break;
    }
    case 'pillage': {
      // Cas "rien a piller" uniquement — le pillage effectif passe par eventPillageApply
      const ti = data?.targetIndex;
      if (ti != null && ti >= 0 && ti < teams.length) {
        message = data?.itemImmune
          ? tg('log.ev.itemStealImmune', { emoji: newTeams[ti].emoji, name: newTeams[ti].name })
          : tg('log.ev.pillageNothing', { emoji: newTeams[ti].emoji, name: newTeams[ti].name });
      }
      break;
    }
    case 'pickpocket': {
      // Immunité au vol d'objet : rien n'est perdu.
      if (isItemStealImmune(team)) {
        message = tg('log.ev.itemStealImmune', { emoji: team.emoji, name: team.name });
        break;
      }
      // Perd UN objet au hasard (equipement OU sac). Filtre les cles perimees.
      const picks = [];
      for (const slot of ['head', 'body', 'feet']) {
        const k = cellKey(team.equipment?.[slot]);
        if (k && ITEMS[k]) picks.push({ kind: 'equipment', slot, key: k });
      }
      const bag = normalizeBag(team.bag);
      bag.forEach((c, i) => { const k = cellKey(c); if (k && ITEMS[k]) picks.push({ kind: 'bag', index: i, key: k }); });
      if (picks.length === 0) {
        message = tg('log.ev.pickpocketNothing', { emoji: team.emoji, name: team.name });
        break;
      }
      const lost = picks[Math.floor(Math.random() * picks.length)];
      const item = ITEMS[lost.key];
      if (lost.kind === 'equipment') {
        newTeams[currentTeam] = { ...team, equipment: { ...team.equipment, [lost.slot]: null } };
      } else {
        const cell = bag[lost.index];
        bag[lost.index] = cellN(cell) > 1 ? mkCell(lost.key, cellN(cell) - 1) : null; // perd 1 unité
        newTeams[currentTeam] = { ...team, bag };
      }
      message = tg('log.ev.pickpocket', { emoji: team.emoji, name: team.name, icon: item.icon, item: locName(item) });
      break;
    }
    default:
      message = tg('log.ev.default');
  }

  addLog(message);

  // Un evenement peut amener une equipe sur l'arrivee : la victoire prime.
  const winnerIdx = newTeams.findIndex((t) => board[t.pos]?.type === 'arrivee');
  if (winnerIdx !== -1) {
    set({ teams: newTeams, ...(moves.length ? { movePath: moves } : {}) });
    const winner = newTeams[winnerIdx];
    addLog(tg('log.ev.winner', { emoji: winner.emoji, name: winner.name }));
    set({ finished: true, showEvent: null, eventApplied: false });
    return;
  }

  // Objet conservé (coffre) : on ferme l'événement et on montre la révélation
  // « visuel C » ; sa fermeture (dismissLoot) enchaîne sur le tour suivant.
  if (lootKey) {
    set({ teams: newTeams, showEvent: null, eventApplied: false, ...(moves.length ? { movePath: moves } : {}) });
    get().showLoot(lootKey, { title: '\u{1F9F0} Coffre au trésor !', thenClose: true });
    return;
  }

  set({
    teams: newTeams,
    showEvent: { ...showEvent, phase: 'result', data: { ...data, message } },
    ...(moves.length ? { movePath: moves } : {}),
  });
}
