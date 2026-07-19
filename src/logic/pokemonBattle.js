// Moteur de combat Pokémon (Gén. 1) — logique PURE, aucun rendu (cf.
// DESIGN_POKEMON.md §2). L'UI (PokemonBattleGame) consomme les ÉVÉNEMENTS
// retournés par resolveTurn pour séquencer messages/anims.
//
// Fidélité Gén. 1 : stats avec Spécial unique, physique/spécial PAR TYPE,
// table des 15 types (Spectre→Psy corrigé ×2 — le ×0 de l'époque était un bug),
// STAB ×1,5, critiques 1/16 ×1,5, aléa 0,85-1. Statuts v1 : paralysie (Vit ÷4,
// 25 % tour perdu), poison (1/8 PV max/tour), sommeil (1-3 tours), boosts de
// stats ±2 crans. PV ×0,8 (rythme accéléré validé) via HP_SCALE.
//
// Tout l'aléatoire passe par `rng()` (injectable → tests déterministes).

export const HP_SCALE = 0.8; // rythme accéléré (décision 2026-07-19)
const LEVEL = 50;

// Types PHYSIQUES en Gén. 1 (les autres = spéciaux). L'Attaque/Défense ou le
// Spécial est choisi selon le TYPE de la capacité, pas la capacité elle-même.
const PHYSICAL_TYPES = new Set(['normal', 'fighting', 'flying', 'ground', 'rock', 'bug', 'ghost', 'poison']);

// Table des types Gén. 1 : TYPE_CHART[attaquant][défenseur] = multiplicateur
// (absent = 1). Particularités Gén. 1 conservées : Insecte↔Poison ×2 mutuel,
// Glace neutre sur Feu.
export const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0 },
  fighting: { normal: 2, rock: 2, ice: 2, flying: 0.5, poison: 0.5, bug: 0.5, psychic: 0.5, ghost: 0 },
  flying: { fighting: 2, bug: 2, grass: 2, rock: 0.5, electric: 0.5 },
  poison: { grass: 2, bug: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
  ground: { poison: 2, rock: 2, fire: 2, electric: 2, grass: 0.5, bug: 0.5, flying: 0 },
  rock: { flying: 2, bug: 2, fire: 2, ice: 2, fighting: 0.5, ground: 0.5 },
  bug: { grass: 2, psychic: 2, poison: 2, fighting: 0.5, flying: 0.5, ghost: 0.5, fire: 0.5 },
  ghost: { ghost: 2, psychic: 2, normal: 0 },
  fire: { grass: 2, ice: 2, bug: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  ice: { grass: 2, ground: 2, flying: 2, dragon: 2, water: 0.5, ice: 0.5 },
  dragon: { dragon: 2 },
};

export function typeMultiplier(moveType, defenderTypes) {
  return defenderTypes.reduce((mult, t) => mult * (TYPE_CHART[moveType]?.[t] ?? 1), 1);
}

// Stat réelle au niveau 50 (IV 31, sans EV — la formule moderne, lisible).
export function statAt50(base, isHp = false) {
  const core = Math.floor(((2 * base + 31) * LEVEL) / 100);
  return isHp ? Math.floor((core + LEVEL + 10) * HP_SCALE) : core + 5;
}

// Multiplicateur d'un cran de boost (−2 … +2).
const STAGE_MULT = { '-2': 0.5, '-1': 2 / 3, 0: 1, 1: 1.5, 2: 2 };
const clampStage = (n) => Math.max(-2, Math.min(2, n));

// --- État du combat ---

// mon = fiche pokemonBattle.json ; retourne le combattant runtime.
export function makeFighter(mon) {
  return {
    mon,
    hp: statAt50(mon.base.hp, true),
    maxHp: statAt50(mon.base.hp, true),
    stats: { atk: statAt50(mon.base.atk), def: statAt50(mon.base.def), spc: statAt50(mon.base.spc), spe: statAt50(mon.base.spe) },
    boosts: { atk: 0, def: 0, spc: 0, spe: 0 },
    status: null,       // 'par' | 'psn' | 'slp'
    sleepTurns: 0,
    ko: false,
  };
}

export function createBattle(teamA, teamB) {
  return {
    sides: {
      A: { fighters: teamA.map(makeFighter), active: 0 },
      B: { fighters: teamB.map(makeFighter), active: 0 },
    },
    turn: 1,
    winner: null,        // 'A' | 'B'
    pendingSwitch: null, // côté qui DOIT envoyer un remplaçant après un K.O.
  };
}

export const activeFighter = (battle, side) => battle.sides[side].fighters[battle.sides[side].active];
export const aliveCount = (battle, side) => battle.sides[side].fighters.filter((f) => !f.ko).length;

function effStat(f, key) {
  let v = f.stats[key] * STAGE_MULT[clampStage(f.boosts[key])];
  if (key === 'spe' && f.status === 'par') v /= 4;
  return Math.max(1, Math.floor(v));
}

// --- Résolution d'un tour ---
// actions = { A: {type:'move', index} | {type:'switch', index}, B: … }.
// Retourne la liste d'ÉVÉNEMENTS à séquencer par l'UI ; mute `battle`.
export function resolveTurn(battle, actions, rng = Math.random) {
  const events = [];
  if (battle.winner || battle.pendingSwitch) return events;

  // 1) Les switchs passent toujours en premier (comme le vrai jeu).
  for (const side of ['A', 'B']) {
    if (actions[side]?.type === 'switch') doSwitch(battle, side, actions[side].index, events);
  }

  // 2) Capacités par ordre de Vitesse effective (égalité → pièce).
  const movers = ['A', 'B'].filter((s) => actions[s]?.type === 'move');
  movers.sort((a, b) => {
    const d = effStat(activeFighter(battle, b), 'spe') - effStat(activeFighter(battle, a), 'spe');
    return d !== 0 ? d : (rng() < 0.5 ? -1 : 1);
  });
  for (const side of movers) {
    if (battle.winner) break;
    const foe = side === 'A' ? 'B' : 'A';
    if (activeFighter(battle, side).ko) continue; // K.O. avant d'agir
    doMove(battle, side, foe, actions[side].index, events, rng);
  }

  // 3) Fin de tour : poison.
  for (const side of ['A', 'B']) {
    if (battle.winner) break;
    const f = activeFighter(battle, side);
    if (!f.ko && f.status === 'psn') {
      const dmg = Math.max(1, Math.floor(f.maxHp / 8));
      f.hp = Math.max(0, f.hp - dmg);
      events.push({ kind: 'poison', side, dmg });
      checkKo(battle, side, events);
    }
  }

  battle.turn += 1;
  return events;
}

function doSwitch(battle, side, index, events) {
  const s = battle.sides[side];
  const target = s.fighters[index];
  if (!target || target.ko || index === s.active) return;
  // Les boosts se réinitialisent au switch (comme le vrai jeu) ; statut conservé.
  target.boosts = { atk: 0, def: 0, spc: 0, spe: 0 };
  s.active = index;
  events.push({ kind: 'switch', side, index, name: target.mon.name });
}

// Remplaçant après K.O. (appelé par l'UI quand le côté a choisi).
export function sendReplacement(battle, side, index) {
  const events = [];
  if (battle.pendingSwitch !== side) return events;
  battle.pendingSwitch = null;
  doSwitch(battle, side, index, events);
  return events;
}

function doMove(battle, atkSide, defSide, moveIndex, events, rng) {
  const atk = activeFighter(battle, atkSide);
  const def = activeFighter(battle, defSide);
  const move = atk.mon.moves[moveIndex];
  if (!move) return;

  // Sommeil : décompte, tour perdu (réveil annoncé, agit au tour suivant).
  if (atk.status === 'slp') {
    atk.sleepTurns -= 1;
    if (atk.sleepTurns > 0) { events.push({ kind: 'asleep', side: atkSide }); return; }
    atk.status = null;
    events.push({ kind: 'wake', side: atkSide });
  }
  // Paralysie : 25 % de tour perdu.
  if (atk.status === 'par' && rng() < 0.25) {
    events.push({ kind: 'paralyzed', side: atkSide });
    return;
  }

  events.push({ kind: 'move', side: atkSide, move: move.fr, type: move.type });

  // Précision.
  if (rng() >= (move.accuracy ?? 100) / 100) {
    events.push({ kind: 'miss', side: atkSide });
    return;
  }

  // Dégâts.
  if (move.power > 0) {
    const mult = typeMultiplier(move.type, def.mon.types);
    if (mult === 0) { events.push({ kind: 'immune', side: defSide }); return; }
    const phys = PHYSICAL_TYPES.has(move.type);
    const A = effStat(atk, phys ? 'atk' : 'spc');
    const D = effStat(def, phys ? 'def' : 'spc');
    const stab = atk.mon.types.includes(move.type) ? 1.5 : 1;
    const crit = rng() < 1 / 16;
    const roll = 0.85 + rng() * 0.15;
    let dmg = Math.floor(Math.floor((Math.floor((2 * LEVEL) / 5 + 2) * move.power * A) / D / 50) + 2);
    dmg = Math.max(1, Math.floor(dmg * stab * mult * (crit ? 1.5 : 1) * roll));
    def.hp = Math.max(0, def.hp - dmg);
    events.push({ kind: 'damage', side: defSide, dmg, mult, crit });
    if (checkKo(battle, defSide, events)) return;
  }

  // Effets (statuts / boosts) — après les dégâts éventuels.
  for (const eff of move.effects || []) {
    if (eff.kind === 'ailment') {
      if (def.status || def.ko) { if (!move.power) events.push({ kind: 'fail', side: atkSide }); continue; }
      // Immunités logiques : l'électrique ne paralyse pas le type Sol, le
      // poison n'empoisonne pas le type Poison.
      if (eff.ailment === 'par' && move.type === 'electric' && def.mon.types.includes('ground')) { events.push({ kind: 'fail', side: atkSide }); continue; }
      if (eff.ailment === 'psn' && def.mon.types.includes('poison')) { events.push({ kind: 'fail', side: atkSide }); continue; }
      def.status = eff.ailment;
      if (eff.ailment === 'slp') def.sleepTurns = 1 + Math.floor(rng() * 3); // 1-3 tours
      events.push({ kind: 'ailment', side: defSide, ailment: eff.ailment });
    } else if (eff.kind === 'boost') {
      const target = eff.target === 'self' ? atk : def;
      const tSide = eff.target === 'self' ? atkSide : defSide;
      const before = target.boosts[eff.stat];
      target.boosts[eff.stat] = clampStage(before + eff.delta);
      if (target.boosts[eff.stat] === before) events.push({ kind: 'fail', side: atkSide });
      else events.push({ kind: 'boost', side: tSide, stat: eff.stat, delta: eff.delta });
    }
  }
}

function checkKo(battle, side, events) {
  const f = activeFighter(battle, side);
  if (f.hp > 0 || f.ko) return f.ko;
  f.ko = true;
  events.push({ kind: 'ko', side, name: f.mon.name });
  if (aliveCount(battle, side) === 0) {
    battle.winner = side === 'A' ? 'B' : 'A';
    events.push({ kind: 'win', side: battle.winner });
  } else {
    battle.pendingSwitch = side;
  }
  return true;
}

// --- Draft 6 → 3 (tranches de puissance appariées, sans doublon ni légendaire) ---
// Retourne { A: [6 fiches], B: [6 fiches] } : 2 forts, 2 moyens, 2 modestes par
// équipe, chaque slot apparié en BST entre les deux équipes (|Δ| minimal).
export function draftOffers(allMons, rng = Math.random) {
  const pool = allMons.filter((m) => !m.legendary && m.moves.length === 4).sort((a, b) => b.bst - a.bst);
  const tierSize = Math.floor(pool.length / 3);
  const tiers = [pool.slice(0, tierSize), pool.slice(tierSize, 2 * tierSize), pool.slice(2 * tierSize)];
  const offers = { A: [], B: [] };
  const used = new Set();
  for (const tier of tiers) {
    for (let pair = 0; pair < 2; pair++) {
      const free = tier.filter((m) => !used.has(m.id));
      if (free.length < 2) continue;
      // un pivot au hasard, son voisin de BST le plus proche en face
      const first = free[Math.floor(rng() * free.length)];
      used.add(first.id);
      const second = free
        .filter((m) => !used.has(m.id))
        .sort((a, b) => Math.abs(a.bst - first.bst) - Math.abs(b.bst - first.bst))[0];
      used.add(second.id);
      if (rng() < 0.5) { offers.A.push(first); offers.B.push(second); }
      else { offers.A.push(second); offers.B.push(first); }
    }
  }
  return offers;
}
