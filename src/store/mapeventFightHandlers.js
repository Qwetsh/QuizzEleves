// Duel « LIEU → ÉVÉNEMENT » (Chroniques de la Terre du Milieu) PILOTÉ PAR LE
// STORE — multi-surface : l'hôte (écran partagé TV, ou hôte en ligne) est
// l'autorité. Comme les échecs / le hacking / le duel de sorciers, il tourne
// AUSSI en ligne : aucun écran tactile partagé requis, les DEUX camps voient la
// MÊME cible marquée sur la carte et courent au bon événement depuis leur
// appareil (COURSE, motif du duel éclair).
//
// Best-of-3 NORMAL (PAS pointsBased) : à la bonne réponse d'un camp →
// fightRoundWin(side) puis MANCHE SUIVANTE (nouvelle cible), motif de
// checkMemoryBoardEnd/freshBoard dans memoryFightHandlers. Une mauvaise réponse
// verrouille le camp fautif un court instant (course : l'autre peut trouver).
//
// SECRET (anti-triche) : le `correctId` de la manche EN COURS vit MODULE-LEVEL
// (comme wizard/chess/hack), JAMAIS dans showFight tant que la manche n'est pas
// révélée. `target` (le lieu marqué) et `choices` (4 événements SANS indiquer le
// bon) sont PUBLICS : c'est l'énoncé. Le `correctId` n'entre dans showFight
// (reveal.correctId) qu'à la révélation, manche finie.
import { drawMapeventRound } from '../logic/mapeventDuel.js';
import { LOTR_EVENTS } from '../data/lotrEvents.js';
import { fightRoundWin, serveRaceQuestion } from './fightHandlers.js';

export const MAPEVENT_WRONG_HOLD_MS = 1400; // mauvaise réponse : verrou court du camp fautif
export const MAPEVENT_REVEAL_MS = 1400;     // bonne réponse : révélation avant la manche suivante
export const MAPEVENT_UNIVERSE = 'terre_du_milieu_atlas';

const SIDES = ['attacker', 'defender'];

// SECRET d'autorité (non sérialisé) : id du bon choix de la manche courante +
// anti-répétition des lieux servis. Réinitialisés au démarrage de chaque duel.
let correctId = null;
let served = new Set();

// État PUBLIC d'une manche neuve depuis un tirage (secret gardé à part). `roundNo`
// pour la continuité d'affichage. Retourne null si le tirage échoue (< 4 lieux).
function freshRound(roundNo) {
  const round = drawMapeventRound(LOTR_EVENTS, { served });
  if (!round) return null;
  correctId = round.correctId; // secret module-level
  return {
    roundNo,
    universe: MAPEVENT_UNIVERSE,
    target: round.target,                                  // lieu marqué (public : c'est l'énoncé)
    choices: round.choices,                                // 4 choix SANS le flag correct
    locked: { attacker: false, defender: false },
    reveal: null,                                          // { winner, correctId } à la révélation
    seq: 0,
  };
}

// Démarre le duel : RESET du secret + de l'anti-répétition, 1re manche. Si le
// tirage échoue (données absentes) → repli propre sur le duel éclair
// (serveRaceQuestion) plutôt qu'un soft-lock.
export function startMapeventDuel(set, get) {
  const f = get().showFight;
  if (!f) return;
  correctId = null;
  served = new Set();
  const round = freshRound(1);
  if (!round) {
    set({ showFight: { ...f, phase: 'minigame' } });
    serveRaceQuestion(set, get);
    return;
  }
  set({ showFight: { ...f, phase: 'minigame', mapevent: round } });
}

// Un duelliste (attaquant OU défenseur — c'est une course) désigne un choix. Bon
// choix → révélation puis manche gagnée (best-of-3) + manche suivante. Mauvais
// choix → verrou court du camp fautif (l'autre peut encore trouver).
export function mapeventAnswer(set, get, side, choiceId) {
  const f = get().showFight;
  const mv = f?.mapevent;
  if (!mv || f.phase !== 'minigame' || mv.reveal) return;
  if (!SIDES.includes(side)) return;
  if (mv.locked[side]) return;       // camp verrouillé (mauvaise réponse récente)

  // MAUVAISE réponse : verrou court du camp fautif (jeton seq anti-minuterie périmée).
  if (choiceId !== correctId) {
    const seq = (mv.seq || 0) + 1;
    set({ showFight: { ...f, mapevent: { ...mv, locked: { ...mv.locked, [side]: true }, seq } } });
    setTimeout(() => {
      const cur = get().showFight;
      const cm = cur?.mapevent;
      if (!cm || cm.seq !== seq || cur.phase !== 'minigame' || cm.reveal) return;
      if (!cm.locked[side]) return;
      set({ showFight: { ...cur, mapevent: { ...cm, locked: { ...cm.locked, [side]: false } } } });
    }, MAPEVENT_WRONG_HOLD_MS);
    return;
  }

  // BONNE réponse : révélation (le correctId sort ENFIN, dans reveal), puis on
  // marque la manche et — si le combat continue — on distribue une manche neuve.
  const seq = (mv.seq || 0) + 1;
  set({
    showFight: {
      ...f,
      mapevent: {
        ...mv,
        reveal: { winner: side, correctId },
        locked: { attacker: false, defender: false },
        seq,
      },
    },
  });
  setTimeout(() => {
    const cur = get().showFight;
    const cm = cur?.mapevent;
    if (!cm || cm.seq !== seq || cur.phase !== 'minigame' || !cm.reveal) return;
    fightRoundWin(set, get, side); // BO3 : peut passer en phase 'reward'
    // Le combat continue (manche suivante) → cible neuve + nouveau secret.
    const nf = get().showFight;
    if (nf && nf.phase === 'minigame' && !nf.winnerSide && nf.mapevent) {
      const round = freshRound(nf.mapevent.roundNo + 1);
      if (!round) { serveRaceQuestion(set, get); return; }
      set({ showFight: { ...nf, mapevent: round } });
    }
  }, MAPEVENT_REVEAL_MS);
}
