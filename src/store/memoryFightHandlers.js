// Duel Memory PILOTÉ PAR LE STORE — surface « écran + téléphones » : l'hôte
// (TBI) est l'autorité (plateau, retournements, scores, minuteries), chaque
// duelliste retourne les cartes depuis SON téléphone quand c'est SON tour
// (intent turnMemoryFlip). L'écran partagé n'affiche que le plateau + les scores
// en LECTURE SEULE. La surface TACTILE garde le moteur composant (MemoryGame.jsx)
// où les deux équipes jouent côte à côte sur le même écran.
//
// SECRET (anti-triche) : le texte ET l'appariement (pairId) des cartes non
// révélées ne quittent JAMAIS l'hôte — strippés par buildTurnPayload
// (sessionConfig) : le téléphone ne reçoit le texte qu'une fois la carte
// retournée (flipped) ou capturée (matched), et jamais le pairId brut.
//
// showFight.memory = {
//   pairs,                              // paires source (pour redistribuer un plateau)
//   roundNo,                            // plateau courant (continuité de `used`)
//   cards: [{ key, pairId, text }],     // plateau ordonné (mélangé)
//   flipped: [idx...],                  // 0..2 cartes face visible MAINTENANT
//   matched: { pairId: 'attacker'|'defender' },
//   scores: { attacker, defender },
//   activeSide: 'attacker'|'defender',  // à qui de jouer
//   busy: false,                        // résolution d'une paire en cours (fige)
//   used: [pairKey...],                 // anti-répétition inter-plateaux
//   seq: 0,                             // jeton anti-minuterie-périmée
//   reveal: null | { winner: 'attacker'|'defender'|'tie' },
// }
import { shuffle } from '../data/fightData';

export const MEMORY_PAIRS_PER_BOARD = 6;
export const MEMORY_MATCH_HOLD_MS = 850;   // paire trouvée : temps de lecture avant capture
export const MEMORY_FLIP_BACK_MS = 1400;   // deux cartes différentes : temps avant retournement
export const MEMORY_REVEAL_MS = 1600;      // fin de plateau : victoire affichée avant la suite
export const MEMORY_TIE_MS = 1900;         // égalité : on redistribue un plateau

const SIDES = ['attacker', 'defender'];
const pairKey = (p) => p.id || `${p.a}|${p.b}`;

// Distribue un plateau : PAIRS_PER_BOARD paires non déjà vues (recycle si épuisé),
// deux cartes par paire (a/b), le tout mélangé. Retourne { cards, used }.
function dealMemoryBoard(pairs, used) {
  const all = Array.isArray(pairs) ? pairs : [];
  let pool = all.filter((p) => !used.includes(pairKey(p)));
  let nextUsed = used;
  if (pool.length < MEMORY_PAIRS_PER_BOARD) { nextUsed = []; pool = all; }
  const chosen = shuffle(pool).slice(0, MEMORY_PAIRS_PER_BOARD);
  nextUsed = [...nextUsed, ...chosen.map(pairKey)];
  const cards = [];
  chosen.forEach((p, pi) => {
    cards.push({ key: `${pi}a`, pairId: pi, text: p.a });
    cards.push({ key: `${pi}b`, pairId: pi, text: p.b });
  });
  return { cards: shuffle(cards), used: nextUsed };
}

// État d'un plateau neuf (réinitialise tout sauf pairs/used/roundNo).
function freshBoard(pairs, used, roundNo) {
  const deal = dealMemoryBoard(pairs, used);
  return {
    pairs, roundNo, cards: deal.cards, used: deal.used,
    flipped: [], matched: {}, scores: { attacker: 0, defender: 0 },
    activeSide: 'attacker', busy: false, seq: 0, reveal: null,
  };
}

export function startMemoryDuel(set, get, pairs) {
  const f = get().showFight;
  if (!f) return;
  set({ showFight: { ...f, phase: 'minigame', memory: freshBoard(pairs, [], 1) } });
}

// Un duelliste (camp ACTIF uniquement) retourne une carte. La 2e carte fige le
// plateau (busy) et programme la résolution côté hôte (paire → capture + rejoue ;
// sinon → retournement + main à l'autre camp).
export function memoryDuelFlip(set, get, side, index) {
  const f = get().showFight;
  const m = f?.memory;
  if (!m || m.reveal || f.phase !== 'minigame') return;
  if (!SIDES.includes(side) || side !== m.activeSide) return; // seul le camp actif joue
  if (m.busy || m.flipped.length >= 2) return;
  const card = m.cards[index];
  if (!card || m.matched[card.pairId] != null || m.flipped.includes(index)) return;

  const flipped = [...m.flipped, index];
  if (flipped.length < 2) {
    set({ showFight: { ...f, memory: { ...m, flipped } } });
    return;
  }
  // Deuxième carte : on fige et on programme la résolution.
  const seq = (m.seq || 0) + 1;
  set({ showFight: { ...f, memory: { ...m, flipped, busy: true, seq } } });
  const [i, j] = flipped;
  const isMatch = m.cards[i].pairId === m.cards[j].pairId;
  setTimeout(
    () => resolveMemoryFlip(set, get, seq, side, isMatch, m.cards[i].pairId),
    isMatch ? MEMORY_MATCH_HOLD_MS : MEMORY_FLIP_BACK_MS,
  );
}

// Résolution d'une paire (minuterie hôte). Le jeton `seq` annule toute minuterie
// périmée (plateau redistribué, combat clos entre-temps…).
function resolveMemoryFlip(set, get, seq, side, isMatch, pairId) {
  const f = get().showFight;
  const m = f?.memory;
  if (!m || m.seq !== seq || !m.busy) return;
  if (isMatch) {
    const matched = { ...m.matched, [pairId]: side };
    const scores = { ...m.scores, [side]: m.scores[side] + 1 };
    // Paire trouvée → le même camp REJOUE (flipped vidé, busy levé).
    set({ showFight: { ...f, memory: { ...m, matched, scores, flipped: [], busy: false } } });
    checkMemoryBoardEnd(set, get);
  } else {
    const activeSide = side === 'attacker' ? 'defender' : 'attacker';
    set({ showFight: { ...f, memory: { ...m, flipped: [], busy: false, activeSide } } });
  }
}

// Toutes les paires capturées → vainqueur du plateau (ou égalité = on rejoue).
function checkMemoryBoardEnd(set, get) {
  const f = get().showFight;
  const m = f?.memory;
  if (!m || m.reveal) return;
  const total = m.cards.length / 2;
  if (Object.keys(m.matched).length < total) return;
  const { attacker, defender } = m.scores;

  if (attacker === defender) {
    // Égalité : on affiche un court instant puis on redistribue un plateau.
    set({ showFight: { ...f, memory: { ...m, reveal: { winner: 'tie' } } } });
    setTimeout(() => {
      const cur = get().showFight;
      const cm = cur?.memory;
      if (!cm || cm.reveal?.winner !== 'tie' || cur.phase !== 'minigame') return;
      set({ showFight: { ...cur, memory: freshBoard(cm.pairs, cm.used, cm.roundNo + 1) } });
    }, MEMORY_TIE_MS);
    return;
  }

  const winner = attacker > defender ? 'attacker' : 'defender';
  set({ showFight: { ...f, memory: { ...m, reveal: { winner } } } });
  setTimeout(() => {
    const cur = get().showFight;
    if (!cur?.memory?.reveal || cur.phase !== 'minigame') return;
    get().fightRoundWin(winner); // BO3 : peut passer en phase 'reward'
    // Le combat continue (manche suivante) → nouveau plateau propre.
    const nf = get().showFight;
    if (nf && nf.phase === 'minigame' && !nf.winnerSide && nf.memory) {
      set({ showFight: { ...nf, memory: freshBoard(nf.memory.pairs, nf.memory.used, nf.memory.roundNo + 1) } });
    }
  }, MEMORY_REVEAL_MS);
}
