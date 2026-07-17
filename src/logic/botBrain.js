// ============================================================
//  CERVEAU des bots (mode SOLO) — 100 % PUR : état du store → décision.
//
//  Aucun timer, aucun accès au store, aucun effet de bord : ce module ne fait
//  que LIRE un état et proposer une action { action, args, delayMs }. C'est
//  botDriver.js qui observe le store, planifie les délais « humains » et
//  exécute l'action. Séparation voulue : le « quoi » se teste ici ligne à
//  ligne sans fake timers, le « quand » se teste dans le driver.
//
//  Contrat : `pendingDecision(state)` renvoie null quand AUCUN bot n'a de
//  décision en attente, sinon :
//    {
//      sig,       — signature UNIQUE de l'instance de décision (idempotence :
//                   le driver ne re-planifie pas tant que la signature ne
//                   change pas, et jette un tir dont la signature a expiré) ;
//      decide(rng) — l'action à jouer (ou null si l'état avance tout seul :
//                   roulette d'événement, dés animés, versus…) ;
//      fallback   — action de SECOURS du watchdog anti soft-lock (décliner/
//                   annuler/continuer), null si un timeout du jeu s'en charge.
//    }
//  Les actions du store ont toutes leurs gardes internes : un tir périmé ou
//  doublé est un no-op — propriété de robustesse sur laquelle on s'appuie.
// ============================================================
import { POWERS } from '../data/powers.js';
import { METIER_IDS } from './metier.js';

// Profils de difficulté : p = probabilité de viser la bonne réponse ;
// duelBravery = goût du duel (P2) ; ratio = fenêtre de « temps restant »
// simulé à la réponse (fraction du chrono — pilote le gain d'or, pour que
// l'économie du bot reste comparable à celle d'un humain de ce niveau).
export const BOT_LEVELS = {
  facile: { p: 0.45, duelBravery: 0.3, ratio: [0.25, 0.5] },
  moyen: { p: 0.6, duelBravery: 0.5, ratio: [0.35, 0.6] },
  difficile: { p: 0.75, duelBravery: 0.75, ratio: [0.45, 0.75] },
};

// Noms d'équipe des bots (thème espace, assortis au jeu).
export const BOT_NAMES = ['Nébula', 'Orbitron', 'Quasar', 'Pulsar', 'Andromède', 'Sirius'];

export const isBot = (t) => !!t?.isBot;
export const levelOf = (team) => BOT_LEVELS[team?.botLevel] || BOT_LEVELS.moyen;

const between = (rng, lo, hi) => lo + rng() * (hi - lo);
const pickFrom = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// --- Heuristiques de plateau -------------------------------------------

// Distance (en cases, BFS via next[]) jusqu'à la première case « arrivee ».
export function distanceToFinish(board, from) {
  if (!board || !board[from]) return Infinity;
  const seen = new Set([from]);
  let frontier = [from];
  let d = 0;
  while (frontier.length) {
    for (const id of frontier) if (board[id]?.type === 'arrivee') return d;
    const next = [];
    for (const id of frontier) {
      for (const n of board[id]?.next || []) {
        if (!seen.has(n)) { seen.add(n); next.push(n); }
      }
    }
    frontier = next;
    d += 1;
  }
  return Infinity;
}

// Choix de voie à une jonction : la branche la plus COURTE vers l'arrivée
// (égalité → au hasard). Repli : n'importe quelle branche.
export function pickJunction(board, pos, rng = Math.random) {
  const opts = board?.[pos]?.next || [];
  if (!opts.length) return null;
  let best = [];
  let bestD = Infinity;
  for (const id of opts) {
    const d = distanceToFinish(board, id);
    if (d < bestD) { bestD = d; best = [id]; }
    else if (d === bestD) best.push(id);
  }
  return pickFrom(rng, best.length ? best : opts);
}

// --- Heuristique de réponse ---------------------------------------------

// Vise la bonne réponse avec probabilité p, sinon une MAUVAISE au hasard
// parmi les réponses non barrées (indiceHidden). Toutes les mauvaises
// barrées → bonne réponse forcée (comme un humain qui lit les indices).
export function pickAnswerIndex(question, hidden = [], p = 0.6, rng = Math.random) {
  const n = question?.a?.length || 0;
  if (!n) return 0;
  const correct = question.c;
  if (rng() < p) return correct;
  const wrong = [];
  for (let i = 0; i < n; i++) {
    if (i !== correct && !hidden.includes(i)) wrong.push(i);
  }
  return wrong.length ? pickFrom(rng, wrong) : correct;
}

// Cible adverse par défaut : le LEADER (plus proche de l'arrivée) parmi les
// autres équipes. Repli : premier index ≠ self.
export function pickLeaderTarget(state, selfIdx, rng = Math.random) {
  const { teams, board } = state;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < teams.length; i++) {
    if (i === selfIdx) continue;
    const d = distanceToFinish(board, teams[i].pos);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best >= 0) return best;
  const others = teams.map((_, i) => i).filter((i) => i !== selfIdx);
  return others.length ? pickFrom(rng, others) : -1;
}

// Récompense de duel : recul si le perdant est devant, sinon vol d'or si sa
// bourse en vaut la peine, sinon butin d'objet.
export function pickReward(state, fight) {
  const winIdx = fight.winnerSide === 'attacker' ? fight.attackerIndex : fight.defenderIndex;
  const loseIdx = fight.winnerSide === 'attacker' ? fight.defenderIndex : fight.attackerIndex;
  const winner = state.teams[winIdx];
  const loser = state.teams[loseIdx];
  if (!winner || !loser) return 'steal';
  const dWin = distanceToFinish(state.board, winner.pos);
  const dLose = distanceToFinish(state.board, loser.pos);
  if (dLose < dWin) return 'knockback';
  if ((loser.money || 0) >= 8) return 'steal';
  return 'loot';
}

// --- Décisions d'événement (phase 'choice', par clé) ---------------------

function eventChoiceDecision(state, ev, team, teamIdx) {
  const d = ev.data || {};
  const decline = { action: 'declineEvent', args: [] };
  switch (ev.key) {
    case 'troisCoffres': {
      const gifts = d.gifts || [];
      if (!gifts.length) return { sig: `event|choice|gifts0`, decide: () => null, fallback: decline };
      return {
        sig: `event|choice|troisCoffres`,
        decide: (rng) => ({ action: 'eventChooseGift', args: [pickFrom(rng, gifts)], delayMs: 2500 }),
        fallback: decline,
      };
    }
    case 'recharge': {
      const keys = Object.keys(team.powers || {}).filter((k) => POWERS[k]);
      if (!keys.length) return { sig: 'event|choice|recharge0', decide: () => ({ action: 'declineEvent', args: [], delayMs: 2000 }), fallback: decline };
      // Recharge le pouvoir le moins pourvu.
      keys.sort((a, b) => (team.powers[a]?.charges ?? 0) - (team.powers[b]?.charges ?? 0));
      return {
        sig: 'event|choice|recharge',
        decide: () => ({ action: 'eventRechargeChoice', args: [keys[0]], delayMs: 2200 }),
        fallback: decline,
      };
    }
    case 'bossProf': {
      // Choix du thème du boss : un thème qui a réellement des questions
      // (la course du duel éclair pioche directement dans questions[thème]).
      const pools = Object.keys(state.questions || {}).filter((k) => (state.questions[k] || []).length);
      if (!pools.length) return { sig: 'event|choice|boss0', decide: () => ({ action: 'declineEvent', args: [], delayMs: 2000 }), fallback: decline };
      return {
        sig: 'event|choice|bossProf',
        decide: (rng) => ({ action: 'startBossFight', args: [pickFrom(rng, pools)], delayMs: 2500 }),
        fallback: decline,
      };
    }
    case 'vol': {
      // Vole une charge au pouvoir le mieux pourvu de la cible, versée sur
      // le pouvoir le moins pourvu du bot.
      const target = state.teams[d.targetIndex];
      const stealable = Object.keys(target?.powers || {})
        .filter((k) => POWERS[k] && (target.powers[k]?.charges ?? 0) > 0)
        .sort((a, b) => (target.powers[b]?.charges ?? 0) - (target.powers[a]?.charges ?? 0));
      const mine = Object.keys(team.powers || {}).filter((k) => POWERS[k])
        .sort((a, b) => (team.powers[a]?.charges ?? 0) - (team.powers[b]?.charges ?? 0));
      if (!stealable.length || !mine.length) return { sig: 'event|choice|vol0', decide: () => ({ action: 'declineEvent', args: [], delayMs: 2000 }), fallback: decline };
      return {
        sig: 'event|choice|vol',
        decide: () => ({ action: 'eventVolApply', args: [stealable[0], mine[0]], delayMs: 2500 }),
        fallback: decline,
      };
    }
    case 'pillage': {
      const target = state.teams[d.targetIndex];
      const pick = firstItemPick(target);
      if (!pick) return { sig: 'event|choice|pillage0', decide: () => ({ action: 'declineEvent', args: [], delayMs: 2000 }), fallback: decline };
      return {
        sig: 'event|choice|pillage',
        decide: () => ({ action: 'eventPillageApply', args: [pick], delayMs: 2500 }),
        fallback: decline,
      };
    }
    // Marchands / troc du destin : le bot passe son chemin (v1 : pas d'achats
    // d'événement — l'économie simple viendra par la boutique, P3).
    default:
      return {
        sig: `event|choice|${ev.key}`,
        decide: () => ({ action: 'declineEvent', args: [], delayMs: 2200 }),
        fallback: decline,
      };
  }
}

// Premier objet volable d'une équipe : équipement puis sac. Renvoie le
// format `pick` attendu par eventPillageApply, ou null.
function firstItemPick(team) {
  if (!team) return null;
  for (const slot of ['head', 'body', 'feet']) {
    const cell = team.equipment?.[slot];
    const key = typeof cell === 'string' ? cell : cell?.key;
    if (key) return { kind: 'equipment', slot };
  }
  const bag = team.bag || [];
  for (let i = 0; i < bag.length; i++) {
    const key = typeof bag[i] === 'string' ? bag[i] : bag[i]?.key;
    if (key) return { kind: 'bag', index: i };
  }
  return null;
}

// --- La grande table : état → décision en attente ------------------------

export function pendingDecision(state) {
  const teams = state.teams;
  if (!Array.isArray(teams) || !teams.some(isBot)) return null;

  // --- Sélection des pouvoirs (phase powerSelect) ---
  if (state.phase === 'powerSelect') {
    const idx = state.powerSetupIndex;
    const cat = state.powerSetupCategory;
    const team = teams[idx];
    if (!isBot(team)) return null;
    const picked = cat === 'def' ? team.powerDef : team.powerOff;
    const pool = Object.keys(POWERS).filter((k) => POWERS[k].category === cat);
    if (!picked && pool.length) {
      return {
        sig: `power|${cat}|${idx}|pick`,
        decide: (rng) => ({ action: 'selectPower', args: [idx, cat, pickFrom(rng, pool)], delayMs: 1500 }),
        fallback: { action: 'selectPower', args: [idx, cat, pool[0]] },
      };
    }
    return {
      sig: `power|${cat}|${idx}|next`,
      decide: () => ({ action: 'advancePowerSetup', args: [], delayMs: 900 }),
      fallback: { action: 'advancePowerSetup', args: [] },
    };
  }

  if (state.phase !== 'game' || state.finished) return null;

  const curIdx = state.currentTeam;
  const cur = teams[curIdx];

  // --- Duel : l'acteur n'est PAS toujours l'équipe courante (le défenseur
  // répond à la course, le GAGNANT choisit la récompense). ---
  const f = state.showFight;
  if (f) {
    const att = teams[f.attackerIndex];
    const def = f.defenderIndex >= 0 ? teams[f.defenderIndex] : null; // -1 = boss
    const humanInvolved = (att && !isBot(att)) || (def && !isBot(def));
    if (f.phase === 'versus') {
      // L'écran versus enchaîne tout seul (fightBegin après ~4 s).
      return { sig: 'fight|versus', decide: () => null, fallback: { action: 'fightBegin', args: [] } };
    }
    if (f.phase === 'minigame' && f.race) {
      // Course à la question : chaque duelliste BOT qui n'a pas répondu joue.
      for (const [side, idx] of [['attacker', f.attackerIndex], ['defender', f.defenderIndex]]) {
        if (idx < 0) continue;
        const t = teams[idx];
        if (isBot(t) && !f.race.answers?.[side]) {
          return {
            sig: `race|${f.race.deadline}|${side}`,
            decide: (rng) => ({
              action: 'submitFightAnswer',
              args: [idx, pickAnswerIndex(f.race.q, [], levelOf(t).p, rng)],
              delayMs: between(rng, 3500, 8500),
            }),
            fallback: null, // le timeout de course (20 s) gère déjà l'impasse
          };
        }
      }
      return null; // au tour de l'humain (ou les deux ont répondu → résolution)
    }
    if (f.phase === 'reward') {
      if (f.reward) return null; // dés de récompense en cours (animation auto)
      const winIdx = f.winnerSide === 'attacker' ? f.attackerIndex : f.defenderIndex;
      if (winIdx < 0 || !isBot(teams[winIdx])) return null;
      return {
        sig: `fight|reward|${f.winnerSide}`,
        decide: () => ({ action: 'fightChooseReward', args: [pickReward(state, f)], delayMs: 2500 }),
        fallback: { action: 'fightChooseReward', args: ['steal'] },
      };
    }
    if (f.phase === 'result') {
      // Un humain au duel garde le bouton « Continuer » ; duel 100 % bot
      // (bot vs bot, ou bot vs boss) → le bot referme.
      if (humanInvolved) return null;
      return {
        sig: 'fight|result',
        decide: () => ({ action: 'closeFight', args: [], delayMs: 3000 }),
        fallback: { action: 'closeFight', args: [] },
      };
    }
    return null; // briefing/minigame local : jamais atteint avec un bot (course forcée)
  }

  // --- Tout le reste appartient au tour de l'équipe courante ---
  if (!isBot(cur)) {
    // …sauf les interrupts du moteur d'effets, qui appartiennent à l'équipe
    // SOURCE de la file (ex. déclencheur on:fightLose d'un bot perdant alors
    // que l'humain est l'équipe courante).
    const srcIdx = state.pendingActions?.ctx?.sourceTeam;
    if (srcIdx == null || !isBot(teams[srcIdx])) return null;
  }
  const actorIdx = isBot(cur) ? curIdx : state.pendingActions.ctx.sourceTeam;
  const actor = teams[actorIdx];
  const lvl = levelOf(actor);

  // --- Question ---
  const sq = state.showQuestion;
  if (sq?.question) {
    if (!sq.answerRevealed) {
      return {
        sig: `q|${sq.deadline}|${sq.secondChanceUsed ? 1 : 0}`,
        decide: (rng) => ({
          action: 'botSelectAnswer',
          args: [
            pickAnswerIndex(sq.question, state.indiceHidden || [], lvl.p, rng),
            between(rng, lvl.ratio[0], lvl.ratio[1]),
          ],
          delayMs: between(rng, 2500, 4500),
        }),
        fallback: null, // le timer de la question (QuestionModal) révèle à 0
      };
    }
    return {
      sig: `q|${sq.deadline}|revealed`,
      decide: () => ({ action: 'continueQuestion', args: [], delayMs: 2500 }),
      fallback: { action: 'continueQuestion', args: [] },
    };
  }

  // --- Événement ---
  const ev = state.showEvent;
  if (ev) {
    const d = ev.data || {};
    switch (ev.phase) {
      case 'roulette':
        return { sig: 'event|roulette', decide: () => null, fallback: { action: 'revealEvent', args: [] } };
      case 'intro':
        return {
          sig: `event|intro|${ev.key}`,
          decide: () => ({ action: 'acceptEvent', args: [], delayMs: 2500 }),
          fallback: { action: 'declineEvent', args: [] },
        };
      case 'target': {
        const target = pickLeaderTarget(state, actorIdx);
        if (target < 0) return { sig: 'event|target|none', decide: () => null, fallback: { action: 'declineEvent', args: [] } };
        return {
          sig: `event|target|${ev.key}`,
          decide: () => ({ action: 'eventSelectTarget', args: [target], delayMs: 2000 }),
          fallback: { action: 'declineEvent', args: [] },
        };
      }
      case 'question': {
        if (d.questionRevealed) {
          // applyEventEffect s'enchaîne tout seul 2 s après la réponse.
          return { sig: 'event|question|revealed', decide: () => null, fallback: { action: 'applyEventEffect', args: [] } };
        }
        if (!d.eventQuestion) return null;
        return {
          sig: `event|question|${d.vaToutStreak || 0}`,
          decide: (rng) => ({
            action: 'eventAnswerQuestion',
            args: [pickAnswerIndex(d.eventQuestion, [], lvl.p, rng)],
            delayMs: between(rng, 2500, 4500),
          }),
          fallback: { action: 'eventAnswerQuestion', args: [0] },
        };
      }
      case 'dice':
        return { sig: `event|dice|${d.diceRolling ? 1 : 0}`, decide: () => null, fallback: null }; // dés animés → applyEventEffect auto
      case 'vaToutChoice':
        // Joueur prudent : on encaisse dès qu'il y a un pot (v1).
        return {
          sig: `event|vatout|${d.vaToutPot || 0}`,
          decide: () => ({ action: (d.vaToutPot || 0) > 0 ? 'eventVaToutCashOut' : 'eventVaToutContinue', args: [], delayMs: 2500 }),
          fallback: { action: 'eventVaToutCashOut', args: [] },
        };
      case 'choice':
        return eventChoiceDecision(state, ev, actor, actorIdx);
      case 'result':
        return {
          sig: 'event|result',
          decide: () => ({ action: 'closeEvent', args: [], delayMs: 2500 }),
          fallback: { action: 'closeEvent', args: [] },
        };
      default:
        return { sig: `event|${ev.phase}`, decide: () => null, fallback: { action: 'declineEvent', args: [] } };
    }
  }

  // --- Révélations / bilans à fermer ---
  if (state.lootReveal) {
    return {
      sig: `loot|${state.lootReveal.itemKey}|${state.lootReveal.rest?.length || 0}`,
      decide: () => ({ action: 'dismissLoot', args: [], delayMs: 2500 }),
      fallback: { action: 'dismissLoot', args: [] },
    };
  }
  if (state.investResult) {
    return {
      sig: 'investResult',
      decide: () => ({ action: 'dismissInvestResult', args: [], delayMs: 2500 }),
      fallback: { action: 'dismissInvestResult', args: [] },
    };
  }

  // --- Interrupts du moteur d'effets (file suspendue → on répond) ---
  if (state.showTargetPicker) {
    const allowSelf = !!state.showTargetPicker.allowSelf;
    const target = pickLeaderTarget(state, allowSelf ? -1 : actorIdx);
    return {
      sig: 'pick|target',
      decide: () => (target >= 0
        ? { action: 'selectTarget', args: [target], delayMs: 2000 }
        : { action: 'cancelTargetPicker', args: [], delayMs: 1500 }),
      fallback: { action: 'cancelTargetPicker', args: [] },
    };
  }
  if (state.showTilePicker) {
    // Piège : 1 à 3 cases devant le leader adverse (sur son chemin).
    const leader = pickLeaderTarget(state, actorIdx);
    let tile = null;
    if (leader >= 0) {
      let pos = teams[leader].pos;
      for (let i = 0; i < 2; i++) {
        const nxt = state.board?.[pos]?.next || [];
        if (!nxt.length) break;
        pos = nxt[0];
      }
      if (pos !== teams[leader].pos && state.board?.[pos] && state.board[pos].type !== 'arrivee') tile = pos;
    }
    return {
      sig: 'pick|tile',
      decide: () => (tile
        ? { action: 'selectTile', args: [tile], delayMs: 2200 }
        : { action: 'cancelTilePicker', args: [], delayMs: 1500 }),
      fallback: { action: 'cancelTilePicker', args: [] },
    };
  }
  if (state.showChargePicker) {
    const keys = Object.keys(actor.powers || {}).filter((k) => POWERS[k]);
    keys.sort((a, b) => (actor.powers[a]?.charges ?? 0) - (actor.powers[b]?.charges ?? 0));
    return {
      sig: 'pick|charge',
      decide: () => (keys.length
        ? { action: 'chargePickerChoice', args: [keys[0]], delayMs: 2000 }
        : { action: 'chargePickerSkip', args: [], delayMs: 1500 }),
      fallback: { action: 'chargePickerSkip', args: [] },
    };
  }
  if (state.showSubjectPicker) {
    const choices = Array.isArray(state.showSubjectPicker.choices) && state.showSubjectPicker.choices.length
      ? state.showSubjectPicker.choices
      : (Array.isArray(state.boardSubjects) ? state.boardSubjects : []);
    if (!choices.length) return { sig: 'pick|subject|none', decide: () => null, fallback: null };
    return {
      sig: 'pick|subject',
      decide: (rng) => ({ action: 'selectSubject', args: [pickFrom(rng, choices)], delayMs: 2000 }),
      fallback: { action: 'selectSubject', args: [choices[0]] },
    };
  }
  if (state.showInvestPicker) {
    return {
      sig: 'pick|invest',
      decide: () => ({ action: 'cancelInvest', args: [], delayMs: 1800 }), // v1 : pas de mise
      fallback: { action: 'cancelInvest', args: [] },
    };
  }

  // --- File d'effets en cours SANS interrupt ouvert : elle avance seule ---
  if (state.pendingActions) return null;

  // À partir d'ici, seules les décisions de l'ÉQUIPE COURANTE existent.
  if (!isBot(cur)) return null;

  // --- Coffre de départ ---
  if (state.showStarterChest) {
    const reward = state.lastStarterReward || {};
    const choices = reward.choices || [];
    const keep = Math.max(1, Math.min(reward.keep || 1, choices.length || 1));
    return {
      sig: `chest|${curIdx}`,
      decide: (rng) => {
        const shuffled = [...choices];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return { action: 'closeStarterChest', args: [shuffled.slice(0, keep)], delayMs: 2500 };
      },
      fallback: { action: 'closeStarterChest', args: [[]] },
    };
  }

  // --- Métier (extension coupée en solo, mais on ne soft-locke JAMAIS) ---
  if (state.showMetierPicker) {
    return {
      sig: `metier|${curIdx}`,
      decide: (rng) => ({ action: 'chooseMetier', args: [pickFrom(rng, METIER_IDS)], delayMs: 2000 }),
      fallback: { action: 'chooseMetier', args: [METIER_IDS[0]] },
    };
  }

  // --- Choix de duel (case occupée, mode non forcé) — v1 : on décline ---
  if (state.showDuelChoice) {
    return {
      sig: `duelChoice|${curIdx}`,
      decide: () => ({ action: 'declineDuel', args: [], delayMs: 2000 }),
      fallback: { action: 'declineDuel', args: [] },
    };
  }

  // --- Jonction ---
  if (state.awaitingChoice) {
    const choice = pickJunction(state.board, cur.pos);
    if (!choice) return { sig: 'junction|none', decide: () => null, fallback: null };
    return {
      sig: `junction|${cur.pos}|${state.pendingMove?.remaining ?? 0}`,
      decide: (rng) => ({ action: 'chooseJunction', args: [pickJunction(state.board, cur.pos, rng)], delayMs: 1600 }),
      fallback: { action: 'chooseJunction', args: [choice] },
    };
  }

  // --- Atterrissage à confirmer (le délai couvre l'animation du pion) ---
  if (state.pendingLanding) {
    return {
      sig: `landing|${cur.pos}`,
      decide: () => ({ action: 'confirmLanding', args: [], delayMs: 2400 }),
      fallback: { action: 'confirmLanding', args: [] },
    };
  }

  // --- Boutique (P3 : achats ; v1 : on referme/décline poliment) ---
  if (state.showShop) {
    return {
      sig: 'shop',
      decide: () => ({ action: 'closeShop', args: [], delayMs: 2000 }),
      fallback: { action: 'closeShop', args: [] },
    };
  }
  if (state.showShopPrompt) {
    return {
      sig: 'shopPrompt',
      decide: () => ({ action: 'dismissShopPrompt', args: [], delayMs: 1800 }),
      fallback: { action: 'dismissShopPrompt', args: [] },
    };
  }

  // --- Animations en cours : on attend (le dé s'auto-complète) ---
  if (state.rolling || state.showDiceModal) return null;
  if (state.hackOverlay) return null; // cinématique « tour piraté » : minuterie du HUD

  // --- Tour libre : lancer le dé ---
  return {
    sig: `turn|${curIdx}|${state.turnCount ?? 0}|${cur.pos}`,
    decide: () => ({ action: 'rollDice', args: [], delayMs: 1800 }),
    fallback: { action: 'rollDice', args: [] },
  };
}

// Signature de l'état pour l'idempotence du driver (null = rien à faire).
export function stateSignature(state) {
  return pendingDecision(state)?.sig ?? null;
}
