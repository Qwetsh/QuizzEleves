import { getEffectValue, reducedSteal, reducedRecul, isItemStealImmune } from '../logic/itemEffects.js';
import { moveBack } from '../logic/pathfinding.js';
import { applyRecul } from '../logic/turnHelpers.js';
import { extOn } from '../extensions/registry.js';
import { ITEMS } from '../data/items.js';
import { EVENTS } from '../data/events.js';
import { pickLootItem, placeItem, normalizeBag, cellKey, cellN, mkCell } from './itemHandlers.js';
import { equipTriggerActions, runEffects } from './effectEngine.js';
import { LOOT } from '../logic/balanceConfig.js';
import { saveGame } from './persistence.js';
import { tg, tgPlural } from '../i18n';
import { locName } from '../i18n/content';
import { pickQuestion } from '../logic/questionPicker.js';
import { raceOutcomeOnAnswer, otherSide } from '../logic/duelRace.js';
import { curioUniverses, silhouetteKey, memoryPairs, pkmnDuelFor } from '../components/Fight/minigames/index.js';
import { startCurioDuel } from './curioFightHandlers.js';
import { startMemoryDuel } from './memoryFightHandlers.js';
import { startPkmnDuel } from './pokemonFightHandlers.js';

// « Duel éclair » (mode en ligne) : durée d'une question de course, en secondes.
export const RACE_DURATION = 20;

// Duel silhouette (« Qui est ce Pokémon ?! ») : durée d'affichage de la
// révélation (image en couleur + « C'est … ! ») avant la silhouette suivante.
export const WTP_REVEAL_MS = 2600;

// Transfere un objet vers une equipe (cascade unique placeItem) et formate
// la note de butin. Retourne { team: updatedTeam, note: string }.
function receiveItem(team, itemKey) {
  const r = placeItem(team, itemKey);
  const note = r.outcome === 'equipped'
    ? tg('log.ft.note.equipped')
    : r.outcome === 'refunded'
      ? tg('log.ft.note.refunded', { refund: r.refund })
      : '';
  return { team: r.team, note };
}

// Nombre de manches gagnees pour remporter le combat (BO3)
export const FIGHT_ROUNDS_TO_WIN = 2;

/**
 * Demarre un combat : l'equipe active vient d'atterrir sur la case
 * d'une autre equipe. Remplace l'action normale de la case.
 */
export function startFight(set, get, defenderIndex, subject) {
  const { teams, currentTeam, addLog } = get();
  const att = teams[currentTeam];
  const def = teams[defenderIndex];
  addLog(tg('log.ft.challenge', { att: `${att.emoji} ${att.name}`, def: `${def.emoji} ${def.name}` }));
  set({
    showFight: {
      attackerIndex: currentTeam,
      defenderIndex,
      subject,
      phase: 'versus',          // versus -> briefing -> minigame -> reward -> result
      round: 1,
      wins: { attacker: 0, defender: 0 },
      winnerSide: null,
      reward: null,             // { choice, dice, rolling }
      resultMessage: null,
    },
  });
}

// Adversaire « Boss » : le professeur. Non-équipe (defenderIndex = -1), joué par
// le prof sur le côté droit du mini-jeu. Issue FIXE (pas de choix de récompense).
export const BOSS_PROF = { emoji: '👨‍🏫', name: 'Le Prof', color: '#8a1f2e', powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], money: 0 };

/**
 * Démarre un COMBAT DE BOSS : l'équipe active affronte le Prof sur le mini-jeu
 * choisi (déterminé par `subject`). Victoire = +50 or + 1 objet ; défaite = recul 1D10.
 */
export function startBossFight(set, get, subject) {
  const { currentTeam, teams, addLog } = get();
  const att = teams[currentTeam];
  addLog(tg('log.ft.bossChallenge', { att: `${att.emoji} ${att.name}` }));
  set({
    showFight: {
      attackerIndex: currentTeam,
      defenderIndex: -1,
      boss: BOSS_PROF,
      bossFight: true,
      subject,
      phase: 'versus',
      round: 1,
      wins: { attacker: 0, defender: 0 },
      winnerSide: null,
      reward: null,
      resultMessage: null,
    },
  });
}

// Issue d'un combat de boss (pas de choix de récompense) : applique le gain ou
// la pénalité à l'équipe puis passe en phase résultat.
function resolveBossOutcome(set, get, f) {
  const { teams, board, addLog } = get();
  const idx = f.attackerIndex;
  const team = teams[idx];
  const newTeams = [...teams];
  let message; let moves = null;
  // Valeurs éditables du Boss (EVENT_PARAMS_SCHEMA.bossProf) — fallback = défaut codé.
  const P = EVENTS.bossProf?.params || {};

  if (f.winnerSide === 'attacker') {
    const gold = P.rewardGold ?? 50;
    let placed = { ...team, money: (team.money || 0) + gold };
    const lootKey = pickLootItem(LOOT.fightLegendaryChance, get().lootableItems());
    let note = '';
    if (lootKey) { const r = receiveItem(placed, lootKey); placed = r.team; note = r.note; }
    newTeams[idx] = placed;
    const loot = lootKey ? tg('log.ft.bossWin.loot', { icon: ITEMS[lootKey].icon, item: locName(ITEMS[lootKey]), note }) : '';
    message = tg('log.ft.bossWin', { team: `${team.emoji} ${team.name}`, gold, loot });
  } else {
    const dv = Math.floor(Math.random() * (P.defeatDie ?? 10)) + 1;
    const rec = applyRecul(team, board, dv, extOn(get().extensions, 'mastery')); // bouclier + équipement protègent du recul
    newTeams[idx] = { ...team, ...rec.patch };
    if (rec.path) moves = [{ teamIndex: idx, waypoints: rec.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: rec.forward ? 'forward' : 'back' }];
    message = rec.forward
      ? tg('log.turn.fortressAdvance', { team: `${team.emoji} ${team.name}`, cases: rec.advance })
      : rec.applied > 0
        ? tg('log.ft.bossLose', { team: `${team.emoji} ${team.name}`, n: rec.applied, s: rec.applied > 1 ? 's' : '', reduced: rec.absorbedBy ? tg('log.ft.reduced') : '' })
        : tg('log.ft.bossLose.absorbed', { team: `${team.emoji} ${team.name}` });
  }
  addLog(message);
  set({ teams: newTeams, showFight: { ...f, phase: 'result', resultMessage: message }, ...(moves ? { movePath: moves } : {}) });
}

// Fin de l'ecran versus -> ecran d'explication (briefing) du mini-jeu.
// En ligne : pas de mini-jeu TBI → on lance directement le « duel éclair »
// (course à la question, jouée sur l'écran de chaque duelliste).
// Mode SOLO (équipes bots) : même route — les mini-jeux TBI se jouent à deux
// joueurs physiques, un bot ne peut pas y toucher ; la course, si (il « répond »
// via le driver, et le timeout du boss est déjà géré par serveRaceQuestion).
export function fightBegin(set, get) {
  const f = get().showFight;
  if (!f || f.phase !== 'versus') return;
  const soloBots = (get().teams || []).some((t) => t?.isBot);
  // Duel Curioscope (guessr) piloté par le STORE sur les surfaces distantes :
  // en ligne, et « écran + téléphones » (le pin se place sur le téléphone).
  // Bots exclus (ils ne devinent pas) et boss exclu (adversaire virtuel) →
  // duel éclair. La surface tactile garde le moteur composant (FightModal).
  if (!soloBots && !f.bossFight && (get().connectionMode === 'online' || get().phoneController)) {
    const universes = curioUniverses(f.subject);
    if (universes) { startCurioDuel(set, get, universes); return; }
    // Duel silhouette (« Qui est ce Pokémon ?! ») : le plateau TV s'affiche sur
    // l'écran partagé, les duellistes répondent sur leur appareil — une course
    // à la question d'IMAGE avec temps de révélation (flag `wtp` = clé du pool).
    const wtpKey = silhouetteKey(f.subject);
    if (wtpKey) {
      set({ showFight: { ...f, wtp: wtpKey } });
      serveRaceQuestion(set, get);
      return;
    }
    // Duel Memory (paires) piloté par le store — surface « écran + téléphones »
    // UNIQUEMENT : plateau TV en lecture seule sur l'écran partagé, retournements
    // depuis le téléphone du camp actif. En ligne, pas de plateau partagé → repli
    // duel éclair (ci-dessous). Le plateau reste un jeu tour-par-tour à autorité
    // hôte (minuteries de retournement dans memoryFightHandlers).
    if (get().phoneController) {
      const pairs = memoryPairs(f.subject);
      if (pairs) { startMemoryDuel(set, get, pairs); return; }
      // Combat Pokémon piloté par le store — surface « écran + téléphones »
      // UNIQUEMENT : la TV n'affiche que la scène (PkmnDuelStage), chaque
      // duelliste drafte et choisit ses actions sur sa « Game Boy » (téléphone).
      // En ligne : repli duel éclair (pas encore porté).
      if (pkmnDuelFor(f.subject)) { startPkmnDuel(set, get); return; }
    }
  }
  if (get().connectionMode === 'online' || soloBots) { serveRaceQuestion(set, get); return; }
  set({ showFight: { ...f, phase: 'briefing' } });
}

// --- Duel éclair (mode en ligne) : course à la question ---
// Sert une question (même thème que le duel) aux deux duellistes. Le PREMIER à
// répondre juste gagne la manche (best-of-3 via fightRoundWin). Le secret (bonne
// réponse) reste sur l'hôte (stripé à la diffusion — cf. onlineSnapshot / payload).
export function serveRaceQuestion(set, get) {
  const f = get().showFight;
  if (!f) return;
  const subject = f.subject;
  // Duel silhouette : questions à IMAGE du pool dédié (fightPickImageQuestion
  // gère son propre anti-répétition, namespace `img:`) ; sinon course normale.
  let question = null;
  if (f.wtp) {
    question = get().fightPickImageQuestion(f.wtp);
  } else {
    const { questions, askedQuestions } = get();
    const pool = questions[subject] || [];
    const asked = askedQuestions[subject] || new Set();
    const result = pickQuestion(pool, asked);
    if (result) {
      question = result.question;
      set({ askedQuestions: { ...askedQuestions, [subject]: result.newAsked } });
    }
  }
  if (!question) { // plus de question dispo → anti-blocage : l'attaquant marque la manche
    fightRoundWin(set, get, 'attacker');
    const nf = get().showFight;
    if (nf && nf.phase === 'minigame' && !nf.winnerSide) serveRaceQuestion(set, get);
    return;
  }
  const deadline = Date.now() + RACE_DURATION * 1000;
  set({
    showFight: { ...get().showFight, phase: 'minigame', race: { q: question, answers: {}, deadline } },
  });
  // Personne n'a répondu juste dans le temps imparti : boss → le Prof marque ;
  // silhouette → révélation sans vainqueur ; sinon → nouvelle question.
  setTimeout(() => {
    const cur = get().showFight;
    if (!cur || cur.phase !== 'minigame' || !cur.race || cur.race.deadline !== deadline) return;
    if (cur.bossFight) {
      fightRoundWin(set, get, 'defender');
      const nf = get().showFight;
      if (nf && nf.phase === 'minigame' && !nf.winnerSide) serveRaceQuestion(set, get);
    } else if (cur.wtp) {
      wtpReveal(set, get, null);
    } else {
      serveRaceQuestion(set, get);
    }
  }, RACE_DURATION * 1000);
}

// Révélation du duel silhouette : fige la manche (deadline coupée → le timeout
// en vol s'annule), publie la bonne réponse (ANTI-TRICHE : `c` ne part vers les
// appareils qu'à cet instant, via le payload), laisse « C'est … ! » à l'écran,
// puis marque la manche (ou resert si personne n'a trouvé).
function wtpReveal(set, get, winnerSide) {
  const f = get().showFight;
  if (!f?.race || f.race.reveal) return;
  set({ showFight: { ...f, race: { ...f.race, deadline: null, reveal: { c: f.race.q.c, winner: winnerSide } } } });
  setTimeout(() => {
    const cur = get().showFight;
    if (!cur || cur.phase !== 'minigame' || !cur.race?.reveal) return;
    if (winnerSide) {
      fightRoundWin(set, get, winnerSide);
      const nf = get().showFight;
      if (nf && nf.phase === 'minigame' && !nf.winnerSide) serveRaceQuestion(set, get);
    } else {
      serveRaceQuestion(set, get);
    }
  }, WTP_REVEAL_MS);
}

// Un duelliste répond (attaquant OU défenseur). Premier juste = manche gagnée ;
// deux faux = nouvelle question.
export function submitFightAnswer(set, get, teamIdx, index) {
  const f = get().showFight;
  if (!f || f.phase !== 'minigame' || !f.race) return;
  if (f.race.reveal) return; // révélation en cours : la manche est figée
  const side = teamIdx === f.attackerIndex ? 'attacker' : teamIdx === f.defenderIndex ? 'defender' : null;
  if (!side) return;
  const race = f.race;
  if (race.answers[side]) return; // déjà répondu à cette question
  const otherAnswered = !!race.answers[otherSide(side)];
  const answers = { ...race.answers, [side]: { index, at: Date.now() } };
  set({ showFight: { ...f, race: { ...race, answers } } });
  const outcome = raceOutcomeOnAnswer({ index, correctIndex: race.q.c, otherAnswered });
  // Duel silhouette : temps de révélation (« C'est … ! ») avant de marquer la
  // manche ou de resservir — au lieu de l'enchaînement sec de la course.
  if (f.wtp) {
    if (outcome === 'win') wtpReveal(set, get, side);
    else if (outcome === 'replay') wtpReveal(set, get, null);
    return; // 'wait' : on attend l'autre camp
  }
  if (outcome === 'win') {
    fightRoundWin(set, get, side);
    const nf = get().showFight;
    if (nf && nf.phase === 'minigame' && !nf.winnerSide) serveRaceQuestion(set, get);
  } else if (outcome === 'replay') {
    serveRaceQuestion(set, get);
  }
  // 'wait' : on attend la réponse de l'autre camp
}

// Les deux equipes ont confirme « Je suis pret » -> lancement du mini-jeu
export function fightStart(set, get) {
  const f = get().showFight;
  if (!f || f.phase !== 'briefing') return;
  set({ showFight: { ...f, phase: 'minigame' } });
}

// Un mini-jeu signale le gagnant d'une manche
export function fightRoundWin(set, get, side) {
  const f = get().showFight;
  if (!f || f.phase !== 'minigame') return;
  const wins = { ...f.wins, [side]: f.wins[side] + 1 };
  const { teams, addLog } = get();
  const teamIdx = side === 'attacker' ? f.attackerIndex : f.defenderIndex;
  const t = teams[teamIdx] || f.boss; // côté boss : non-équipe
  addLog(tg('log.ft.round', { round: f.round, team: `${t.emoji} ${t.name}` }));

  if (wins[side] >= FIGHT_ROUNDS_TO_WIN) {
    addLog(tg('log.ft.duelWin', { team: `${t.emoji} ${t.name}` }));
    if (f.bossFight) { resolveBossOutcome(set, get, { ...f, wins, winnerSide: side }); return; }
    set({ showFight: { ...f, wins, winnerSide: side, phase: 'reward' } });
  } else {
    set({ showFight: { ...f, wins, round: f.round + 1 } });
  }
}

/**
 * Victoire directe du combat, annoncee par un mini-jeu a score cumulatif
 * (ex. Tour du monde : premier a 25 000 points) — sans passer par les manches.
 */
export function fightMatchWin(set, get, side) {
  const f = get().showFight;
  if (!f || f.phase !== 'minigame') return;
  const { teams, addLog } = get();
  const idx = side === 'attacker' ? f.attackerIndex : f.defenderIndex;
  const winner = teams[idx] || f.boss;
  addLog(tg('log.ft.duelWin', { team: `${winner.emoji} ${winner.name}` }));
  if (f.bossFight) { resolveBossOutcome(set, get, { ...f, wins: { ...f.wins, [side]: FIGHT_ROUNDS_TO_WIN }, winnerSide: side }); return; }
  set({ showFight: { ...f, wins: { ...f.wins, [side]: FIGHT_ROUNDS_TO_WIN }, winnerSide: side, phase: 'reward' } });
}

/**
 * Le vainqueur choisit sa recompense :
 * - 'steal'     : lance 2 des, vole autant de pieces au perdant
 * - 'knockback' : lance 1 de, le perdant recule d'autant
 * - 'loot'      : vole un objet au hasard au perdant (ou fouille le champ
 *                 de bataille si le perdant n'a rien)
 */
export function fightChooseReward(set, get, choice) {
  const f = get().showFight;
  if (!f || f.phase !== 'reward' || f.reward) return;

  // Le butin d'objet ne lance pas de des : application directe
  if (choice === 'loot') {
    set({ showFight: { ...f, reward: { choice, dice: [], rolling: false } } });
    setTimeout(() => applyFightReward(set, get), 500);
    return;
  }

  const diceCount = choice === 'steal' ? 2 : 1;
  const finals = Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6));
  set({ showFight: { ...f, reward: { choice, dice: finals.map(() => 1), rolling: true } } });

  let count = 0;
  const interval = setInterval(() => {
    const cur = get().showFight;
    if (!cur || !cur.reward) { clearInterval(interval); return; }
    set({ showFight: { ...cur, reward: { ...cur.reward, dice: finals.map(() => 1 + Math.floor(Math.random() * 6)) } } });
    if (++count >= 10) {
      clearInterval(interval);
      const done = get().showFight;
      if (!done || !done.reward) return;
      set({ showFight: { ...done, reward: { ...done.reward, dice: finals, rolling: false } } });
      setTimeout(() => applyFightReward(set, get), 900);
    }
  }, 80);
}

function applyFightReward(set, get) {
  const f = get().showFight;
  if (!f || !f.reward || f.phase !== 'reward') return;
  const { teams, board, addLog } = get();
  const winnerIdx = f.winnerSide === 'attacker' ? f.attackerIndex : f.defenderIndex;
  const loserIdx = f.winnerSide === 'attacker' ? f.defenderIndex : f.attackerIndex;
  const winner = teams[winnerIdx];
  const loser = teams[loserIdx];
  const newTeams = [...teams];
  let message;
  let moves = null;

  if (f.reward.choice === 'loot') {
    // Pioche un objet au hasard chez le perdant : equipement ou sac
    // Filtre sur ITEMS : ignore les clés périmées d'anciennes sauvegardes.
    // Immunité au vol d'objet : pool vide → le vainqueur fouille le champ (le
    // perdant garde ses objets).
    const pool = isItemStealImmune(loser) ? [] : [
      ...Object.entries(loser.equipment || {}).filter(([, k]) => ITEMS[cellKey(k)]).map(([slot, k]) => ({ kind: 'equipment', slot, key: cellKey(k) })),
      ...(loser.bag || []).map((c, i) => ({ kind: 'bag', index: i, key: cellKey(c) })).filter((e) => e.key && ITEMS[e.key]),
    ];

    if (pool.length === 0) {
      // Le perdant n'a rien : on fouille le champ de bataille
      const foundKey = pickLootItem(LOOT.fightLegendaryChance, get().lootableItems());
      if (!foundKey) {
        // Aucun objet active dans la partie : lot de consolation en pieces
        newTeams[winnerIdx] = { ...winner, money: winner.money + 10 };
        message = tg('log.ft.loot.none', { loser: `${loser.emoji} ${loser.name}`, winner: `${winner.emoji} ${winner.name}` });
      } else {
        const item = ITEMS[foundKey];
        const r = receiveItem(winner, foundKey);
        newTeams[winnerIdx] = r.team;
        message = tg('log.ft.loot.found', { loser: `${loser.emoji} ${loser.name}`, winner: `${winner.emoji} ${winner.name}`, icon: item.icon, item: locName(item), note: r.note });
      }
    } else {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const item = ITEMS[picked.key];
      if (picked.kind === 'equipment') {
        newTeams[loserIdx] = { ...loser, equipment: { ...loser.equipment, [picked.slot]: null } };
      } else {
        // Vole UNE unité de la pile (la case se libère à 0).
        const loserBag = normalizeBag(loser.bag);
        const cell = loserBag[picked.index];
        loserBag[picked.index] = cellN(cell) > 1 ? mkCell(cellKey(cell), cellN(cell) - 1) : null;
        newTeams[loserIdx] = { ...loser, bag: loserBag };
      }
      const r = receiveItem(winner, picked.key);
      newTeams[winnerIdx] = r.team;
      message = tg('log.ft.loot.steal', { winner: `${winner.emoji} ${winner.name}`, icon: item.icon, item: locName(item), loser: `${loser.emoji} ${loser.name}`, note: r.note });
    }
  } else if (f.reward.choice === 'steal') {
    // Equipement du vainqueur (fightStealBonus) puis protection du perdant (stealProtection)
    const total = f.reward.dice[0] + f.reward.dice[1] + getEffectValue(winner, 'fightStealBonus');
    const purse = loser.money ?? 0;
    const stolen = reducedSteal(loser, Math.min(total, purse));
    newTeams[winnerIdx] = { ...winner, money: winner.money + stolen };
    newTeams[loserIdx] = { ...loser, money: loser.money - stolen };
    // Feedback fidèle : bourse vidée (vol partiel), bourse vide, ou vraie protection.
    message = stolen > 0
      ? (total > purse && stolen === purse
          ? tgPlural('log.ft.steal.goldAll', stolen, { winner: `${winner.emoji} ${winner.name}`, loser: `${loser.emoji} ${loser.name}`, want: total })
          : tgPlural('log.ft.steal.gold', stolen, { winner: `${winner.emoji} ${winner.name}`, loser: `${loser.emoji} ${loser.name}` }))
      : (purse <= 0
          ? tg('log.ft.steal.empty', { loser: `${loser.emoji} ${loser.name}` })
          : tg('log.ft.steal.protected', { loser: `${loser.emoji} ${loser.name}` }));
  } else if ((loser.totalImmuneTurns ?? 0) > 0) {
    // Immunité totale (Bouclier L10) : le perdant ne subit aucun recul de duel.
    message = tg('log.ft.immune', { loser: `${loser.emoji} ${loser.name}` });
  } else {
    // Bouclier (bois + pouvoir) puis équipement du perdant : recul atténué.
    const rec = applyRecul(loser, board, f.reward.dice[0], extOn(get().extensions, 'mastery'));
    newTeams[loserIdx] = { ...loser, ...rec.patch };
    if (rec.path) {
      moves = [{ teamIndex: loserIdx, waypoints: rec.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: rec.forward ? 'forward' : 'back' }];
    }
    message = rec.forward
      ? tg('log.turn.fortressAdvance', { team: `${loser.emoji} ${loser.name}`, cases: rec.advance })
      : rec.applied > 0
        ? tgPlural('log.ft.knockback', rec.applied, { loser: `${loser.emoji} ${loser.name}`, reduced: rec.absorbedBy ? tg('log.ft.reduced') : '' })
        : (rec.absorbedBy === 'equip'
            ? tg('log.ft.knockback.equip', { loser: `${loser.emoji} ${loser.name}` })
            : tg('log.ft.knockback.shield', { loser: `${loser.emoji} ${loser.name}` }));
  }

  addLog(message);
  set({
    teams: newTeams,
    showFight: { ...f, phase: 'result', resultMessage: message },
    ...(moves ? { movePath: moves } : {}),
  });
}

export function closeFight(set, get) {
  const f = get().showFight;
  set({ showFight: null });

  // Déclencheurs d'équipement de duel : on:fightWin (gagnant) puis on:fightLose
  // (perdant). Chaque camp a son propre sourceTeam (≠ équipe courante), d'où
  // deux passes chaînées — la 2e (et la fin de tour) sont différées si un effet
  // ouvre un sélecteur (deferredTurnEnd, comme answerQuestion).
  let winnerIdx = -1, loserIdx = -1;
  if (f && f.winnerSide) {
    winnerIdx = f.winnerSide === 'attacker' ? f.attackerIndex : f.defenderIndex;
    loserIdx = f.winnerSide === 'attacker' ? f.defenderIndex : f.attackerIndex;
  }
  const teams = get().teams;
  const winActs = winnerIdx >= 0 ? equipTriggerActions(teams[winnerIdx], 'fightWin') : [];
  const loseActs = loserIdx >= 0 ? equipTriggerActions(teams[loserIdx], 'fightLose') : [];

  const endTurn = () => { if (!get().finished) { get().nextTurn(); if (get().phase === 'game') saveGame(get()); } };
  const runLose = () => {
    if (!loseActs.length) return endTurn();
    runEffects(set, get, loseActs, { source: 'item', sourceTeam: loserIdx });
    if (get().pendingActions) set({ deferredTurnEnd: endTurn }); else endTurn();
  };
  if (!winActs.length) return runLose();
  runEffects(set, get, winActs, { source: 'item', sourceTeam: winnerIdx });
  if (get().pendingActions) set({ deferredTurnEnd: runLose }); else runLose();
}
