// Combat Pokémon PILOTÉ PAR LE STORE — surface « écran (TV) + téléphones » :
// l'hôte est l'autorité (draft, moteur logic/pokemonBattle, minuteries de
// séquençage) ; chaque duelliste drafte et choisit ses actions depuis SON
// téléphone (vue Game Boy). La TV n'affiche QUE la scène de combat (PkmnStage)
// — pas les commandes. La surface tactile garde le composant autonome
// (PokemonBattleGame.jsx).
//
// SECRET (anti-triche) : le CONTENU du choix d'un camp (capacité/switch) ne
// quitte jamais l'hôte tant que le tour n'est pas résolu — buildTurnPayload ne
// publie que des accusés `chosen: { A: bool, B: bool }`.
//
// showFight.pkmn = {
//   stage: 'draft' | 'battle',
//   offers: { A: [fiche…], B: [fiche…] },   // 6 propositions par camp (public)
//   picks: { A: [id…], B: [id…] }, validated: { A, B },
//   view,                                    // vue d'affichage (hp/status/boosts/ko)
//   dialog, anim, vfx,                       // séquencés par les minuteries hôte
//   phaseB: 'choose'|'anim'|'replace'|'over',
//   choice: { A: action|null, B: … },        // SECRET (strippé du payload)
//   replaceSide: 'A'|'B'|null, winner: null|'A'|'B', seq,
// }
import MONS from '../data/pokemonBattle.json';
import { createBattle, resolveTurn, sendReplacement, draftOffers } from '../logic/pokemonBattle';
import { archetypeForMove, SELF_ARCHETYPES, CONTACT_ARCHETYPES } from '../logic/pkmnAnimMap';
import { soundEvent, soundPower, soundKatana, getSfxLevel } from '../logic/sounds';
import { tg } from '../i18n';

// Moteur réel côté hôte (non sérialisé — la vue publiée suffit aux clients).
let hostBattle = null;

const STAT_FR = { atk: 'Attaque', def: 'Défense', spc: 'Spécial', spe: 'Vitesse' };

function playCry(url) {
  if (!url) return;
  try { const a = new Audio(url); a.volume = getSfxLevel() * 0.45; a.play().catch(() => {}); } catch { /* muet */ }
}

function snapshotView(battle) {
  const side = (s) => ({
    active: s.active,
    fighters: s.fighters.map((f) => ({
      name: f.mon.name, sprite: f.mon.sprite, spriteStatic: f.mon.spriteStatic,
      cry: f.mon.cry, types: f.mon.types, moves: f.mon.moves,
      hp: f.hp, maxHp: f.maxHp, status: f.status, ko: f.ko, boosts: { ...f.boosts },
    })),
  });
  return { A: side(battle.sides.A), B: side(battle.sides.B) };
}

const patchPkmn = (set, get, patch) => {
  const f = get().showFight;
  if (!f?.pkmn) return null;
  const pkmn = { ...f.pkmn, ...patch };
  set({ showFight: { ...f, pkmn } });
  return pkmn;
};

export function startPkmnDuel(set, get) {
  const f = get().showFight;
  if (!f) return;
  hostBattle = null;
  set({
    showFight: {
      ...f, phase: 'minigame',
      pkmn: {
        stage: 'draft', offers: draftOffers(MONS),
        picks: { A: [], B: [] }, validated: { A: false, B: false },
        view: null, dialog: '', anim: null, vfx: null,
        phaseB: 'choose', choice: { A: null, B: null },
        replaceSide: null, winner: null, seq: 0,
      },
    },
  });
}

// ── Draft (téléphones) ───────────────────────────────────────────────────────
export function pkmnDuelPick(set, get, side, monId) {
  const p = get().showFight?.pkmn;
  if (!p || p.stage !== 'draft' || p.validated[side]) return;
  const cur = p.picks[side];
  const has = cur.includes(monId);
  if (!has && (cur.length >= 3 || !p.offers[side].some((m) => m.id === monId))) return;
  patchPkmn(set, get, { picks: { ...p.picks, [side]: has ? cur.filter((x) => x !== monId) : [...cur, monId] } });
}

export function pkmnDuelValidate(set, get, side) {
  const p = get().showFight?.pkmn;
  if (!p || p.stage !== 'draft' || p.validated[side] || p.picks[side].length !== 3) return;
  const validated = { ...p.validated, [side]: true };
  if (!(validated.A && validated.B)) { patchPkmn(set, get, { validated }); return; }
  // Les deux équipes ont validé → le combat commence.
  const team = (k) => p.picks[k].map((id) => p.offers[k].find((m) => m.id === id));
  hostBattle = createBattle(team('A'), team('B'));
  const view = snapshotView(hostBattle);
  // Entrée en scène : les deux dresseurs lancent leur pokéball (arc + flash),
  // les Pokémon se matérialisent (~1,4 s), cris calés sur l'apparition.
  patchPkmn(set, get, { validated, stage: 'battle', view, dialog: tg('fight.pkmn.begin'), anim: { enter: 'both' } });
  setTimeout(() => playCry(view.A.fighters[0].cry), 650);
  setTimeout(() => playCry(view.B.fighters[0].cry), 1050);
  setTimeout(() => {
    const cur = get().showFight?.pkmn;
    if (cur?.stage === 'battle' && cur.phaseB === 'choose') patchPkmn(set, get, { dialog: tg('fight.pkmn.chooseAction'), anim: null });
  }, 1800);
}

// ── Choix secrets d'un tour ──────────────────────────────────────────────────
export function pkmnDuelChoose(set, get, side, action) {
  const p = get().showFight?.pkmn;
  if (!p || p.stage !== 'battle' || p.phaseB !== 'choose' || p.choice[side] || !hostBattle) return;
  if (!action || (action.type !== 'move' && action.type !== 'switch')) return;
  const index = Number(action.index);
  if (!Number.isInteger(index) || index < 0 || index > 3) return;
  if (action.type === 'switch') {
    const target = hostBattle.sides[side].fighters[index];
    if (!target || target.ko || index === hostBattle.sides[side].active) return;
  }
  const choice = { ...p.choice, [side]: { type: action.type, index } };
  if (!(choice.A && choice.B)) { patchPkmn(set, get, { choice }); return; }
  // Résolution hôte : moteur pur puis REJEU séquencé des événements.
  const seq = (p.seq || 0) + 1;
  patchPkmn(set, get, { choice, phaseB: 'anim', seq });
  const events = resolveTurn(hostBattle, choice);
  playHostEvents(set, get, seq, events);
}

export function pkmnDuelReplace(set, get, side, index) {
  const p = get().showFight?.pkmn;
  if (!p || p.stage !== 'battle' || p.phaseB !== 'replace' || p.replaceSide !== side || !hostBattle) return;
  const seq = (p.seq || 0) + 1;
  patchPkmn(set, get, { phaseB: 'anim', replaceSide: null, seq });
  const events = sendReplacement(hostBattle, side, Number(index));
  playHostEvents(set, get, seq, events);
}

// ── Rejeu séquencé (minuteries hôte, jeton seq anti-périmé) ─────────────────
let vfxSeq = 0;

function playHostEvents(set, get, seq, events) {
  // Couche présentation : on intercale les phases de RAPPEL dans la pokéball
  // (événements synthétiques, le moteur pur ne bouge pas) — switch volontaire
  // = rappel AVANT l'envoi ; K.O. = évanouissement PUIS rappel au rayon rouge.
  const queue = [];
  for (const e of events) {
    if (e.kind === 'switch') queue.push({ kind: 'recall', side: e.side }, e);
    else if (e.kind === 'ko') queue.push(e, { kind: 'recall', side: e.side, ko: true });
    else queue.push(e);
  }
  const step = () => {
    const p = get().showFight?.pkmn;
    if (!p || p.seq !== seq) return; // combat clos ou tour redémarré
    const e = queue.shift();
    if (!e) { afterHostTurn(set, get, seq); return; }
    const delay = applyHostEvent(set, get, e);
    setTimeout(step, delay);
  };
  step();
}

// Applique un événement à la vue publiée ; retourne la durée d'affichage.
function applyHostEvent(set, get, e) {
  const p = get().showFight?.pkmn;
  if (!p) return 0;
  const view = structuredClone(p.view);
  const nameOf = (side) => view[side].fighters[view[side].active].name;
  let dialog = p.dialog;
  let anim = null;
  let vfx = p.vfx;
  let delay = 800;

  switch (e.kind) {
    // Rappel dans la pokéball (événement synthétique de présentation).
    case 'recall': {
      const f = view[e.side].fighters[view[e.side].active];
      // Remplaçant après K.O. : le rappel a déjà été joué juste après le K.O.
      if (!e.ko && f.ko) { delay = 0; break; }
      anim = { recall: e.side };
      if (!e.ko) dialog = tg('fight.pkmn.comeBack', { name: f.name });
      delay = e.ko ? 800 : 900;
      break;
    }
    case 'switch': {
      view[e.side].active = e.index;
      view[e.side].fighters[e.index].boosts = { atk: 0, def: 0, spc: 0, spe: 0 };
      dialog = tg('fight.pkmn.sendOut', { team: teamName(get, e.side), name: e.name });
      anim = { enter: e.side }; // pokéball + matérialisation
      const cry = view[e.side].fighters[e.index].cry;
      setTimeout(() => playCry(cry), 700);
      delay = 1550;
      break;
    }
    case 'move': {
      dialog = tg('fight.pkmn.uses', { name: nameOf(e.side), move: e.move });
      // VFX directionnel : l'animation part du lanceur vers la cible (ou joue
      // sur soi pour les buffs) — mêmes archétypes que la surface tactile.
      const arch = archetypeForMove(e.move, e.type);
      const target = e.side === 'A' ? 'B' : 'A';
      vfx = {
        archetype: arch, type: e.type || 'normal', from: e.side,
        side: SELF_ARCHETYPES.has(arch) ? e.side : target, seq: ++vfxSeq,
      };
      // Contact → ruée ; à distance/statut → pulsation d'incantation.
      anim = CONTACT_ARCHETYPES.has(arch) ? { lunge: e.side } : { cast: e.side };
      delay = CONTACT_ARCHETYPES.has(arch) ? 800 : 900;
      break;
    }
    case 'damage': {
      soundKatana();
      const f = view[e.side].fighters[view[e.side].active];
      f.hp = Math.max(0, f.hp - e.dmg);
      anim = { hit: e.side }; // le VFX d'attaque (posé au 'move') arrive à l'impact
      if (e.crit) { dialog = tg('fight.pkmn.crit'); delay = 1000; }
      else if (e.mult >= 2) { soundPower(); dialog = tg('fight.pkmn.superEff'); delay = 1050; }
      else if (e.mult > 0 && e.mult < 1) { dialog = tg('fight.pkmn.notEff'); delay = 1050; }
      else delay = 850;
      break;
    }
    case 'immune': dialog = tg('fight.pkmn.immune', { name: nameOf(e.side) }); delay = 950; break;
    case 'miss': dialog = tg('fight.pkmn.miss'); delay = 850; break;
    case 'fail': dialog = tg('fight.pkmn.fail'); delay = 750; break;
    case 'ailment': {
      view[e.side].fighters[view[e.side].active].status = e.ailment;
      dialog = tg(`fight.pkmn.st.${e.ailment}`, { name: nameOf(e.side) });
      delay = 950;
      break;
    }
    case 'boost': {
      const f = view[e.side].fighters[view[e.side].active];
      f.boosts[e.stat] = Math.max(-2, Math.min(2, f.boosts[e.stat] + e.delta));
      dialog = tg(e.delta > 0 ? 'fight.pkmn.boostUp' : 'fight.pkmn.boostDown', {
        name: nameOf(e.side), stat: STAT_FR[e.stat], much: Math.abs(e.delta) >= 2 ? tg('fight.pkmn.much') : '',
      });
      delay = 900;
      break;
    }
    case 'asleep': dialog = tg('fight.pkmn.asleep', { name: nameOf(e.side) }); delay = 850; break;
    case 'wake': view[e.side].fighters[view[e.side].active].status = null; dialog = tg('fight.pkmn.wake', { name: nameOf(e.side) }); delay = 850; break;
    case 'paralyzed': dialog = tg('fight.pkmn.paralyzed', { name: nameOf(e.side) }); delay = 900; break;
    case 'poison': {
      const f = view[e.side].fighters[view[e.side].active];
      f.hp = Math.max(0, f.hp - e.dmg);
      dialog = tg('fight.pkmn.poisonHurt', { name: nameOf(e.side) });
      vfx = { archetype: 'spores', type: 'poison', from: e.side, side: e.side, seq: ++vfxSeq };
      delay = 900;
      break;
    }
    case 'ko': {
      const f = view[e.side].fighters[view[e.side].active];
      f.hp = 0; f.ko = true;
      anim = { faint: e.side };
      playCry(f.cry);
      dialog = tg('fight.pkmn.ko', { name: e.name });
      delay = 1300;
      break;
    }
    case 'win': delay = 200; break; // géré par afterHostTurn
    default: delay = 300; break;
  }
  patchPkmn(set, get, { view, dialog, anim, vfx });
  return delay;
}

function teamName(get, side) {
  const f = get().showFight;
  const teams = get().teams || [];
  const idx = side === 'A' ? f?.attackerIndex : f?.defenderIndex;
  return teams[idx]?.name || '';
}

function afterHostTurn(set, get, seq) {
  const p = get().showFight?.pkmn;
  if (!p || p.seq !== seq || !hostBattle) return;
  if (hostBattle.winner) {
    const side = hostBattle.winner;
    patchPkmn(set, get, { phaseB: 'over', winner: side, anim: null, dialog: tg('fight.pkmn.win', { team: teamName(get, side) }) });
    soundEvent();
    setTimeout(() => {
      const cur = get().showFight?.pkmn;
      if (cur?.winner === side) get().fightMatchWin(side === 'A' ? 'attacker' : 'defender');
    }, 2200);
  } else if (hostBattle.pendingSwitch) {
    patchPkmn(set, get, {
      phaseB: 'replace', replaceSide: hostBattle.pendingSwitch, anim: null,
      choice: { A: null, B: null },
      dialog: tg('fight.pkmn.sendNext', { team: teamName(get, hostBattle.pendingSwitch) }),
    });
  } else {
    patchPkmn(set, get, { phaseB: 'choose', choice: { A: null, B: null }, anim: null, dialog: tg('fight.pkmn.chooseAction') });
  }
}
