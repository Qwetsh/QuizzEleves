import { POWERS, MAX_CHARGES, addCharge } from '../data/powers.js';
import { moveBack, findPrevJunction } from '../logic/pathfinding.js';
import { consumePowerCharge, applyRecul } from '../logic/turnHelpers.js';
import { reducedRecul, resolveAmount, diceLabel, moveDieSides } from '../logic/itemEffects.js';
import { resolvePowerEffect, maxPowerLevel, powerUpgradeCost, specSlotForLevel, specOptionsFor } from '../logic/powerEffects.js';
import { extOn } from '../extensions/registry.js';
import { saveGame } from './persistence.js';
import { soundThunder, soundPower, soundDice, soundCharge } from '../logic/sounds.js';
import { resumeQueue as resumeEngineQueue, announce, runEffects } from './effectEngine.js';
import { tg, tgPlural } from '../i18n';
import { locName } from '../i18n/content.js';

// Plafond de questions extra accumulables par le Double (total rafale = 1 + MAX_EXTRA)
const MAX_DOUBLE_EXTRA = 4;

// L'extension « Maîtrise » est-elle active ? (pouvoirs L1→10 + branches)
const masteryActive = (get) => extOn(get().extensions, 'mastery');

// Effet EFFECTIF du pouvoir d'une équipe (cœur + branches si Maîtrise active).
// Remplace l'ancien levelEffect : seule source de vérité = resolvePowerEffect.
function powerEffectOf(get, team, powerKey) {
  return resolvePowerEffect(team, powerKey, masteryActive(get));
}

// --- Power usage ---

export function usePower(set, get, powerKey) {
  const { teams, currentTeam, rolling, finished, showQuestion, showEvent, awaitingChoice, diceValue, pendingLanding } = get();
  const team = teams[currentTeam];
  // Silence (Sablier L5) : aucun pouvoir ce tour-ci.
  if (team.silencedNextTurn) {
    get().addLog(tg('log.pw.silenced', { emoji: team.emoji, name: team.name }));
    return;
  }
  const charges = team.powers?.[powerKey]?.charges ?? 0;
  if (charges <= 0) return;

  const power = POWERS[powerKey];
  if (!power) return;

  // Relance : traitée AVANT le garde général car elle est aussi permise pendant
  // un choix de jonction (awaitingChoice), où les autres pouvoirs sont bloqués.
  if (powerKey === 'relance') {
    if (!diceValue || showQuestion || rolling || showEvent || finished || !(pendingLanding || awaitingChoice)) return;
    useRelance(set, get);
    return;
  }

  if (finished || rolling || showEvent || awaitingChoice) return;

  if (powerKey === 'indice') {
    if (!showQuestion || get().indiceUsed) return;
    useIndice(set, get);
    return;
  }

  if (power.category === 'off') {
    if (showQuestion) return;
    if (diceValue && !pendingLanding) return;
    set({ showTargetPicker: { powerKey } });
    return;
  }
}

export function useIndice(set, get) {
  const { teams, currentTeam, showQuestion, addLog } = get();
  const team = teams[currentTeam];
  const question = showQuestion?.question;
  if (!question) return;

  const level = team.powers?.indice?.level ?? 1;
  const effect = powerEffectOf(get, team, 'indice');

  const wrongIndices = question.a
    .map((_, i) => i)
    .filter((i) => i !== question.c);
  for (let i = wrongIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wrongIndices[i], wrongIndices[j]] = [wrongIndices[j], wrongIndices[i]];
  }
  // L'equipement (indiceBoost) elimine deja passivement des reponses a l'ouverture
  // de la question : le pouvoir ajoute SES eliminations par-dessus (sans re-tirer
  // le boost), pour ne pas masquer deux fois la meme reponse.
  const already = get().indiceHidden || [];
  const fresh = wrongIndices.filter((i) => !already.includes(i));
  // count (cœur) + extraHide (Clairvoyance). 50/50 ne laisse que 2 réponses ;
  // Omniscience (revealAnswer) ne laisse que la bonne.
  let want = (effect.count ?? 2) + (effect.extraHide || 0);
  if (effect.keepTwo) want = Math.max(want, wrongIndices.length - 1);
  if (effect.revealAnswer) want = wrongIndices.length;
  const hideMore = Math.min(want, fresh.length);
  const hidden = [...already, ...fresh.slice(0, hideMore)];
  // Bonus de temps : palier + Sérénité (timerMult) + Maître du temps (noTimer).
  let bonusTime = effect.bonusTime || 0;
  if (effect.timerMult) bonusTime += Math.round(30 * (effect.timerMult - 1));
  if (effect.noTimer) bonusTime += 999;

  // Rien \u00e0 \u00e9liminer en plus (\u00e9quipement a d\u00e9j\u00e0 tout masqu\u00e9) ET pas de bonus de
  // temps : on NE consomme PAS la charge (sinon perte s\u00e8che).
  if (hideMore === 0 && bonusTime <= 0 && !effect.bonusMoneyOnCorrect) {
    addLog(tg('log.pw.indiceAllGone', { emoji: team.emoji, name: team.name }));
    return;
  }

  const result = consumePowerCharge(team, 'indice');
  if (!result) return;

  const newTeams = [...teams];
  newTeams[currentTeam] = result.updatedTeam;
  // Omniscience (L10) : coûte 1 charge de plus.
  if (effect.revealAnswer) {
    const extra = consumePowerCharge(newTeams[currentTeam], 'indice');
    if (extra) newTeams[currentTeam] = extra.updatedTeam;
  }

  const indiceBonus = effect.bonusTime > 0 ? tg('log.pw.bonusTime', { n: effect.bonusTime }) : '';
  const indicePower = locName(POWERS.indice);
  addLog(tgPlural('log.pw.indiceUse', hideMore, { emoji: team.emoji, name: team.name, power: indicePower, level, n: hideMore, bonus: indiceBonus }));
  set({ teams: newTeams, indiceUsed: true, indiceHidden: hidden });
  get().recordStat?.('powerUses', { teamIdx: currentTeam, powerKey: 'indice', targetIdx: null });
  announce(set, get, '💡', tgPlural('log.pw.indiceToast', hideMore, { power: indicePower, n: hideMore, bonus: indiceBonus }), POWERS.indice?.color || '#e8b117');

  // Bonus de temps (palier + Sérénité + Maître du temps) et Antisèche (or si bonne réponse).
  const patchQ = {};
  if (bonusTime > 0) patchQ.bonusTime = (get().showQuestion?.bonusTime || 0) + bonusTime;
  if (effect.bonusMoneyOnCorrect) patchQ.indiceBonusMoney = effect.bonusMoneyOnCorrect;
  if (Object.keys(patchQ).length) set({ showQuestion: { ...get().showQuestion, ...patchQ } });
}

export function useRelance(set, get) {
  const { teams, currentTeam, addLog, preRollPos, preRollValue } = get();
  const team = teams[currentTeam];
  const level = team.powers?.relance?.level ?? 1;
  const prevValue = preRollValue || 0;

  const result = consumePowerCharge(team, 'relance');
  if (!result) return;

  const rEff0 = powerEffectOf(get, team, 'relance');
  const newTeams = [...teams];
  // Remboursement (L2/L4) : chance de récupérer la charge dépensée (plafond 5).
  let updated = result.updatedTeam;
  if (rEff0.refundChance && Math.random() < rEff0.refundChance) {
    const rl = updated.powers.relance;
    updated = { ...updated, powers: { ...updated.powers, relance: { ...rl, charges: addCharge(rl.charges) } } };
    addLog(tg('log.pw.relanceRefund', { power: locName(POWERS.relance) }));
  }
  // Pilote (L5) : autorise le choix de voie même si l'équipe aurait avancé au hasard.
  newTeams[currentTeam] = { ...updated, pos: preRollPos || team.pos, ...(rEff0.choosePathAfter ? { pilotNext: true } : {}) };

  addLog(tg('log.pw.relanceUse', { emoji: team.emoji, name: team.name, power: locName(POWERS.relance), level }));
  get().recordStat?.('powerUses', { teamIdx: currentTeam, powerKey: 'relance', targetIdx: null });
  soundDice();
  announce(set, get, '🎲', tg('log.pw.relanceToast', { emoji: team.emoji, name: team.name }), POWERS.relance?.color || '#e8b117');
  // Nettoie aussi un éventuel choix de jonction en cours (on relance depuis le départ du lancer).
  set({ teams: newTeams, diceValue: null, rolling: true, pendingLanding: false, awaitingChoice: false, pendingMove: null });

  const rEff = powerEffectOf(get, team, 'relance');
  // Faces du dé de relance : Gros dé (L8) impose un D10, sinon le dé de mouvement (D4/D6/D10).
  const sides = rEff.dieSides || moveDieSides(team);
  // Triple chance : meilleur de N dés. Dé chanceux : relance jusqu'à atteindre minRoll.
  let roll = Math.floor(Math.random() * sides) + 1;
  for (let k = 1; k < (rEff.rerollCount || 1); k++) roll = Math.max(roll, Math.floor(Math.random() * sides) + 1);
  if (rEff.minRoll) { let tries = 0; while (roll < rEff.minRoll && tries < 30) { roll = Math.floor(Math.random() * sides) + 1; tries++; } }
  const finalValue = roll;
  let count = 0;
  const interval = setInterval(() => {
    set({ diceValue: Math.floor(Math.random() * sides) + 1 });
    count++;
    if (count >= 10) {
      clearInterval(interval);
      set({ diceValue: finalValue, rolling: false });

      const mode = rEff.mode || 'replace';
      let effectiveValue;
      if (mode === 'sum') effectiveValue = prevValue + finalValue;
      else if (mode === 'best') effectiveValue = Math.max(prevValue, finalValue);
      else effectiveValue = finalValue;

      // Bond (L10) : avance jusqu'à la prochaine case événement (sinon valeur normale).
      if (rEff.leapToAdvantage) {
        const board = get().board;
        let node = preRollPos || team.pos, dist = 0;
        while (dist < 15) {
          const nx = board[node]?.next?.[0];
          if (!nx) break;
          node = nx; dist++;
          if (board[node]?.type === 'event') { effectiveValue = dist; break; }
        }
      }

      addLog(tg('log.pw.relanceResult', { power: locName(POWERS.relance), value: finalValue, effective: mode !== 'replace' ? tg('log.pw.relanceEffective', { value: effectiveValue }) : '' }));

      // --- Voies L5 / ultimes L10 de l'arbre de Maîtrise « Relance » ---
      let nt = [...get().teams];
      let dirty = false;
      const patchTeam = (i, patch) => { nt[i] = { ...nt[i], ...patch }; dirty = true; };
      const me = () => nt[currentTeam];

      // Relance lucrative (L5) : or = valeur du dé × multiplicateur (1 → 2 → 3).
      if (rEff.goldPerRoll) {
        const gain = finalValue * rEff.goldPerRoll;
        patchTeam(currentTeam, { money: (me().money || 0) + gain });
        addLog(tg('log.pw.relanceGold', { n: gain }));
      }

      // Relance chanceuse (L5) : sur un « haut » résultat, recharge un AUTRE pouvoir
      // et arme un bonus de loot (palier L7) / double loot (palier L9). Le seuil est
      // mis à l'échelle du dé : « 6+ » sur un D6 = 1 face gagnante → on garde le MÊME
      // nombre de faces gagnantes sur le D10 du Gros dé (L8), sinon « 6+ » deviendrait
      // 50 % au lieu de ~17 %.
      const highThreshold = rEff.rechargeOnHigh ? (sides - 6 + rEff.rechargeOnHigh) : 0;
      if (rEff.rechargeOnHigh && finalValue >= highThreshold) {
        const keys = Object.keys(me().powers || {}).filter((k) => POWERS[k] && k !== 'relance');
        const pool = keys.length ? keys : Object.keys(me().powers || {}).filter((k) => POWERS[k]);
        if (pool.length) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          patchTeam(currentTeam, { powers: { ...me().powers, [pick]: { ...me().powers[pick], charges: addCharge(me().powers[pick].charges) } } });
          addLog(tg('log.pw.surcharge', { power: locName(POWERS[pick]) }));
        }
        if (rEff.lootBonusOnHigh) patchTeam(currentTeam, { relanceLootBonus: rEff.lootBonusOnHigh });
        if (rEff.doubleLootOnHigh) patchTeam(currentTeam, { relanceDoubleLoot: rEff.doubleLootOnHigh });
      }

      // Relance opportune (L5) : arme un bonus pour la PROCHAINE question du tour
      // (+temps et choix du thème).
      if (rEff.reqTimeBonus || rEff.reChooseSubject) {
        patchTeam(currentTeam, { relanceQ: { bonusTime: rEff.reqTimeBonus || 0, chooseSubject: !!rEff.reChooseSubject } });
        addLog(tg('log.pw.relanceOpportune'));
      }

      // Relance vengeresse (L10) : recule le 1ᵉʳ groupe (le plus avancé, hors soi)
      // de la valeur du dé. Le bouclier de la cible peut l'atténuer (applyRecul).
      if (rEff.vengefulPushLeader) {
        const board = get().board;
        const xOf = (t) => (t?.pos && board[t.pos] ? board[t.pos].x : -Infinity);
        let lead = -1, leadX = -Infinity;
        nt.forEach((t, i) => { if (i !== currentTeam && xOf(t) > leadX) { leadX = xOf(t); lead = i; } });
        if (lead >= 0) {
          const L = nt[lead];
          if ((L.totalImmuneTurns ?? 0) > 0) {
            // Le leader est immunisé : le recul vengeur n'a aucun effet.
            addLog(tg('log.pw.immuneBlock', { emoji: L.emoji, name: L.name, power: locName(POWERS.relance) }));
          } else if (L.itemFumigene) {
            // Bombe fumigène : le coup est esquivé (et la fumigène se consomme).
            patchTeam(lead, { itemFumigene: false, itemFumigeneTurns: undefined });
            addLog(tg('log.pw.fumigeneBlock', { emoji: L.emoji, name: L.name, power: locName(POWERS.relance) }));
          } else {
            const r = applyRecul(L, board, finalValue, masteryActive(get));
            patchTeam(lead, r.patch);
            addLog(tg('log.pw.relanceVengeful', { emoji: L.emoji, name: L.name, n: r.applied ?? finalValue }));
          }
        }
      }

      if (dirty) set({ teams: nt });

      // skipOnRoll : ne pas re-déclencher le bonus on:roll de l'équipement (déjà
      // accordé au lancer initial) → pas de double bonus via la Relance.
      get().handleDiceResult(effectiveValue, { skipOnRoll: true });
    }
  }, 80);
}

// Renvoie l'effet effectif de Relance d'une équipe SI l'ultime « Échange de place »
// est disponible (niv.10 + voie swap), avec sa cible et son coût. Sinon null.
// Sert au garde de useRelanceSwap ET à l'affichage du bouton (TBI + mobile).
export function relanceSwapInfo(get, teamIndex) {
  if (!masteryActive(get)) return null;
  const { teams, board } = get();
  const team = teams[teamIndex];
  const rl = team?.powers?.relance;
  if (!rl) return null;
  const eff = resolvePowerEffect(team, 'relance', true);
  if (!eff.swapWithLeader) return null;
  const cost = eff.swapCost || 5;
  const xOf = (t) => (t?.pos && board[t.pos] ? board[t.pos].x : -Infinity);
  const myX = xOf(team);
  let lead = -1, leadX = myX;
  teams.forEach((t, i) => { if (i !== teamIndex && xOf(t) > leadX) { leadX = xOf(t); lead = i; } });
  return { cost, charges: rl.charges ?? 0, leaderIdx: lead, canUse: lead >= 0 && (rl.charges ?? 0) >= cost };
}

// Ultime « Échange de place » (Relance L10) : dépense `cost` charges pour échanger
// sa position avec l'équipe la plus avancée. Réservé au tour de l'équipe.
export function useRelanceSwap(set, get, teamIndex) {
  const { teams, currentTeam, board, addLog } = get();
  const i = teamIndex == null ? currentTeam : teamIndex;
  if (i !== currentTeam || get().finished) return; // uniquement à son tour
  if (teams[i]?.silencedNextTurn) { addLog(tg('log.pw.silenced', { emoji: teams[i].emoji, name: teams[i].name })); return; }
  const info = relanceSwapInfo(get, i);
  if (!info || !info.canUse) return;
  const me = teams[i], leader = teams[info.leaderIdx];
  const nt = [...teams];
  const myPos = me.pos, leadPos = leader.pos;
  const grow = (t, pos) => (t.maxPos && board[t.maxPos] && board[t.maxPos].x >= board[pos].x ? t.maxPos : pos);
  nt[i] = { ...me, pos: leadPos, maxPos: grow(me, leadPos), powers: { ...me.powers, relance: { ...me.powers.relance, charges: me.powers.relance.charges - info.cost } } };
  nt[info.leaderIdx] = { ...leader, pos: myPos, maxPos: grow(leader, myPos) };
  set({ teams: nt });
  soundDice();
  addLog(tg('log.pw.relanceSwap', { emoji: me.emoji, name: me.name, vemoji: leader.emoji, vname: leader.name }));
  get().recordStat?.('powerUses', { teamIdx: i, powerKey: 'relance', targetIdx: info.leaderIdx });
  if (get().phase === 'game') saveGame(get());
}

// Renvoie {cost, turns, charges, canUse} si l'ultime « Immunité totale » (Bouclier
// L10) est disponible pour l'équipe, sinon null. Sert au garde + à l'affichage.
export function shieldImmunityInfo(get, teamIndex) {
  if (!masteryActive(get)) return null;
  const team = get().teams[teamIndex];
  const bl = team?.powers?.bouclier;
  if (!bl) return null;
  const eff = resolvePowerEffect(team, 'bouclier', true);
  if (!eff.totalImmune) return null;
  const cost = eff.immuneCost || 5;
  return { cost, turns: eff.immuneTurns || 2, charges: bl.charges ?? 0, canUse: (bl.charges ?? 0) >= cost };
}

// Ultime actif « Immunité totale » : dépense `cost` charges → immunité aux attaques
// adverses pendant `turns` tours (décrémenté dans nextTurn).
export function useShieldImmunity(set, get, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const i = teamIndex == null ? currentTeam : teamIndex;
  if (i !== currentTeam || get().finished) return; // à son tour uniquement
  if (teams[i]?.silencedNextTurn) { addLog(tg('log.pw.silenced', { emoji: teams[i].emoji, name: teams[i].name })); return; }
  if ((teams[i]?.totalImmuneTurns ?? 0) > 0) return; // déjà immunisé : pas de re-cast (anti double-dépense)
  const info = shieldImmunityInfo(get, i);
  if (!info || !info.canUse) return;
  const me = teams[i];
  const nt = [...teams];
  nt[i] = { ...me, powers: { ...me.powers, bouclier: { ...me.powers.bouclier, charges: me.powers.bouclier.charges - info.cost } }, totalImmuneTurns: info.turns };
  set({ teams: nt });
  soundPower();
  addLog(tg('log.pw.immuneCast', { emoji: me.emoji, name: me.name, turns: info.turns }));
  announce(set, get, '🛡️', tg('log.pw.immuneToast', { emoji: me.emoji }), POWERS.bouclier?.color || '#3b6cb3');
  get().recordStat?.('powerUses', { teamIdx: i, powerKey: 'bouclier', targetIdx: null });
  if (get().phase === 'game') saveGame(get());
}

export function applyOffensivePower(set, get, targetTeamIndex) {
  const { teams, currentTeam, board, showTargetPicker, addLog } = get();
  if (!showTargetPicker) return;
  const { powerKey } = showTargetPicker;
  const team = teams[currentTeam];
  const target = teams[targetTeamIndex];
  if (!target) return;
  const newTeams = [...teams];

  const result = consumePowerCharge(team, powerKey);
  if (!result) return;
  newTeams[currentTeam] = result.updatedTeam;
  // Analytics : usage de pouvoir offensif (charge consommée, quelle que soit l'issue).
  get().recordStat?.('powerUses', { teamIdx: currentTeam, powerKey, targetIdx: targetTeamIndex });

  const level = team.powers?.[powerKey]?.level ?? 1;
  const effect = powerEffectOf(get, team, powerKey);
  let foudreMove = null;
  let lightning = false;

  // Garde unifié, applique PAR CIBLE : une équipe immunisée (Immunité totale)
  // annule l'effet sur elle ; une Bombe fumigène l'esquive (et se consomme).
  // Gère le multi-cibles (Cataclysme/Chaîne/Tempête de sable), pas seulement la
  // cible choisie. Renvoie true si la cible `ti` est protégée (à sauter).
  const offBlocked = (ti) => {
    const v = newTeams[ti];
    if ((v.totalImmuneTurns ?? 0) > 0) {
      addLog(tg('log.pw.immuneBlock', { emoji: v.emoji, name: v.name, power: locName(POWERS[powerKey]) }));
      return true;
    }
    if (v.itemFumigene) {
      newTeams[ti] = { ...v, itemFumigene: false, itemFumigeneTurns: undefined };
      addLog(tg('log.pw.fumigeneBlock', { emoji: v.emoji, name: v.name, power: locName(POWERS[powerKey]) }));
      return true;
    }
    return false;
  };

  if (powerKey === 'foudre' && effect.placeTrap) {
    // Orage (L10) : pose un piège-foudre sur une case (réutilise le moteur de pièges).
    set({ teams: newTeams, showTargetPicker: null });
    addLog(tg('log.pw.orage', { emoji: team.emoji, name: team.name }));
    runEffects(set, get, [{
      action: 'placeTrap',
      trap: { label: 'Orage', icon: '⚡', do: [{ action: 'move', target: 'self', dir: 'back', n: effect.amount || 'd10' }] },
    }], { source: 'item', sourceTeam: currentTeam });
    return;
  }

  if (powerKey === 'foudre') {
    // Recul de la/les cible(s), atténué par leur équipement et leur Bouclier (Égide).
    const masteryOn = masteryActive(get);
    // Surcharge (L5) : consomme 1 charge de Foudre suppl\u00E9mentaire.
    if (effect.extraChargeCost) {
      const extra = consumePowerCharge(newTeams[currentTeam], 'foudre');
      if (extra) newTeams[currentTeam] = extra.updatedTeam;
    }
    const baseRoll = Math.round((resolveAmount(effect.amount ?? 'd4', target) + (effect.flat || 0)) * (effect.amountMult || 1));
    const dieLabel = diceLabel(effect.amount ?? 'd4') + (effect.flat ? ` +${effect.flat}` : '') + (effect.amountMult ? ` \u00D7${effect.amountMult}` : '');

    // Cibles : la choisie + (Cataclysme) tous les adversaires + (Cha\u00EEne) la mieux plac\u00E9e.
    const opponents = newTeams.map((_, i) => i).filter((i) => i !== currentTeam);
    const targets = new Set([targetTeamIndex]);
    if (effect.allOthers) opponents.forEach((i) => targets.add(i));
    if (effect.chain && opponents.length) {
      let best = opponents[0], bestX = -Infinity;
      for (const i of opponents) { const x = board[newTeams[i].pos]?.x ?? -Infinity; if (x > bestX) { bestX = x; best = i; } }
      targets.add(best);
    }

    const moves = [];
    let reflectTotal = 0, stolenTotal = 0;
    for (const ti of targets) {
      if (offBlocked(ti)) continue; // immunité / fumigène (par cible, multi inclus)
      let v = newTeams[ti];
      let rolled = baseRoll;
      const vEff = resolvePowerEffect(v, 'bouclier', masteryOn);
      const vCharges = v.powers?.bouclier?.charges ?? 0;
      // Anti-Foudre (cible) : r\u00E9duit de moiti\u00E9 le recul de Foudre (consomme 1 charge),
      // puis (palier L7) renvoie la moiti\u00E9 du recul pr\u00E9vu \u00E0 l'attaquant et (L9) la
      // convertit en or pour la cible.
      if (vEff.foudreReduceFraction && vCharges > 0) {
        const before = rolled;
        rolled = Math.max(0, Math.round(rolled * (1 - vEff.foudreReduceFraction)));
        v = { ...v, powers: { ...v.powers, bouclier: { ...v.powers.bouclier, charges: vCharges - 1 } } };
        if (vEff.foudreReflectFraction) {
          const refl = Math.round(before * vEff.foudreReflectFraction);
          reflectTotal += refl;
          if (vEff.foudreReflectGold && refl > 0) v = { ...v, money: (v.money || 0) + refl };
        }
      }
      // Temp\u00EAte cibl\u00E9e : vol d'or \u2014 bloqu\u00E9 par Banque fortifi\u00E9e (goldUnstealable).
      if (effect.stealGold && !vEff.goldUnstealable) { const s = Math.min(effect.stealGold, v.money || 0); v = { ...v, money: (v.money || 0) - s }; stolenTotal += s; }
      const amt = reducedRecul(v, rolled);
      // Bannissement (L10) : renvoie à la dernière jonction ; sinon recul classique.
      let rr;
      if (effect.toPrevJunction) {
        const pj = findPrevJunction(board, v.pos);
        rr = pj && pj !== v.pos ? { finalPos: pj, path: [v.pos, pj] } : moveBack(board, v.pos, amt);
      } else {
        rr = moveBack(board, v.pos, amt);
      }
      newTeams[ti] = { ...v, pos: rr.finalPos };
      if (rr.path.length > 1) moves.push({ teamIndex: ti, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
    }
    if (stolenTotal > 0) newTeams[currentTeam] = { ...newTeams[currentTeam], money: (newTeams[currentTeam].money || 0) + stolenTotal };
    if (reflectTotal > 0) {
      const amt = reducedRecul(newTeams[currentTeam], reflectTotal);
      const rr = moveBack(board, newTeams[currentTeam].pos, amt);
      newTeams[currentTeam] = { ...newTeams[currentTeam], pos: rr.finalPos };
      if (rr.path.length > 1) moves.push({ teamIndex: currentTeam, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
    }
    foudreMove = moves.length ? moves : null;
    lightning = true;
    soundThunder();
    const nT = targets.size;
    const foudreName = locName(POWERS[powerKey]);
    const foudreSteal = stolenTotal ? tg('log.pw.foudreSteal', { n: stolenTotal }) : '';
    const foudreReflect = reflectTotal ? tg('log.pw.foudreReflect') : '';
    addLog(nT > 1
      ? tg('log.pw.foudreUseMany', { emoji: team.emoji, name: team.name, power: foudreName, level, die: dieLabel, nT, steal: foudreSteal, reflect: foudreReflect })
      : tg('log.pw.foudreUseOne', { emoji: team.emoji, name: team.name, power: foudreName, level, die: dieLabel, vemoji: target.emoji, vname: target.name, steal: foudreSteal, reflect: foudreReflect }));
    announce(set, get, '⚡', nT > 1
      ? tg('log.pw.foudreToastMany', { power: foudreName, die: dieLabel, nT })
      : tg('log.pw.foudreToastOne', { power: foudreName, die: dieLabel, vemoji: target.emoji, vname: target.name }), POWERS[powerKey].color);
  } else if (powerKey === 'sablier') {
    const divisor = effect.divisor ?? 2;
    // Tempête de sable (L10) : toutes les autres équipes ; sinon la cible choisie.
    const sablierOpp = newTeams.map((_, i) => i).filter((i) => i !== currentTeam);
    const sablierTargets = effect.allOthers ? new Set(sablierOpp) : new Set([targetTeamIndex]);
    for (const ti of sablierTargets) {
      if (offBlocked(ti)) continue; // immunité / fumigène (par cible)
      newTeams[ti] = {
        ...newTeams[ti],
        sablierActif: true, sablierDivisor: divisor,
        ...(effect.silenceNextTurn ? { silencedNextTurn: true } : {}),
        ...(effect.skipNextRoll ? { skipNextRoll: true } : {}),
        ...(effect.goldPenaltyOnTimeout ? { timeoutPenalty: effect.goldPenaltyOnTimeout } : {}),
        ...(effect.confuse ? { confused: true } : {}),
      };
    }
    // Vol de temps (L10) : le temps retiré est crédité au lanceur (prochaine question).
    if (effect.stealTime) {
      const credit = Math.max(0, Math.round(30 - 30 / divisor));
      newTeams[currentTeam] = { ...newTeams[currentTeam], timeCredit: (newTeams[currentTeam].timeCredit || 0) + credit };
    }
    const nS = sablierTargets.size;
    soundPower();
    const sablierName = locName(POWERS[powerKey]);
    const extrasS = `${effect.silenceNextTurn ? tg('log.pw.sablierSilence') : ''}${effect.skipNextRoll ? tg('log.pw.sablierFreeze') : ''}${effect.goldPenaltyOnTimeout ? tg('log.pw.sablierTax', { n: effect.goldPenaltyOnTimeout }) : ''}`;
    addLog(nS > 1
      ? tg('log.pw.sablierUseMany', { emoji: team.emoji, name: team.name, power: sablierName, level, nS, divisor, extras: extrasS })
      : tg('log.pw.sablierUseOne', { emoji: team.emoji, name: team.name, power: sablierName, level, vemoji: target.emoji, vname: target.name, divisor, extras: extrasS }));
    announce(set, get, '⏱️', nS > 1
      ? tg('log.pw.sablierToastMany', { power: sablierName, divisor, nS })
      : tg('log.pw.sablierToastOne', { power: sablierName, divisor, vemoji: target.emoji, vname: target.name }), POWERS[powerKey].color);
  } else if (powerKey === 'double') {
    // Double cible une seule equipe : immunite/fumigene la protegent (charge depensee).
    if (offBlocked(targetTeamIndex)) {
      set({ teams: newTeams, showTargetPicker: null });
      return;
    }
    // Cumulable : on AJOUTE des questions extra (plafonnees), sans ecraser un cast precedent.
    // extraAdd : questions supplémentaires des voies (Rafale tranquille / Marathon+).
    const add = (effect.add ?? 1) + (effect.extraAdd || 0);
    const newExtra = Math.min((target.doubleExtra || 0) + add, MAX_DOUBLE_EXTRA);
    // Facteur d'or de la rafale : Chrono partagé (×1.5) / Rafale tranquille (÷2).
    // Ces voies font GAGNER de l'or à la cible (avec le facteur) → on lève le « sans bonus ».
    const goldFactor = (effect.goldMult || 1) / (effect.goldDiv || 1);
    const goldFx = goldFactor !== 1 ? { doubleGoldFactor: goldFactor } : {};
    // Tout-ou-rien : gains banqués puis doublés si rafale parfaite (sinon 0) → bonus actif.
    const allOrNothing = !!effect.allOrNothing;
    const aon = allOrNothing ? { doubleAllOrNothing: true, doubleBank: 0 } : {};
    const noBonus = (goldFactor !== 1 || allOrNothing) ? false : (!!effect.noBonus || !!target.doubleNoBonus); // collant
    // Niv.3 : timer reduit persistant sur la rafale — champ separe du Sablier
    // (un Sablier adverse one-shot ne doit pas heriter de cette persistance)
    const newDiv = Math.max(target.doubleTimerDivisor || 1, effect.timerDivisor || 1);
    const pressure = newDiv > 1 ? { doubleTimerDivisor: newDiv } : {};
    // Examen surprise : la 1re question de la rafale sera Hardcore (si le pool existe).
    const hcPool = (get().questions?.hardcore || []).length > 0;
    const hcFx = (effect.hardcoreOne && hcPool) ? { forcedSubject: 'hardcore' } : {};
    // Interro générale (L10) : à la fin de la rafale, la cible renvoie une Double sur l'attaquant.
    const reflFx = effect.reflectToTarget ? { doubleReflectTo: currentTeam } : {};
    // Chrono partagé (L5) : un seul chrono pour toute la rafale.
    const stFx = effect.sharedTimer ? { doubleSharedTimer: true } : {};
    newTeams[targetTeamIndex] = { ...target, doubleActive: true, doubleExtra: newExtra, doubleNoBonus: noBonus, ...pressure, ...goldFx, ...aon, ...hcFx, ...reflFx, ...stFx };
    soundPower();
    const doubleName = locName(POWERS[powerKey]);
    const doubleTotal = 1 + newExtra;
    addLog(tgPlural('log.pw.doubleUse', add, { emoji: team.emoji, name: team.name, power: doubleName, level, vemoji: target.emoji, vname: target.name, add, total: doubleTotal, noBonus: noBonus ? tg('log.pw.doubleNoBonus') : '', timer: newDiv > 1 ? tg('log.pw.doubleTimer', { n: newDiv }) : '' }));
    announce(set, get, '❓', tgPlural('log.pw.doubleToast', doubleTotal, { power: doubleName, vemoji: target.emoji, vname: target.name, total: doubleTotal }), POWERS[powerKey].color);
  }

  set({ teams: newTeams, showTargetPicker: null, ...(foudreMove ? { movePath: foudreMove } : {}) });
  if (lightning) get().emitVfx('lightning', targetTeamIndex);
  // Stay in pendingLanding so player can use more powers before clicking "Continuer"
}

export function cancelTargetPicker(set, get) {
  set({ showTargetPicker: null });
  // Stay in pendingLanding — player can use other powers or click "Continuer"
}

// --- Charge picker (gainCharge : consommable / équipement) ---

export function chargePickerChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  // Source : 'item' (consommable legacy) ou 'engine' (moteur d'effets / équipement)
  const source = get().showChargePicker?.source;
  const team = teams[currentTeam];
  const newTeams = [...teams];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: addCharge(currentCharges) } };
  newTeams[currentTeam] = { ...team, powers: newPowers };
  const pName = locName(POWERS[powerKey]) || powerKey;
  addLog(tg('log.pw.gainCharge', { emoji: team.emoji, name: team.name, power: pName }));
  soundCharge();
  set({ teams: newTeams, showChargePicker: false });

  // Moteur d'effets : reprendre la file après la recharge (l'action gainCharge est résolue).
  if (source === 'engine') { resumeEngineQueue(set, get, { chargeDone: true }); return; }
  // Sinon (consommable) : on a juste rechargé — le joueur poursuit son tour.
}

export function chargePickerSkip(set, get) {
  const source = get().showChargePicker?.source;
  set({ showChargePicker: false });
  // Moteur d'effets : sauter la recharge mais poursuivre la file.
  if (source === 'engine') { resumeEngineQueue(set, get, { chargeDone: true }); return; }
  // Stay in pendingLanding — player clicks "Continuer" when ready
}

// --- Shop ---

// teamIndex (optionnel) : par d\u00e9faut l'\u00e9quipe active ; pr\u00e9cis\u00e9 pour les achats
// pilot\u00e9s depuis un t\u00e9l\u00e9phone (cf. applyTeamIntent).
export function buyNewPower(set, get, powerKey, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const idx = teamIndex ?? currentTeam;
  const team = teams[idx];
  const power = POWERS[powerKey];
  if (!power || !team) return;
  const price = power.price;
  if (team.money < price) return;
  if (team.powers?.[powerKey]) return;

  const newTeams = [...teams];
  const newPowers = { ...team.powers, [powerKey]: { charges: 1, level: 1 } };
  newTeams[idx] = { ...team, money: team.money - price, powers: newPowers };
  addLog(tg('log.pw.unlock', { emoji: team.emoji, name: team.name, power: locName(power), price }));
  set({ teams: newTeams });
  saveGame(get());
}

export function buyPowerCharge(set, get, powerKey, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const idx = teamIndex ?? currentTeam;
  const team = teams[idx];
  // On ne recharge qu'un pouvoir D\u00c9J\u00c0 poss\u00e9d\u00e9 (\u00e9vite une entr\u00e9e sans `level`).
  if (!team?.powers?.[powerKey]) return;
  const currentCharges = team.powers[powerKey].charges ?? 0;
  // Plafond : pas d'achat (ni de d\u00e9pense) si d\u00e9j\u00e0 au maximum de charges.
  if (currentCharges >= MAX_CHARGES) return;
  const price = POWERS[powerKey]?.price || 15;
  if (team.money < price) return;

  const newTeams = [...teams];
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: addCharge(currentCharges) } };
  newTeams[idx] = { ...team, money: team.money - price, powers: newPowers };

  const pName = locName(POWERS[powerKey]) || powerKey;
  addLog(tg('log.pw.buyCharge', { emoji: team.emoji, name: team.name, power: pName, price }));
  set({ teams: newTeams });
  if (get().phase === 'game') saveGame(get());
}

export function upgradePowerLevel(set, get, powerKey, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const idx = teamIndex ?? currentTeam;
  const team = teams[idx];
  const power = POWERS[powerKey];
  if (!power || !team) return;
  const mastery = masteryActive(get);
  const currentLevel = team.powers?.[powerKey]?.level ?? 1;
  if (currentLevel >= maxPowerLevel(powerKey, mastery)) return; // 10 avec Ma\u00EEtrise, sinon 3
  const cost = powerUpgradeCost(powerKey, currentLevel, mastery);
  if (cost == null || team.money < cost) return;

  const newLevel = currentLevel + 1;
  const newTeams = [...teams];
  const newPowers = { ...team.powers, [powerKey]: { ...team.powers[powerKey], level: newLevel } };
  newTeams[idx] = { ...team, powers: newPowers, money: team.money - cost };
  addLog(tg('log.pw.upgrade', { emoji: team.emoji, name: team.name, power: locName(power), level: newLevel, cost }));

  // Niveaux 5 et 10 (Ma\u00EEtrise) : ouvrir le choix de voie. Le picker modal du TBI
  // n'est ouvert que pour l'\u00e9quipe ACTIVE ; un achat \u00E0 distance (t\u00e9l\u00e9phone d'une
  // autre \u00e9quipe) laisse la voie \u00AB \u00E0 choisir \u00BB c\u00F4t\u00e9 mobile (cf. chooseSpecFor).
  const slot = mastery ? specSlotForLevel(newLevel) : null;
  set({ teams: newTeams, ...(slot && idx === currentTeam ? { showSpecPicker: { powerKey, slot, teamIdx: idx } } : {}) });
  saveGame(get());
}

// Choix d'une voie \u00E0 distance (t\u00e9l\u00e9phone) : applique directement pour `teamIndex`
// sans passer par le modal showSpecPicker du TBI. Verrouill\u00e9 une fois choisi.
export function chooseSpecFor(set, get, teamIndex, powerKey, slot, specKey) {
  if (!masteryActive(get)) return;
  if (slot !== 'spec5' && slot !== 'spec10') return;
  const teams = get().teams;
  const team = teams[teamIndex];
  const entry = team?.powers?.[powerKey];
  if (!entry) return;
  const need = slot === 'spec5' ? 5 : 10;
  if ((entry.level ?? 1) < need) return; // niveau d'embranchement non atteint
  if (entry[slot]) return;               // d\u00e9j\u00E0 choisi (verrouill\u00e9)
  const opt = specOptionsFor(powerKey, slot).find((o) => o.key === specKey);
  if (!opt) return;
  const newTeams = [...teams];
  newTeams[teamIndex] = { ...team, powers: { ...team.powers, [powerKey]: { ...entry, [slot]: specKey } } };
  get().addLog(tg('log.pw.specChosen', { icon: opt.icon || '✨', emoji: team.emoji, name: team.name, power: locName(POWERS[powerKey]), spec: opt.name }));
  // Ferme le picker du TBI s'il portait sur CE même choix (évite que le prof
  // ré-écrase ensuite le choix fait au téléphone — la voie est verrouillée).
  const pk = get().showSpecPicker;
  const closePicker = pk && pk.powerKey === powerKey && pk.slot === slot && pk.teamIdx === teamIndex;
  set({ teams: newTeams, ...(closePicker ? { showSpecPicker: null } : {}) });
  saveGame(get());
}

// Choix d'une voie (spec5/spec10) au passage de niveau. Verrouill\u00e9 pour la partie.
export function chooseSpec(set, get, specKey) {
  const picker = get().showSpecPicker;
  if (!picker) return;
  const { powerKey, slot, teamIdx } = picker;
  const teams = get().teams;
  const team = teams[teamIdx];
  if (!team?.powers?.[powerKey]) { set({ showSpecPicker: null }); return; }
  // Voie déjà choisie (ex. pick fait au téléphone entre-temps) : verrou, on ferme.
  if (team.powers[powerKey][slot]) { set({ showSpecPicker: null }); return; }
  const opt = specOptionsFor(powerKey, slot).find((o) => o.key === specKey);
  if (!opt) return;
  const newTeams = [...teams];
  newTeams[teamIdx] = { ...team, powers: { ...team.powers, [powerKey]: { ...team.powers[powerKey], [slot]: specKey } } };
  get().addLog(tg('log.pw.specChosen', { icon: opt.icon || '✨', emoji: team.emoji, name: team.name, power: locName(POWERS[powerKey]), spec: opt.name }));
  set({ teams: newTeams, showSpecPicker: null });
  saveGame(get());
}
