// Duel de HACKING « Cyber-duel » (thème informatique_numerique) PILOTÉ PAR LE
// STORE — multi-surface : l'hôte (écran partagé TV, ou hôte en ligne) est
// l'autorité (choix du langage par camp, tirage des énigmes, moteur
// logic/hackPuzzle, minuteries de blocage / révélation, victoire de manche BO3).
// Chaque duelliste choisit SON langage puis remplit SES trous depuis son
// appareil (intents turnHackLang / turnHackPick). Comme les échecs, ce duel
// tourne AUSSI en ligne : chaque camp voit SON terminal, aucun écran tactile
// partagé requis.
//
// SECRET (anti-triche) : la RÉPONSE de chaque trou (blanks[i].answer) et le
// puzzle complet + l'état de remplissage (createHackState) restent MODULE-LEVEL
// (hostStates) — JAMAIS dans showFight, donc jamais publiés. showFight.hack ne
// contient que du PUBLIC : les `choices` de chaque trou (4 tokens), les lignes de
// code, la progression. Un camp ne peut pas copier l'autre : chaque camp a SON
// langage et SES énigmes.
//
// SPÉCIFICITÉ vs échecs : CHOIX DE LANGAGE par camp au début du duel (une fois
// pour tout le duel), puis remplissage des trous DANS L'ORDRE. Le duel ne
// démarre (`started`) que quand les DEUX camps ont choisi leur langage.
//
// showFight.hack = {
//   roundNo,                             // manche courante (1, 2, 3…)
//   langs: { attacker, defender },       // langages choisis (null tant que pas choisi)
//   started,                             // true quand les 2 ont choisi → énigmes servies
//   sides: {
//     attacker: null | { lang, title, titleEn, lines, blanks:[{choices:[4]}],
//                        cur, filled:[token…], breach, solved, locked, denySeq },
//     defender: { …idem },
//   },
//   reveal: null | { winner: 'attacker'|'defender' },
//   seq,                                 // jeton anti-minuterie-périmée
// }
import hackData from '../data/hackPuzzles.json';
import { pickPuzzle, createHackState, fillBlank, breachPct } from '../logic/hackPuzzle.js';

export const HACK_WRONG_HOLD_MS = 1200;   // token faux : blocage court (secousse)
export const HACK_REVEAL_MS = 1200;       // manche gagnée : « brèche » affichée avant la suite

const SIDES = ['attacker', 'defender'];

// SECRET côté hôte : état de remplissage (puzzle complet avec réponses) par camp
// (non sérialisé, jamais publié). Réinitialisé au démarrage de chaque duel.
let hostStates = { attacker: null, defender: null };
// Anti-répétition par (CAMP + LANGAGE) : un même puzzle ne retombe pas deux fois
// pour un couple camp/langage sur la durée du combat (recyclé si le pool
// s'épuise — géré par pickPuzzle via le Set `served` muté en place).
let servedIds = { attacker: null, defender: null };

// Difficulté d'une manche : manche 1 → niveau 1, manche 2 → niveau 2, 3+ → niveau 3.
function levelForRound(roundNo) {
  return roundNo >= 3 ? 3 : roundNo;
}

// Vue PUBLIQUE d'un camp à partir de son état hôte (aucun secret : les `answer`
// des trous ne sont PAS copiés, seulement les `choices` — les 4 tokens visibles).
function publicSide(hostState) {
  const p = hostState.puzzle;
  return {
    lang: p.lang,
    title: p.title,
    titleEn: p.titleEn,
    lines: p.lines,
    blanks: (p.blanks || []).map((b) => ({ choices: b.choices })), // PAS b.answer
    cur: hostState.cur,
    filled: [...hostState.filled],
    breach: breachPct(hostState),
    solved: hostState.solved,
    locked: false,
    denySeq: 0,
  };
}

export function startHackDuel(set, get) {
  const f = get().showFight;
  if (!f) return;
  // RESET l'état hôte et l'anti-répétition au démarrage d'un nouveau duel.
  hostStates = { attacker: null, defender: null };
  servedIds = { attacker: new Set(), defender: new Set() };
  set({
    showFight: {
      ...f,
      phase: 'minigame',
      hack: {
        roundNo: 1,
        langs: { attacker: null, defender: null },
        started: false,
        sides: { attacker: null, defender: null },
        reveal: null,
        seq: 0,
      },
    },
  });
}

// Sert une énigme fraîche à un camp (langage figé) pour la manche `roundNo` :
// initialise l'état hôte module-level et construit la vue publique. Retourne le
// bloc public (ou null si le langage n'a aucune énigme — garde-fou : isPlayable
// exclut le duel en amont si le JSON est vide, mais un langage exotique pourrait
// n'avoir rien).
function servePuzzle(side, lang, roundNo) {
  const level = levelForRound(roundNo);
  const puzzle = pickPuzzle(hackData.puzzles, { lang, level, served: servedIds[side] });
  if (!puzzle) return null;
  hostStates[side] = createHackState(puzzle);
  return publicSide(hostStates[side]);
}

// Un duelliste choisit SON langage (une fois pour tout le duel). Ignoré si déjà
// choisi ou si le duel a déjà démarré. Quand les DEUX camps ont choisi, on sert
// une énigme à chacun (dans SON langage, à la difficulté de la manche) et le duel
// démarre (started=true).
export function hackDuelLang(set, get, side, lang) {
  const f = get().showFight;
  const h = f?.hack;
  if (!h || f.phase !== 'minigame' || h.started) return;
  if (!SIDES.includes(side) || !lang) return;
  if (h.langs[side]) return; // déjà choisi
  const langs = { ...h.langs, [side]: lang };
  // Un seul camp a choisi → on attend l'autre (pas encore démarré).
  if (!langs.attacker || !langs.defender) {
    set({ showFight: { ...f, hack: { ...h, langs } } });
    return;
  }
  // Les deux ont choisi → on sert une énigme à chaque camp (motif freshRound).
  const sa = servePuzzle('attacker', langs.attacker, h.roundNo);
  const sd = servePuzzle('defender', langs.defender, h.roundNo);
  set({
    showFight: {
      ...f,
      hack: { ...h, langs, started: true, sides: { attacker: sa, defender: sd } },
    },
  });
}

// Prépare une manche NEUVE (mêmes langages, roundNo suivant, nouvelles énigmes) :
// nouveaux états hôte + vues publiques. Retourne le bloc showFight.hack.
function freshRound(prevHack, roundNo) {
  const { attacker, defender } = prevHack.langs;
  const sa = servePuzzle('attacker', attacker, roundNo);
  const sd = servePuzzle('defender', defender, roundNo);
  return {
    roundNo,
    langs: prevHack.langs,
    started: true,
    sides: { attacker: sa, defender: sd },
    reveal: null,
    seq: 0,
  };
}

// Un duelliste tente de remplir le trou COURANT de SON énigme avec `token`.
// L'hôte arbitre via le moteur pur (fillBlank) : bon token → avance / résout ;
// mauvais token → blocage court (denySeq++ + verrou relevé après minuterie).
export function hackDuelPick(set, get, side, token) {
  const f = get().showFight;
  const h = f?.hack;
  if (!h || !h.started || f.phase !== 'minigame' || h.reveal) return;
  if (!SIDES.includes(side)) return;
  const pub = h.sides[side];
  const host = hostStates[side];
  if (!pub || !host || pub.locked || pub.solved) return;

  const verdict = fillBlank(host, token);

  // Mauvais token : blocage court (secousse via denySeq), puis on relève le verrou.
  if (verdict.wrong) {
    const seq = (h.seq || 0) + 1;
    const sides = { ...h.sides, [side]: { ...pub, locked: true, denySeq: (pub.denySeq || 0) + 1 } };
    set({ showFight: { ...f, hack: { ...h, sides, seq } } });
    setTimeout(() => {
      const cur = get().showFight;
      const hh = cur?.hack;
      if (!hh || hh.seq !== seq || cur.phase !== 'minigame' || hh.reveal) return;
      const s = hh.sides[side];
      if (!s?.locked) return;
      set({ showFight: { ...cur, hack: { ...hh, sides: { ...hh.sides, [side]: { ...s, locked: false } } } } });
    }, HACK_WRONG_HOLD_MS);
    return;
  }

  // Bon token : on republie la progression publique (filled/cur/breach) depuis
  // l'état hôte muté.
  const nextPub = {
    ...pub,
    cur: host.cur,
    filled: [...host.filled],
    breach: breachPct(host),
    solved: host.solved,
    locked: false,
  };

  // Dernier trou rempli → énigme résolue : le camp remporte la manche. On affiche
  // la révélation, puis on marque la manche (fightRoundWin) et, si le combat
  // continue, on sert une manche neuve (motif chess freshRound).
  if (verdict.solved) {
    const seq = (h.seq || 0) + 1;
    const sides = { ...h.sides, [side]: nextPub };
    set({ showFight: { ...f, hack: { ...h, sides, reveal: { winner: side }, seq } } });
    setTimeout(() => {
      const cur = get().showFight;
      const hh = cur?.hack;
      if (!hh || hh.seq !== seq || cur.phase !== 'minigame' || hh.reveal?.winner !== side) return;
      get().fightRoundWin(side); // BO3 : peut passer en phase 'reward'
      const nf = get().showFight;
      if (nf && nf.phase === 'minigame' && !nf.winnerSide && nf.hack) {
        set({ showFight: { ...nf, hack: freshRound(nf.hack, nf.hack.roundNo + 1) } });
      }
    }, HACK_REVEAL_MS);
    return;
  }

  // Trou intermédiaire correct : on avance simplement.
  const sides = { ...h.sides, [side]: nextPub };
  set({ showFight: { ...f, hack: { ...h, sides } } });
}
