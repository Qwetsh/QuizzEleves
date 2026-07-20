// Duel de SORCIERS (« Priori Incantatem ») PILOTÉ PAR LE STORE — multi-surface :
// l'hôte (écran partagé TV, ou hôte en ligne) est l'autorité. Contrairement à
// memory/pkmn, ce duel tourne AUSSI en ligne (comme les échecs / le hacking) :
// aucun écran tactile partagé n'est requis, les DEUX camps répondent à la MÊME
// question depuis leur appareil — c'est une COURSE (motif du duel éclair).
//
// Modèle : un rai lumineux partagé sur l'axe [0..100] (moteur pur logic/wizardDuel).
//   - 50 = centre ; l'ATTAQUANT pousse vers 100, le DÉFENSEUR vers 0.
//   - une BONNE réponse pousse le rai vers l'adversaire ; une MAUVAISE réponse
//     VERROUILLE le camp fautif pendant un court instant (WIZARD_WRONG_HOLD_MS).
//   - quand le rai touche un camp (pos>=100 → attacker gagne ; pos<=0 → defender),
//     le duel est terminé → fightMatchWin(winner) (duel UNIQUE à mort, pointsBased :
//     PAS de best-of-3).
//
// SECRET (anti-triche) : la bonne réponse `q.c` NE SORT JAMAIS du payload ni du
// snapshot (strippée à la publication, EXACTEMENT comme le duel éclair `race.q.c`).
// L'état du rai (win/pos) est arbitré ICI ; un objet module-level (`beam`) porte la
// position d'autorité, showFight.wizard.pos en est le reflet public.
import { createBeam, pushBeam, checkAnswer } from '../logic/wizardDuel.js';
import { fightMatchWin, serveRaceQuestion } from './fightHandlers.js';

export const WIZARD_WRONG_HOLD_MS = 1400;  // mauvaise réponse : verrou court du camp fautif
export const WIZARD_HIT_MS = 1200;         // coup au but affiché avant la fin du duel

const SIDES = ['attacker', 'defender'];

// État d'AUTORITÉ du rai côté hôte (non sérialisé — showFight.wizard.pos en est le
// miroir public). Réinitialisé au démarrage de chaque duel.
let beam = createBeam();

// Vue publique d'une question SANS la bonne réponse (défense en profondeur : même
// si la publication strippe déjà `c`, on ne garde ici que ce que l'UI doit rendre).
// `c` RESTE dans l'objet showFight.wizard.q pour que l'hôte arbitre `checkAnswer`
// — ce sont sessionConfig / onlineSnapshot qui le retirent AVANT diffusion.

// Démarre le duel : rai au centre, 1re question. Si aucune question (pool vide) →
// repli propre sur le duel éclair (serveRaceQuestion) plutôt qu'un soft-lock.
export function startWizardDuel(set, get) {
  const f = get().showFight;
  if (!f) return;
  beam = createBeam();
  const q = get().fightPickQuestion(f.subject);
  if (!q) {
    // Pool vide (thème conteneur sans contenu chargé) : repli propre sur le duel
    // éclair. On passe d'abord en 'minigame' pour que serveRaceQuestion puisse
    // arbitrer (ses gardes exigent la phase minigame) — jamais de soft-lock.
    set({ showFight: { ...f, phase: 'minigame' } });
    serveRaceQuestion(set, get);
    return;
  }
  set({
    showFight: {
      ...f,
      phase: 'minigame',
      wizard: {
        pos: beam.pos,
        q,
        locked: { attacker: false, defender: false },
        push: null,
        hit: null,
        winner: null,
        seq: 0,
      },
    },
  });
}

// Un duelliste (attaquant OU défenseur — c'est une course) répond à la question
// COURANTE. L'hôte arbitre : bonne réponse → poussée du rai (+ éventuelle
// victoire) ; mauvaise réponse → verrou court du camp fautif.
export function wizardAnswer(set, get, side, index) {
  const f = get().showFight;
  const w = f?.wizard;
  if (!w || f.phase !== 'minigame' || w.winner) return;
  if (!SIDES.includes(side)) return;
  if (w.locked[side]) return;       // camp verrouillé (mauvaise réponse récente)
  if (!w.q) return;

  // MAUVAISE réponse : verrou court du camp fautif (jeton seq anti-minuterie périmée).
  if (!checkAnswer(w.q, index)) {
    const seq = (w.seq || 0) + 1;
    set({
      showFight: {
        ...f,
        wizard: { ...w, locked: { ...w.locked, [side]: true }, seq },
      },
    });
    setTimeout(() => {
      const cur = get().showFight;
      const cw = cur?.wizard;
      if (!cw || cw.seq !== seq || cur.phase !== 'minigame' || cw.winner) return;
      if (!cw.locked[side]) return;
      set({ showFight: { ...cur, wizard: { ...cw, locked: { ...cw.locked, [side]: false } } } });
    }, WIZARD_WRONG_HOLD_MS);
    return;
  }

  // BONNE réponse : pousse le rai vers l'adversaire.
  beam = pushBeam(beam, side);
  const seq = (w.seq || 0) + 1;

  // Le rai touche un camp → l'AUTRE gagne : coup au but, puis fin du duel.
  if (beam.winner) {
    const loser = beam.winner === 'attacker' ? 'defender' : 'attacker';
    set({
      showFight: {
        ...f,
        wizard: {
          ...w,
          pos: beam.pos,
          push: { side, seq },
          hit: { side: loser, seq },
          winner: beam.winner,
          locked: { ...w.locked, [side]: false },
          seq,
        },
      },
    });
    setTimeout(() => {
      const cur = get().showFight;
      const cw = cur?.wizard;
      if (!cw || cw.seq !== seq || cur.phase !== 'minigame' || cw.winner !== beam.winner) return;
      fightMatchWin(set, get, beam.winner); // duel unique → phase reward / winnerSide
    }, WIZARD_HIT_MS);
    return;
  }

  // Pas encore de vainqueur : SERT une nouvelle question (reset des verrous) et
  // republie le rai poussé. fightPickQuestion gère l'anti-répétition (askedQuestions).
  const nextQ = get().fightPickQuestion(f.subject);
  if (!nextQ) { serveRaceQuestion(set, get); return; } // plus de question : repli course
  set({
    showFight: {
      ...get().showFight,
      wizard: {
        ...w,
        pos: beam.pos,
        q: nextQ,
        locked: { attacker: false, defender: false },
        push: { side, seq },
        hit: null,
        winner: null,
        seq,
      },
    },
  });
}
