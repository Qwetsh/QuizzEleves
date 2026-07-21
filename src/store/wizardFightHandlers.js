// Duel de SORTS (rythme, façon Guitar Hero) PILOTÉ PAR LE STORE — multi-surface :
// l'hôte (écran partagé TV, ou hôte en ligne) est l'autorité. Comme les échecs /
// le hacking, ce duel tourne sur les 3 surfaces. Des ÉVÉNEMENTS du lore tombent
// vers une ligne de tir ; en bas, une « main » de 4 sorts renouvelée par vagues.
// Chaque camp tape le bon sort AU BON MOMENT depuis son appareil ; les DEUX jouent
// la MÊME partition en simultané. Le meilleur score gagne (l'écart pousse le rai
// partagé — K.O. possible avant la fin).
//
// SYNCHRO SANS HORLOGE PARTAGÉE : l'hôte génère la partition ENTIÈRE (vagues +
// notes + timings + labels) et la PUBLIE (état public). Chaque surface fait tomber
// les notes sur SON horloge locale et JUGE le timing en local (zéro lag ressenti) ;
// le tap envoie { noteId, spellIndex, dt } et l'hôte convertit en points (barème
// unique côté hôte). Fin de « chanson » = timer d'AUTORITÉ côté hôte (généreux :
// couvre le décalage de démarrage local des surfaces + la latence des derniers taps).
//
// SECRET (anti-triche) : la CLÉ de réponse (quel sort de la main est correct pour
// chaque note) NE QUITTE JAMAIS l'hôte — elle vit module-level (`auth.key`), jamais
// dans showFight.wizard. Rien à stripper à la publication (la partition publique ne
// porte que les labels + les 4 sorts, jamais l'index correct). Même discipline que
// le `correctId` du duel mapevent / les `answer` du hacking.
import { buildChart, scoreHit, beamFromScores, finalWinner } from '../logic/spellHero.js';
import { spellPackFor } from '../components/Fight/minigames/index.js';
import { fightMatchWin, serveRaceQuestion } from './fightHandlers.js';

export const WIZARD_HIT_MS = 1200;            // coup au but affiché avant la fin du duel
export const SONG_LEAD_MS = 800;              // délai avant le « top départ » (laisse les surfaces recevoir l'état)
export const SONG_FINALIZE_BUFFER_MS = 3500;  // marge du timer de fin (latence réseau + démarrage local décalé)

const SIDES = ['attacker', 'defender'];

// Introspection HÔTE-ONLY (tests) : la clé de réponse vit ici, jamais côté client.
export function _peekAnswerKey() {
  return auth ? auth.key : null;
}

// État d'AUTORITÉ côté hôte (non sérialisé) : la clé secrète, l'index des notes et
// le dédoublonnage des taps. `token` garde les minuteries périmées (duel remplacé).
// Réinitialisé au démarrage de chaque duel.
let auth = null;

// Démarre le duel : génère la partition depuis le pack de sorts du thème, publie
// l'état public, arme le timer d'autorité de fin. Repli propre (duel éclair) si le
// thème n'a pas de pack de sorts jouable.
export function startWizardDuel(set, get) {
  const f = get().showFight;
  if (!f) return;
  const pool = spellPackFor(f.subject);
  const chart = pool ? buildChart(pool) : null;
  if (!chart) {
    // Pas de pack (thème conteneur / testeur hors périmètre) : repli sur le duel
    // éclair. On passe d'abord en 'minigame' (garde de serveRaceQuestion).
    set({ showFight: { ...f, phase: 'minigame' } });
    serveRaceQuestion(set, get);
    return;
  }

  const token = (auth?.token || 0) + 1;
  const notesById = {};
  for (const n of chart.notes) notesById[n.id] = n;
  auth = { key: chart.key, notesById, done: { attacker: {}, defender: {} }, token };

  const songStartAt = Date.now() + SONG_LEAD_MS;
  set({
    showFight: {
      ...f,
      phase: 'minigame',
      wizard: {
        mode: 'rhythm',
        songStartAt,
        // Partition PUBLIQUE — la clé (chart.key) n'y figure PAS (elle reste dans auth).
        chart: { waves: chart.waves, notes: chart.notes, duration: chart.duration },
        scores: { attacker: 0, defender: 0 },
        combos: { attacker: 0, defender: 0 },
        pos: 50,
        // dernier tap résolu PAR CAMP { noteId, verdict, points, seq } (feedback piste ;
        // par camp pour que les 2 pistes de l'écran partagé ne se marchent pas dessus).
        last: { attacker: null, defender: null },
        push: null,   // { side, seq } → anim de poussée du rai
        hit: null,    // { side, seq } → anim d'impact (K.O.)
        winner: null,
        seq: 0,
      },
    },
  });

  // Fin de chanson : l'hôte tranche au meilleur score (généreux pour laisser tout
  // le monde finir). Un K.O. en cours de route court-circuite ce timer (garde token).
  setTimeout(
    () => finalizeSong(set, get, token),
    SONG_LEAD_MS + chart.duration + SONG_FINALIZE_BUFFER_MS,
  );
}

// Un camp tape un sort pour une note (jugé en local sur son appareil : dt = erreur
// de timing signée en ms). L'hôte valide le bon sort (clé secrète), convertit en
// points (+ combo), met à jour le rai et détecte le K.O.
export function wizardHit(set, get, side, noteId, spellIndex, dt) {
  const f = get().showFight;
  const w = f?.wizard;
  if (!w || w.mode !== 'rhythm' || f.phase !== 'minigame' || w.winner) return;
  if (!SIDES.includes(side) || !auth) return;

  const nid = Number(noteId);
  if (!auth.notesById[nid]) return;            // note inconnue → ignore
  if (auth.done[side][nid] != null) return;    // déjà résolue par ce camp → anti double-compte

  const correct = auth.key[nid] === Number(spellIndex);
  const r = scoreHit(dt, correct, w.combos[side] || 0);
  auth.done[side][nid] = r.verdict;

  const scores = { ...w.scores, [side]: (w.scores[side] || 0) + r.points };
  const combos = { ...w.combos, [side]: r.combo };
  const beam = beamFromScores(scores.attacker, scores.defender);
  const seq = (w.seq || 0) + 1;
  const token = auth.token;

  set({
    showFight: {
      ...f,
      wizard: {
        ...w,
        scores,
        combos,
        pos: beam.pos,
        last: { ...w.last, [side]: { noteId: nid, verdict: r.verdict, points: r.points, seq } },
        push: r.points > 0 ? { side, seq } : w.push, // ne pousse le rai que sur un tap gagnant
        seq,
      },
    },
  });

  if (beam.winner) concludeDuel(set, get, token, beam.winner, true); // K.O. avant la fin
}

// Fin de « chanson » (timer d'autorité) : meilleur score gagne, sauf si un K.O. a
// déjà tranché (winner posé) ou si le duel n'est plus en phase minigame.
function finalizeSong(set, get, token) {
  if (!auth || auth.token !== token) return;
  const f = get().showFight;
  const w = f?.wizard;
  if (!w || f.phase !== 'minigame' || w.winner) return;
  concludeDuel(set, get, token, finalWinner(w.scores.attacker, w.scores.defender), false);
}

// Conclut le duel : pose le vainqueur (+ impact K.O. optionnel), puis déclare la
// victoire au moteur après un court temps d'affichage. pointsBased → phase reward.
function concludeDuel(set, get, token, winner, ko) {
  const f = get().showFight;
  const w = f?.wizard;
  if (!w || w.winner) return;
  const loser = winner === 'attacker' ? 'defender' : 'attacker';
  const seq = (w.seq || 0) + 1;
  set({
    showFight: {
      ...f,
      wizard: { ...w, winner, hit: ko ? { side: loser, seq } : null, seq },
    },
  });
  setTimeout(() => {
    if (!auth || auth.token !== token) return;
    const cur = get().showFight;
    if (!cur?.wizard || cur.wizard.winner !== winner || cur.phase !== 'minigame') return;
    fightMatchWin(set, get, winner); // duel unique → phase reward / winnerSide
  }, WIZARD_HIT_MS);
}
