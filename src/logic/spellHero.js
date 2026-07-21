// Moteur PUR du mini-jeu « Duel de sorts » (rythme, façon Guitar Hero) — thème
// Harry Potter, remplace la boucle question/réponse du duel de sorciers.
//
// Principe : des ÉVÉNEMENTS du lore tombent vers une ligne de tir ; en bas, une
// « main » de 4 sorts (renouvelée par vagues). Quand un événement franchit la
// ligne, le joueur tape LE bon sort AU BON MOMENT. Bon sort + bon timing = points
// (avec multiplicateur de combo). Les deux équipes jouent la MÊME partition en
// simultané ; le meilleur score gagne (l'écart pousse le rai partagé, K.O. possible).
//
// Aucune dépendance React : état sérialisable + fonctions pures, testables et
// portables (l'hôte génère la partition, chaque surface l'anime/juge en local).
//
// ANTI-TRICHE : la partition (vagues + notes + labels + timings) est PUBLIQUE —
// c'est le principe même du jeu (on voit les notes arriver). Seule la CLÉ de
// réponse (quel sort de la main est correct pour chaque note) reste côté hôte,
// strippée à la publication (comme `wizard.q.c` hier).

// Réglages du jeu (exposés pour l'éditeur d'équilibrage / les tests).
export const HERO = {
  PERFECT_MS: 95,        // |dt| <= 95 ms autour de la ligne → Parfait
  GOOD_MS: 230,          // |dt| <= 230 ms → Bien ; au-delà (bon sort) → Raté (trop tôt/tard)
  PERFECT_PTS: 100,      // points de base d'un Parfait (avant combo)
  GOOD_PTS: 50,          // points de base d'un Bien (avant combo)
  HAND: 4,               // sorts affichés par vague (les 4 boutons)
  WAVES: 4,              // nombre de vagues dans un duel
  NOTES_PER_WAVE: 5,     // événements par vague (~20 notes / duel)
  START_GAP_MS: 2600,    // écart initial entre 2 notes : départ LENT (large temps de lecture)
  ACCEL: 0.92,           // la cadence se resserre en CONTINU (×0.92 par note) → « de plus en plus » vite
  GAP_FLOOR_MS: 820,     // cadence plancher (le finale ne va jamais plus serré que ça)
  LEAD_MS: 2700,         // durée de chute d'une note (apparition → ligne)
  READY_MS: 3000,        // temps de LECTURE de la 1re main AVANT la première note (compte à rebours)
  WAVE_SWAP_MS: 1400,    // respiration avant la 1re note d'une nouvelle vague (lire la main)
  TAIL_MS: 1300,         // marge après la dernière note avant la fin de la « chanson »
  KO_DIFF: 800,          // écart de score → K.O. avant la fin (≈ 8 Parfaits d'avance)
  COMBO_TIERS: [[20, 4], [10, 3], [5, 2]], // [seuil, multiplicateur], décroissant
};

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);

/** Multiplicateur de combo pour une série en cours (0 → ×1, 5 → ×2, 10 → ×3, 20 → ×4). */
export function comboMult(combo, tiers = HERO.COMBO_TIERS) {
  for (const [threshold, mult] of tiers) if (combo >= threshold) return mult;
  return 1;
}

/**
 * Juge un tap : verdict + points de BASE (avant multiplicateur de combo).
 *   - `dt` = erreur de timing signée en ms (négatif = trop tôt, positif = trop tard) ;
 *   - `correct` = le sort tapé est-il le bon pour cette note ?
 * Verdicts : 'perfect' | 'good' (bon sort dans la fenêtre) · 'late' (bon sort hors
 * fenêtre) · 'wrong' (mauvais sort). Seuls perfect/good rapportent et tiennent le combo.
 */
export function judgeHit(dt, correct, cfg = HERO) {
  if (!correct) return { verdict: 'wrong', base: 0 };
  const a = Math.abs(Number(dt) || 0);
  if (a <= cfg.PERFECT_MS) return { verdict: 'perfect', base: cfg.PERFECT_PTS };
  if (a <= cfg.GOOD_MS) return { verdict: 'good', base: cfg.GOOD_PTS };
  return { verdict: 'late', base: 0 };
}

/**
 * Applique un tap à la série d'un camp et renvoie le résultat + le nouvel état de
 * série. `combo` = série AVANT ce tap. Un tap gagnant (perfect/good) incrémente la
 * série puis applique le multiplicateur ; un tap raté (wrong/late) casse la série.
 * @returns {{ verdict, base, mult, points, combo }} combo = série APRÈS ce tap.
 */
export function scoreHit(dt, correct, combo = 0, cfg = HERO) {
  const { verdict, base } = judgeHit(dt, correct, cfg);
  if (base > 0) {
    const nextCombo = combo + 1;
    const mult = comboMult(nextCombo, cfg.COMBO_TIERS);
    return { verdict, base, mult, points: base * mult, combo: nextCombo };
  }
  return { verdict, base: 0, mult: 1, points: 0, combo: 0 };
}

/**
 * Position du rai partagé (0..100) depuis les scores des deux camps + détection du
 * K.O. L'ATTAQUANT mène → l'orbe file vers 100 (camp du défenseur) ; le DÉFENSEUR
 * mène → vers 0. K.O. (winner) quand l'écart atteint `koDiff`.
 * @returns {{ pos:number, winner:'attacker'|'defender'|null }}
 */
export function beamFromScores(attScore = 0, defScore = 0, koDiff = HERO.KO_DIFF) {
  const diff = (attScore || 0) - (defScore || 0);
  const pos = clamp(50 + (diff / koDiff) * 50, 0, 100);
  let winner = null;
  if (pos >= 100) winner = 'attacker';
  else if (pos <= 0) winner = 'defender';
  return { pos, winner };
}

/**
 * Vainqueur à la fin de la « chanson » : meilleur score. Égalité → défenseur (il
 * conserve l'avantage du terrain, comme le duel éclair départage au statu quo).
 */
export function finalWinner(attScore = 0, defScore = 0) {
  return (attScore || 0) > (defScore || 0) ? 'attacker' : 'defender';
}

// --- Génération de la partition -------------------------------------------------

const groupByCat = (pool) => {
  const g = {};
  for (const s of pool) (g[s.cat] || (g[s.cat] = [])).push(s);
  return g;
};

// Tire `n` éléments DISTINCTS de `arr` (Fisher-Yates partiel sur une copie).
function sampleDistinct(arr, n, rng) {
  const copy = arr.slice();
  const out = [];
  const k = Math.min(n, copy.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    out.push(copy[i]);
  }
  return out;
}

// Construit la « main » d'une vague : `hand` sorts. Les 1res vagues panachent les
// catégories (faciles à distinguer) ; les suivantes tirent dans une MÊME catégorie
// (sorts confondables) quand c'en est possible → montée en difficulté.
function pickHand(groups, cats, hand, wave, rng) {
  const bigCats = cats.filter((c) => groups[c].length >= hand);
  const sameCat = wave >= 1 && bigCats.length > 0;
  if (sameCat) {
    const c = bigCats[Math.floor(rng() * bigCats.length)];
    return sampleDistinct(groups[c], hand, rng);
  }
  const all = cats.flatMap((c) => groups[c]);
  return sampleDistinct(all, hand, rng);
}

/**
 * Génère une partition complète depuis le pool de sorts. Déterministe pour un `rng`
 * donné (l'hôte l'appelle une fois puis PUBLIE la partition — pas de régénération
 * par surface). Renvoie `null` si le pool est trop pauvre (< HAND sorts) → l'appelant
 * se rabat proprement (duel éclair).
 *
 * pool : [{ incantation, nomFr?, cat, events:[{ label }] }, ...]
 * @returns {{
 *   waves: [{ spells:[{incantation,nomFr}] }],
 *   notes: [{ id, wave, t, label }],   // t = ms depuis songStart où la note atteint la ligne
 *   key:   { [noteId]: index },        // SECRET : index (0..hand-1) du bon sort dans la main
 *   duration: number,                  // ms totales de la chanson
 * }}
 */
export function buildChart(pool, opts = {}, rng = Math.random) {
  const cfg = { ...HERO, ...opts };
  const hand = cfg.HAND;
  if (!Array.isArray(pool) || pool.length < hand) return null;

  const groups = groupByCat(pool);
  const cats = Object.keys(groups);

  const waves = [];
  const notes = [];
  const key = {};
  // Départ : délai de LECTURE de la main (READY_MS) PUIS une chute complète (LEAD_MS)
  // → le temps de lire les 4 sorts avant que la 1re note n'entre à l'écran.
  let t = cfg.READY_MS + cfg.LEAD_MS;
  let gap = cfg.START_GAP_MS; // se resserre en CONTINU sur TOUTE la partition (accélère « de plus en plus »)
  let id = 0;

  for (let w = 0; w < cfg.WAVES; w++) {
    const hand4 = pickHand(groups, cats, hand, w, rng);
    if (hand4.length < hand) return null; // pool insuffisant : repli propre
    waves.push({ spells: hand4.map((s) => ({ incantation: s.incantation, nomFr: s.nomFr || '' })) });

    // Respiration avant chaque nouvelle vague (le temps de lire la nouvelle main).
    if (w > 0) t += cfg.WAVE_SWAP_MS;

    // Chaque sort de la main sort au moins une fois, puis on complète aléatoirement.
    const order = [];
    for (let i = 0; i < cfg.NOTES_PER_WAVE; i++) order.push(i < hand ? i : Math.floor(rng() * hand));
    // Mélange l'ordre pour ne pas révéler « toujours le 1er sort d'abord ».
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }

    const evCursor = hand4.map(() => 0); // rotation des événements par sort (variété)
    for (let n = 0; n < cfg.NOTES_PER_WAVE; n++) {
      const idx = order[n];
      const spell = hand4[idx];
      const evs = spell.events && spell.events.length ? spell.events : [{ label: spell.incantation }];
      const ev = evs[evCursor[idx] % evs.length];
      evCursor[idx]++;
      notes.push({ id, wave: w, t, label: ev.label });
      key[id] = idx;
      id++;
      t += gap;
      gap = Math.max(cfg.GAP_FLOOR_MS, gap * cfg.ACCEL); // accélère à CHAQUE note
    }
  }

  const last = notes.length ? notes[notes.length - 1].t : cfg.LEAD_MS;
  return { waves, notes, key, duration: last + cfg.TAIL_MS };
}
