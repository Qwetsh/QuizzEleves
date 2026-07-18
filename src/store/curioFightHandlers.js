// Duel Curioscope PILOTÉ PAR LE STORE — surfaces « écran + téléphones » et
// « en ligne » : l'hôte est l'autorité (cibles, marques, scores), chaque
// duelliste place son pin depuis SON écran (intents turnCurio*), l'écran
// partagé n'affiche que la photo puis la révélation.
//
// La surface TACTILE garde le moteur composant (Curioscope.jsx + PlacementDuel,
// état local) : les deux équipes jouent côte à côte sur le même écran.
//
// SECRETS (anti-triche) : tant que `reveal` est null, la position de la CIBLE
// (target.x/y, et son label sauf mode « Place : X »), et les MARQUES des deux
// équipes ne quittent jamais l'hôte — strippés par buildTurnPayload
// (sessionConfig) et serializeSnapshot (onlineSnapshot).
//
// showFight.curio = {
//   universes, roundNo, scores: {attacker, defender}, usedIds,
//   target: { id, label, x, y, universe, image, showName } | null,
//   marks: { attacker: {x,y}|null, defender }, validated: { attacker, defender },
//   reveal: null | { dA, dB, pA, pB },
// }
import {
  getUniverse, universeMetric, universeScore, pickSpot, spotPhoto, CURIO_TARGET_SCORE,
} from '../data/universes.js';

export function startCurioDuel(set, get, universes) {
  const f = get().showFight;
  if (!f) return;
  set({
    showFight: {
      ...f,
      phase: 'minigame',
      curio: {
        universes,
        roundNo: 1,
        scores: { attacker: 0, defender: 0 },
        usedIds: [],
        target: null,
        marks: { attacker: null, defender: null },
        validated: { attacker: false, defender: false },
        reveal: null,
      },
    },
  });
  newTarget(set, get);
}

// Tire la cible de la manche courante (rotation d'univers + LRU + exclusion
// intra-duel). Plus aucune cible → le duel se départage au score courant.
function newTarget(set, get) {
  const f = get().showFight;
  const c = f?.curio;
  if (!c) return;
  const uid = c.universes[(c.roundNo - 1) % c.universes.length];
  const u = getUniverse(uid);
  const spot = u ? pickSpot(u, (get().curioSeen || {})[uid] || {}, c.roundNo, new Set(c.usedIds)) : null;
  if (!spot) {
    get().fightMatchWin(c.scores.defender > c.scores.attacker ? 'defender' : 'attacker');
    return;
  }
  get().curioMarkSeen(uid, spot.id);
  set({
    showFight: {
      ...get().showFight,
      curio: {
        ...c,
        usedIds: [...c.usedIds, spot.id],
        target: {
          id: spot.id, label: spot.label, x: spot.x, y: spot.y,
          universe: uid, image: spotPhoto(spot) || null, showName: !!spot.showName,
        },
        marks: { attacker: null, defender: null },
        validated: { attacker: false, defender: false },
        reveal: null,
      },
    },
  });
}

const SIDES = ['attacker', 'defender'];
const validPos = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

// Pose (ou ajuste) la marque d'un camp — sans valider.
export function curioDuelPlace(set, get, side, pos) {
  const f = get().showFight;
  const c = f?.curio;
  if (!c || !c.target || c.reveal || !SIDES.includes(side) || c.validated[side] || !validPos(pos)) return;
  set({ showFight: { ...f, curio: { ...c, marks: { ...c.marks, [side]: { x: pos.x, y: pos.y } } } } });
}

// Valide le camp (avec position finale optionnelle : les intents téléphone
// envoient place+validate en un seul message). Les deux validés → révélation.
export function curioDuelValidate(set, get, side, pos = null) {
  if (validPos(pos)) curioDuelPlace(set, get, side, pos);
  const f = get().showFight;
  const c = f?.curio;
  if (!c || !c.target || c.reveal || !SIDES.includes(side) || c.validated[side] || !c.marks[side]) return;
  const validated = { ...c.validated, [side]: true };
  if (!validated.attacker || !validated.defender) {
    set({ showFight: { ...f, curio: { ...c, validated } } });
    return;
  }
  const u = getUniverse(c.target.universe);
  const dA = universeMetric(u, c.marks.attacker, c.target);
  const dB = universeMetric(u, c.marks.defender, c.target);
  const pA = universeScore(u, dA);
  const pB = universeScore(u, dB);
  set({
    showFight: {
      ...f,
      curio: {
        ...c,
        validated,
        scores: { attacker: c.scores.attacker + pA, defender: c.scores.defender + pB },
        reveal: { dA, dB, pA, pB },
      },
    },
  });
}

// Manche suivante (après révélation) — ou victoire directe à 10 000 pts.
export function curioDuelNext(set, get) {
  const f = get().showFight;
  const c = f?.curio;
  if (!c || !c.reveal) return;
  const { attacker, defender } = c.scores;
  if ((attacker >= CURIO_TARGET_SCORE || defender >= CURIO_TARGET_SCORE) && attacker !== defender) {
    get().fightMatchWin(attacker > defender ? 'attacker' : 'defender');
    return;
  }
  set({ showFight: { ...f, curio: { ...c, roundNo: c.roundNo + 1 } } });
  newTarget(set, get);
}
