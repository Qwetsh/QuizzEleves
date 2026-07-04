import { POWERS, MAX_CHARGES, addCharge } from '../data/powers.js';
import { moveBack, moveForward, findPrevJunction } from '../logic/pathfinding.js';
import { consumePowerCharge, applyRecul } from '../logic/turnHelpers.js';
import { reducedRecul, resolveAmount, diceLabel, rollsReflect, isGoldStealImmune } from '../logic/itemEffects.js';
import { resolvePowerEffect, maxPowerLevel, powerUpgradeCost, specSlotForLevel, specOptionsFor } from '../logic/powerEffects.js';
import { extOn } from '../extensions/registry.js';
import { saveGame } from './persistence.js';
import { soundThunder, soundPower, soundDice, soundCharge, soundSablier, soundSablierBoost, soundDouble } from '../logic/sounds.js';
import { resumeQueue as resumeEngineQueue, announce, runEffects } from './effectEngine.js';
import { tg, tgPlural } from '../i18n';
import { locName } from '../i18n/content.js';
import { hasActivePromise, withoutPromise, PACT_BETRAY_PENALTY } from '../logic/pacts.js';

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
  // Blocage des pouvoirs (objet/effet adverse) : aucun pouvoir pendant X tours.
  if (team.powersBlockedTurns > 0) {
    get().addLog(tgPlural('log.pw.powersBlocked', team.powersBlockedTurns, { emoji: team.emoji, name: team.name, n: team.powersBlockedTurns }));
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
    // Auto-ciblage (Sablier L4+) : autorise à se cibler soi-même (gain de temps).
    const offEff = powerEffectOf(get, team, powerKey);
    set({ showTargetPicker: { powerKey, allowSelf: !!offEff.autoTarget } });
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
  // 1 élimination (count=1), + une 2e avec probabilité secondChance (25/50/75 %)
  // tant que le coeur n'en garantit pas 2 ; dès L6 count=2 (sûres).
  let want = effect.count ?? 1;
  if ((effect.count ?? 1) < 2 && effect.secondChance && Math.random() < effect.secondChance) want += 1;
  // Indices en chaine (palier max) : ne garder que la bonne reponse.
  if (effect.chainHints && (effect.chainHintUses || 0) >= 99) want = wrongIndices.length;
  const hideMore = Math.min(want, fresh.length);
  const hidden = [...already, ...fresh.slice(0, hideMore)];
  // Bonus de temps : palier + Sérénité (timerMult) + Maître du temps (noTimer).
  const bonusTime = effect.hintTimeBonus || 0; // Maitrise du temps (voie) : +N s au clic

  // Rien \u00e0 \u00e9liminer en plus (\u00e9quipement a d\u00e9j\u00e0 tout masqu\u00e9) ET pas de bonus de
  // temps : on NE consomme PAS la charge (sinon perte s\u00e8che).
  if (hideMore === 0 && bonusTime <= 0 && !effect.hintLoot && !effect.legendaryOnHint) {
    addLog(tg('log.pw.indiceAllGone', { emoji: team.emoji, name: team.name }));
    return;
  }

  const result = consumePowerCharge(team, 'indice');
  if (!result) return;

  const newTeams = [...teams];
  newTeams[currentTeam] = result.updatedTeam;
  // Objet legendaire (ultime) : arme pour cette question (octroye si bonne reponse).
  if (effect.legendaryOnHint) newTeams[currentTeam] = { ...newTeams[currentTeam], indiceLegendaryArmed: true };
  // Indices en chaine (voie) : plusieurs usages/question ; on ne verrouille
  // `indiceUsed` qu'une fois le nombre d'usages atteint.
  const uses = (get().indiceUses || 0) + 1;
  const maxUses = effect.chainHints ? Math.max(1, effect.chainHintUses || 1) : 1;

  const indiceBonus = bonusTime > 0 ? tg('log.pw.bonusTime', { n: bonusTime }) : '';
  const indicePower = locName(POWERS.indice);
  addLog(tgPlural('log.pw.indiceUse', hideMore, { emoji: team.emoji, name: team.name, power: indicePower, level, n: hideMore, bonus: indiceBonus }));
  set({ teams: newTeams, indiceUsed: uses >= maxUses, indiceUses: uses, indiceHidden: hidden });
  get().recordStat?.('powerUses', { teamIdx: currentTeam, powerKey: 'indice', targetIdx: null });
  announce(set, get, '💡', tgPlural('log.pw.indiceToast', hideMore, { power: indicePower, n: hideMore, bonus: indiceBonus }), POWERS.indice?.color || '#e8b117');

  // Bonus de temps (palier + Sérénité + Maître du temps) et Antisèche (or si bonne réponse).
  const patchQ = {};
  if (bonusTime > 0) {
    patchQ.bonusTime = (get().showQuestion?.bonusTime || 0) + bonusTime;
    // L'horloge de la question vit dans le store (deadline) : on la prolonge
    // d'autant — la modale ET la manette téléphone relisent le temps depuis là.
    if (get().showQuestion?.deadline) patchQ.deadline = get().showQuestion.deadline + bonusTime * 1000;
  }
  if (effect.hintLoot && effect.hintGold) patchQ.indiceBonusMoney = (get().showQuestion?.indiceBonusMoney || 0) + effect.hintGold;
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
  // Dé de relance : toujours un D6 (le multi-dé a été retiré du jeu).
  const sides = 6;
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

      // Relance chanceuse (L5) : sur un « haut » résultat (6+ sur le D6), recharge un
      // AUTRE pouvoir et arme un bonus de loot (palier L7) / double loot (palier L9).
      const highThreshold = rEff.rechargeOnHigh || 0;
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

// Renvoie {cost, charges, canUse} si l'ultime « Clairvoyance » (Indice L10) est
// disponible pour l'équipe (à son tour, avec une question ouverte), sinon null.
export function clairvoyanceInfo(get, teamIndex) {
  if (!masteryActive(get)) return null;
  const team = get().teams[teamIndex];
  const ind = team?.powers?.indice;
  if (!ind) return null;
  const eff = resolvePowerEffect(team, 'indice', true);
  if (!eff.clairvoyance) return null;
  const cost = eff.activeCost || 5;
  return { cost, charges: ind.charges ?? 0, canUse: (ind.charges ?? 0) >= cost };
}

// Ultime actif « Clairvoyance » : dépense `cost` charges → révèle la bonne réponse
// à TOUTES les questions du tour (la question en cours + la salve). La série compte
// normalement. Le drapeau est levé à la fin du tour (nextTurn).
export function useClairvoyance(set, get, teamIndex) {
  const { teams, currentTeam, showQuestion, addLog } = get();
  const i = teamIndex == null ? currentTeam : teamIndex;
  if (i !== currentTeam || get().finished) return;
  if (teams[i]?.silencedNextTurn) { addLog(tg('log.pw.silenced', { emoji: teams[i].emoji, name: teams[i].name })); return; }
  if (teams[i]?.clairvoyanceTurn) return; // déjà actif ce tour
  const info = clairvoyanceInfo(get, i);
  if (!info || !info.canUse) return;
  const me = teams[i];
  const nt = [...teams];
  nt[i] = { ...me, powers: { ...me.powers, indice: { ...me.powers.indice, charges: me.powers.indice.charges - info.cost } }, clairvoyanceTurn: true };
  set({ teams: nt });
  if (showQuestion) set({ showQuestion: { ...get().showQuestion, revealHint: true, revealed: true } });
  soundPower();
  addLog(tg('log.pw.clairvoyance', { emoji: me.emoji, name: me.name }));
  announce(set, get, '🔮', tg('log.pw.clairvoyanceToast'), POWERS.indice?.color || '#e8b117');
  get().recordStat?.('powerUses', { teamIdx: i, powerKey: 'indice', targetIdx: null });
  if (get().phase === 'game') saveGame(get());
}

// Renvoie {cost, charges, canUse} si l'ultime « Renvoi au départ » (Foudre L10)
// est disponible (voie choisie + assez de charges), sinon null.
export function foudreBanishInfo(get, teamIndex) {
  if (!masteryActive(get)) return null;
  const team = get().teams[teamIndex];
  const fl = team?.powers?.foudre;
  if (!fl) return null;
  const eff = resolvePowerEffect(team, 'foudre', true);
  if (!eff.banishStart) return null;
  const cost = eff.activeCost || 5;
  return { cost, charges: fl.charges ?? 0, canUse: (fl.charges ?? 0) >= cost };
}

// Renvoie {cost, floor, charges, canUse} si l'ultime « Sablier brisé » (Sablier L10)
// est disponible, sinon null.
export function sablierBrokenInfo(get, teamIndex) {
  if (!masteryActive(get)) return null;
  const team = get().teams[teamIndex];
  const sl = team?.powers?.sablier;
  if (!sl) return null;
  const eff = resolvePowerEffect(team, 'sablier', true);
  if (!eff.brokenTimer) return null;
  const cost = eff.activeCost || 5;
  return { cost, floor: eff.brokenFloor || 7, charges: sl.charges ?? 0, canUse: (sl.charges ?? 0) >= cost };
}

// Ultime actif « Sablier brisé » : dépense `cost` charges → plafonne (permanent) le
// timer MAX des autres équipes au plancher `floor`. Bouton dédié (pas de cible).
export function useSablierBroken(set, get, teamIndex) {
  const { teams, currentTeam, addLog } = get();
  const i = teamIndex == null ? currentTeam : teamIndex;
  if (i !== currentTeam || get().finished) return;
  if (teams[i]?.silencedNextTurn) { addLog(tg('log.pw.silenced', { emoji: teams[i].emoji, name: teams[i].name })); return; }
  const info = sablierBrokenInfo(get, i);
  if (!info || !info.canUse) return;
  const nt = [...teams];
  const me = nt[i];
  nt[i] = { ...me, powers: { ...me.powers, sablier: { ...me.powers.sablier, charges: me.powers.sablier.charges - info.cost } } };
  for (let j = 0; j < nt.length; j++) {
    if (j === i || (nt[j].totalImmuneTurns ?? 0) > 0) continue; // immunité totale épargne
    nt[j] = { ...nt[j], maxTimerCap: Math.min(nt[j].maxTimerCap ?? 999, info.floor) };
  }
  set({ teams: nt });
  soundPower();
  addLog(tg('log.pw.sablierBrokenCast', { emoji: me.emoji, name: me.name, n: info.floor }));
  announce(set, get, '⏱️', tg('log.pw.sablierBrokenToast', { n: info.floor }), POWERS.sablier?.color || '#a83e7f');
  get().recordStat?.('powerUses', { teamIdx: i, powerKey: 'sablier', targetIdx: null });
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
  let foudreBoard = null; // board modifié si « Pose-piège » place des pièges
  let lightning = false;
  // Cibles RÉELLEMENT touchées (hors immunité/fumigène) → sert à détecter une
  // trahison de pacte (« Complots ») au moment de l'attaque.
  const hitSet = new Set();

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

  if (powerKey === 'foudre') {
    // Recul de la/les cible(s), atténué par leur équipement et leur Bouclier (Égide).
    const masteryOn = masteryActive(get);
    // Surcharge (L5) : consomme 1 charge de Foudre suppl\u00E9mentaire.
    // « Renvoi au départ » (ultime) : déclenché par SON bouton dédié (le picker
    // est ouvert avec banish:true), pas automatiquement. Envoie au DÉPART au lieu
    // du recul et coûte `activeCost` charges au lieu d'1.
    const chargesBefore = team.powers?.foudre?.charges ?? 0;
    const banishMode = !!effect.banishStart && !!showTargetPicker.banish && chargesBefore >= (effect.activeCost || 5);
    if (banishMode) {
      const cur = newTeams[currentTeam].powers.foudre;
      newTeams[currentTeam] = { ...newTeams[currentTeam], powers: { ...newTeams[currentTeam].powers, foudre: { ...cur, charges: Math.max(0, chargesBefore - (effect.activeCost || 5)) } } };
    }
    const dieValue = resolveAmount(effect.amount ?? 'd4', target); // « valeur du dé » (sans le flat)
    const baseRoll = dieValue + (effect.flat || 0);
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
    let reflectTotal = 0, stolenTotal = 0, opportunisteAdvance = 0;
    const chainHits = []; // Réaction en chaîne : reculs propagés (1 passe, attaquant immunisé)
    for (const ti of targets) {
      if (offBlocked(ti)) continue; // immunité / fumigène (par cible, multi inclus)
      hitSet.add(ti);
      let v = newTeams[ti];
      // Renvoi au départ : retour au départ, pas de recul classique.
      if (banishMode) {
        if (v.pos !== 'depart') {
          const rr0 = moveBack(board, v.pos, 9999);
          newTeams[ti] = { ...v, pos: rr0.finalPos };
          if (rr0.path.length > 1) moves.push({ teamIndex: ti, waypoints: rr0.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
        }
        continue;
      }
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
      // Pillage (voie) : vole de l'or = valeur du dé × mult (respecte les immunités au vol d'or).
      if (effect.pillage && effect.pillageMult && !vEff.goldUnstealable && !isGoldStealImmune(v)) {
        const s = Math.min(Math.round(dieValue * effect.pillageMult), v.money || 0);
        if (s > 0) { v = { ...v, money: (v.money || 0) - s }; stolenTotal += s; }
      }
      const amt = reducedRecul(v, rolled);
      // Renvoi (objet/passif « miroir ») : la cible retourne le recul à l'attaquant
      // (réutilise reflectTotal, déjà appliqué à l'attaquant plus bas). Elle ne bouge pas.
      if (amt > 0 && rollsReflect(v)) {
        reflectTotal += amt;
        newTeams[ti] = v;
        addLog(tg('log.pw.foudreReflected', { vemoji: v.emoji, vname: v.name, aemoji: team.emoji, aname: team.name }));
        get().emitVfx?.('reflect', ti);
        continue;
      }
      // Bannissement (L10) : renvoie à la dernière jonction ; sinon recul classique.
      const fromPos = v.pos;
      const rr = moveBack(board, v.pos, amt);
      newTeams[ti] = { ...v, pos: rr.finalPos };
      if (rr.path.length > 1) moves.push({ teamIndex: ti, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
      // Opportuniste (L3+) : si le trajet de recul passe par MA case, j'avance.
      if (effect.opportuniste && rr.path.includes(team.pos)) opportunisteAdvance += resolveAmount(effect.opportuniste, team);
      // Réaction en chaîne (voie) : toute équipe (≠ moi, ≠ cible) sur le trajet recule aussi.
      if (effect.reaction && effect.chainRecul) {
        const chainAmt = resolveAmount(effect.chainRecul, v) + (effect.chainFlat || 0);
        for (const oi of opponents) {
          if (oi === ti || targets.has(oi)) continue;
          if (rr.path.includes(newTeams[oi].pos)) chainHits.push({ ti: oi, amt: chainAmt });
        }
      }
      // Pose-piège (voie) : pose des pièges (effet = recul du niveau courant de Foudre).
      if (effect.poseTrap && effect.poseTrapCount) {
        foudreBoard = foudreBoard || { ...board };
        const spots = [fromPos, ...rr.path.slice(1)];
        let placed = 0;
        for (const node of spots) {
          if (placed >= effect.poseTrapCount) break;
          if (foudreBoard[node] && !foudreBoard[node].trap && node !== 'depart' && board[node].type !== 'arrivee') {
            foudreBoard[node] = { ...foudreBoard[node], trap: { label: 'Foudre', icon: '⚡', ownerTeam: currentTeam, do: [{ action: 'move', target: 'self', dir: 'back', n: baseRoll }] } };
            placed++;
          }
        }
      }
    }
    // Reculs en chaîne (une seule passe, pas de cascade ; attaquant immunisé).
    for (const { ti, amt } of chainHits) {
      if (offBlocked(ti)) continue;
      const v = newTeams[ti];
      const a = reducedRecul(v, amt);
      if (a <= 0) continue;
      const rr = moveBack(board, v.pos, a);
      newTeams[ti] = { ...v, pos: rr.finalPos };
      if (rr.path.length > 1) moves.push({ teamIndex: ti, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
      hitSet.add(ti);
    }
    // Orage persistant (ultime) : DoT sur les cibles touchées (non cumulable → rafraîchit).
    if (effect.orageTurns) {
      for (const ti of hitSet) newTeams[ti] = { ...newTeams[ti], orageRecul: { turns: effect.orageTurns, die: effect.orageDie || 'd4' } };
    }
    // Opportuniste : j'avance du total accumulé.
    if (opportunisteAdvance > 0) {
      const rr = moveForward(board, newTeams[currentTeam].pos, opportunisteAdvance);
      newTeams[currentTeam] = { ...newTeams[currentTeam], pos: rr.finalPos };
      if (rr.path.length > 1) moves.push({ teamIndex: currentTeam, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'forward' });
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
    const sablierName = locName(POWERS[powerKey]);
    // Auto-ciblage (L4) : se cibler soi-même MULTIPLIE le timer (gain de temps).
    // Implémenté comme un crédit de temps (≈ ×divisor) sur sa prochaine question,
    // via le canal `timeCredit` déjà consommé par askQuestion.
    if (effect.autoTarget && targetTeamIndex === currentTeam) {
      const bonus = Math.max(0, Math.round(30 * (divisor - 1)));
      newTeams[currentTeam] = { ...newTeams[currentTeam], timeCredit: (newTeams[currentTeam].timeCredit || 0) + bonus };
      get().emitPowerFx?.('sablierSelf', currentTeam, { color: '#2f9d5a' });
      soundSablierBoost();
      addLog(tg('log.pw.sablierSelf', { emoji: team.emoji, name: team.name, power: sablierName, n: bonus }));
      announce(set, get, '⏳', tg('log.pw.sablierSelfToast', { n: bonus }), POWERS[powerKey].color);
    } else {
      // Sablier brisé (ultime) a SON bouton dédié (useSablierBroken) — le cast
      // normal ne le déclenche plus automatiquement.
      const sablierOpp = newTeams.map((_, i) => i).filter((i) => i !== currentTeam);
      // Tempête de sable (L10) : toutes les autres ; sinon la cible choisie.
      const sablierTargets = effect.allOthers ? new Set(sablierOpp) : new Set([targetTeamIndex]);
      let removedTime = 0;
      for (const ti of sablierTargets) {
        if (offBlocked(ti)) continue; // immunité / fumigène (par cible)
        hitSet.add(ti);
        get().emitPowerFx?.('sablier', ti, { color: POWERS[powerKey].color });
        removedTime += Math.max(0, Math.round(30 - 30 / divisor));
        newTeams[ti] = {
          ...newTeams[ti],
          sablierActif: true, sablierDivisor: divisor,
          ...(effect.modeleur ? { modeleurInterval: effect.modeleurInterval || 4 } : {}),
          ...(effect.larcin ? { larcinBy: currentTeam, larcinChance: effect.larcinChance || 0 } : {}),
        };
      }
      // Voleur de sable (voie) : banque du temps retiré × facteur → prochaine question.
      if (effect.sandBank && effect.sandBankFactor) {
        const credit = Math.round(removedTime * effect.sandBankFactor);
        if (credit > 0) newTeams[currentTeam] = { ...newTeams[currentTeam], timeCredit: (newTeams[currentTeam].timeCredit || 0) + credit };
      }
      const nS = sablierTargets.size;
      if (hitSet.size > 0) soundSablier(); else soundPower();
      const extrasS = `${effect.larcin ? tg('log.pw.sablierLarcin') : ''}${effect.modeleur ? tg('log.pw.sablierModeleur') : ''}`;
      addLog(nS > 1
        ? tg('log.pw.sablierUseMany', { emoji: team.emoji, name: team.name, power: sablierName, level, nS, divisor, extras: extrasS })
        : tg('log.pw.sablierUseOne', { emoji: team.emoji, name: team.name, power: sablierName, level, vemoji: target.emoji, vname: target.name, divisor, extras: extrasS }));
      announce(set, get, '⏱️', nS > 1
        ? tg('log.pw.sablierToastMany', { power: sablierName, divisor, nS })
        : tg('log.pw.sablierToastOne', { power: sablierName, divisor, vemoji: target.emoji, vname: target.name }), POWERS[powerKey].color);
    }
  } else if (powerKey === 'double') {
    const doubleName = locName(POWERS[powerKey]);
    // Cible tout le monde (ultime) : tous les adversaires ; sinon la cible choisie.
    const dblOpp = newTeams.map((_, i) => i).filter((i) => i !== currentTeam);
    const dblTargets = effect.allOthers ? new Set(dblOpp) : new Set([targetTeamIndex]);
    // Questions garanties + Surcharge (ultime, PERMANENT : +N à chaque Double) +
    // chance d'imposer UNE question de plus (tirée au lancer).
    let add = (effect.add ?? 1) + (effect.surchargePermanent || 0);
    if (effect.bonusChance && Math.random() < effect.bonusChance) add += 1;
    let nAffected = 0;
    for (const ti of dblTargets) {
      if (offBlocked(ti)) continue; // immunité / fumigène (par cible)
      hitSet.add(ti); nAffected++;
      get().emitPowerFx?.('double', ti, { color: POWERS[powerKey].color });
      const tt = newTeams[ti];
      // Cumulable : on AJOUTE des questions extra (plafonné), sans écraser un cast précédent.
      const newExtra = Math.min((tt.doubleExtra || 0) + add, MAX_DOUBLE_EXTRA);
      newTeams[ti] = {
        ...tt, doubleActive: true, doubleExtra: newExtra,
        doubleNoBonus: !!effect.noBonus || !!tt.doubleNoBonus, // collant
        // Temps commun (voie) : un seul chrono pour la rafale, raccourci de `cut` s.
        ...(effect.sharedTimer ? { doubleSharedTimer: true, doubleSharedCut: effect.sharedTimerCut || 0 } : {}),
        // Questions corsées (voie) : chance que chaque question imposée soit Hardcore.
        ...(effect.corsees && effect.hardcoreChance ? { doubleHCChance: effect.hardcoreChance } : {}),
        // Saboteur (voie) : pénalité en cas d'erreur (niveau 1/2/3).
        ...(effect.saboteur && effect.saboteurLevel ? { doubleSaboteur: effect.saboteurLevel } : {}),
        // Report (ultime) : sur erreur, les questions restantes vont au prochain tour.
        ...(effect.report ? { doubleReport: true } : {}),
      };
    }
    if (hitSet.size > 0) soundDouble(); else soundPower();
    const doubleTotal = 1 + Math.min((target.doubleExtra || 0) + add, MAX_DOUBLE_EXTRA);
    const noBonusNow = !!effect.noBonus;
    const extras = `${effect.corsees ? tg('log.pw.doubleCorsees') : ''}${effect.saboteur ? tg('log.pw.doubleSaboteur') : ''}${effect.sharedTimer ? tg('log.pw.doubleShared') : ''}${effect.report ? tg('log.pw.doubleReport') : ''}`;
    addLog(tgPlural('log.pw.doubleUse', add, { emoji: team.emoji, name: team.name, power: doubleName, level, vemoji: nAffected > 1 ? '' : target.emoji, vname: nAffected > 1 ? tg('log.pw.doubleAll', { n: nAffected }) : target.name, add, total: doubleTotal, noBonus: noBonusNow ? tg('log.pw.doubleNoBonus') : '', timer: extras }));
    announce(set, get, '❓', tgPlural('log.pw.doubleToast', doubleTotal, { power: doubleName, vemoji: nAffected > 1 ? '' : target.emoji, vname: nAffected > 1 ? tg('log.pw.doubleAll', { n: nAffected }) : target.name, total: doubleTotal }), POWERS[powerKey].color);
  }

  // Trahison de pacte : si l'attaquant avait promis d'épargner une cible touchée,
  // le pacte est rompu publiquement (cérémonie + pénalité). MUTE newTeams.
  resolveBetrayals(set, get, newTeams, currentTeam, hitSet);

  set({ teams: newTeams, showTargetPicker: null, ...(foudreMove ? { movePath: foudreMove } : {}), ...(foudreBoard ? { board: foudreBoard } : {}) });
  if (lightning) get().emitVfx('lightning', targetTeamIndex);
  // Stay in pendingLanding so player can use more powers before clicking "Continuer"
}

// Détecte et punit une TRAHISON : l'attaquant `attackerIdx` a touché des cibles
// (`hitSet`) qu'il avait promis de ne pas attaquer. Promesse brisable → l'attaque
// a déjà eu lieu ; ici on rompt le(s) pacte(s) au grand jour. Mute `newTeams`.
function resolveBetrayals(set, get, newTeams, attackerIdx, hitSet) {
  const attacker = newTeams[attackerIdx];
  if (!attacker?.promises?.length || !hitSet?.size) return;
  const betrayed = [...hitSet].filter((ti) => hasActivePromise(attacker, ti));
  if (!betrayed.length) return;
  const { addLog } = get();

  // Le traître paie une pénalité et perd sa série. Les pactes rompus sont dissous
  // dans LES DEUX SENS (la victime n'est plus tenue non plus).
  let a = { ...attacker };
  for (const ti of betrayed) {
    a.promises = withoutPromise(a.promises, ti);
    const v = newTeams[ti];
    if (v?.promises?.length) newTeams[ti] = { ...v, promises: withoutPromise(v.promises, attackerIdx) };
  }
  a.money = Math.max(0, (a.money || 0) - PACT_BETRAY_PENALTY);
  a.streak = 0;
  newTeams[attackerIdx] = a;

  // Cérémonie PUBLIQUE : le complot éclate au grand jour sur le TBI.
  soundThunder();
  for (const ti of betrayed) {
    const v = newTeams[ti];
    addLog(tg('log.store.betray', { emoji: attacker.emoji, name: attacker.name, vemoji: v.emoji, vname: v.name, penalty: PACT_BETRAY_PENALTY }));
  }
  const first = newTeams[betrayed[0]];
  announce(set, get, '🐍', tg('log.store.betrayToast', { emoji: attacker.emoji, name: attacker.name, vemoji: first.emoji, vname: first.name }), '#7a1f1f');
}

export function cancelTargetPicker(set, get) {
  // NB : l'annulation d'un sélecteur issu du MOTEUR (source 'engine') est traitée
  // en amont par le store (remboursement d'un consommable + abandon de la file).
  // Ici on ne gère que les pouvoirs (rien n'est consommé tant qu'on n'a pas ciblé).
  set({ showTargetPicker: null });
  // Stay in pendingLanding — player can use other powers or click "Continuer"
}

// --- Charge picker (gainCharge : consommable / équipement) ---

export function chargePickerChoice(set, get, powerKey) {
  const { teams, currentTeam, addLog } = get();
  // Source : 'item' (consommable legacy) ou 'engine' (moteur d'effets / équipement)
  const source = get().showChargePicker?.source;
  // `amount` (Recharge de Forge) : 1 / 2 / 'full' ; défaut 1 (recharge classique).
  const amount = get().showChargePicker?.amount ?? 1;
  const team = teams[currentTeam];
  const currentCharges = team.powers?.[powerKey]?.charges ?? 0;
  const next = amount === 'full' ? MAX_CHARGES : Math.min(MAX_CHARGES, currentCharges + (Number(amount) || 1));
  const gained = next - currentCharges;
  const newTeams = [...teams];
  newTeams[currentTeam] = { ...team, powers: { ...team.powers, [powerKey]: { ...team.powers[powerKey], charges: next } } };
  const pName = locName(POWERS[powerKey]) || powerKey;
  // Pouvoir déjà plein → charge perdue, feedback « aucun effet » (spec §6.1).
  if (gained <= 0) {
    addLog(tg('log.fx.chargeNoEffect'));
  } else {
    addLog(gained === 1
      ? tg('log.pw.gainCharge', { emoji: team.emoji, name: team.name, power: pName })
      : tg('log.pw.gainChargeN', { emoji: team.emoji, name: team.name, n: gained, power: pName }));
    soundCharge();
  }
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
