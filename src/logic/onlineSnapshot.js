// Snapshot d'état complet pour le mode « jeu en ligne » (Phase 1).
//
// En classe, l'état vit sur UNE machine (le TBI, autorité) et les téléphones ne
// reçoivent qu'un payload allégé (équipe active + son tour). En ligne, il n'y a
// plus d'écran partagé : chaque joueur doit RENDRE LE PLATEAU COMPLET sur son
// appareil. Le client-hôte (autorité) diffuse donc un snapshot de tout l'état de
// jeu ; les clients « miroir » l'hydratent en lecture seule pour spectater.
//
// Ce module est PUR (aucun accès réseau / store) et symétrique :
//   serializeSnapshot(state)  → objet JSON-safe prêt à diffuser (anti-triche appliqué)
//   hydrateSnapshot(data)     → slice de store prête pour useGameStore.setState
import { SAVE_FIELDS } from '../store/persistence';

export const SNAPSHOT_VERSION = 1;

// Champs transitoires de RENDU (non persistés en sauvegarde) nécessaires pour
// voir le tour se dérouler en direct : dé, animations de déplacement, modales.
const RENDER_FIELDS = [
  'rolling', 'diceValue', 'preRollPos', 'preRollValue', 'movePath',
  'pendingLanding', 'awaitingChoice', 'eventApplied',
  'showDiceModal', 'showQuestion', 'showEvent', 'showFight', 'showDuelChoice',
  'showTargetPicker', 'showChargePicker', 'showSpecPicker', 'showEnchantPicker',
  'showShop', 'showShopPrompt', 'showInventory', 'lootReveal',
  'indiceHidden', 'weatherCeremony',
];

// Union des champs diffusés (socle de jeu + rendu transitoire), dédupliquée.
export const SNAPSHOT_FIELDS = [...new Set([...SAVE_FIELDS, ...RENDER_FIELDS])];

// askedQuestions : { [subject]: Set<id> } → besoin d'une (dé)sérialisation dédiée.
function askedToArrays(asked) {
  const obj = {};
  for (const [subject, v] of Object.entries(asked || {})) {
    obj[subject] = v instanceof Set ? [...v] : Array.isArray(v) ? v : [];
  }
  return obj;
}
function askedToSets(asked) {
  const obj = {};
  for (const [subject, v] of Object.entries(asked || {})) {
    obj[subject] = new Set(Array.isArray(v) ? v : []);
  }
  return obj;
}

// Retire les pièges du plateau : ce sont des informations cachées (un spectateur
// ne doit pas les voir ; l'hôte pilote l'animation/journal au déclenchement).
function stripBoardTraps(board) {
  if (!Array.isArray(board)) return board;
  return board.map((node) => {
    if (node && node.trap) { const { trap, ...rest } = node; return rest; }
    return node;
  });
}

// Retire la bonne réponse et l'explication tant que la question n'est pas
// révélée (même discipline anti-triche que le payload manette). Le secret ne
// quitte jamais l'hôte avant la révélation.
function stripQuestionSecret(showQuestion) {
  if (!showQuestion || !showQuestion.question) return showQuestion;
  if (showQuestion.answerRevealed) return showQuestion;
  const { c, e, e_en, ...safeQ } = showQuestion.question;
  return { ...showQuestion, question: safeQ };
}

// Duel éclair : la question de course porte la bonne réponse (race.q.c) — jamais
// diffusée (l'hôte arbitre). On la retire du combat avant broadcast.
function stripFightSecret(showFight) {
  if (!showFight || !showFight.race || !showFight.race.q) return showFight;
  const { c, e, e_en, ...safeQ } = showFight.race.q;
  return { ...showFight, race: { ...showFight.race, q: safeQ } };
}

/**
 * Sérialise l'état du store en un snapshot JSON-safe, prêt à être diffusé.
 * Applique l'anti-triche (secrets de question, pièges) AVANT diffusion.
 */
export function serializeSnapshot(state) {
  const data = { v: SNAPSHOT_VERSION };
  for (const key of SNAPSHOT_FIELDS) {
    if (key === 'askedQuestions') data[key] = askedToArrays(state[key]);
    else if (key === 'board') data[key] = stripBoardTraps(state[key]);
    else if (key === 'showQuestion') data[key] = stripQuestionSecret(state[key]);
    else if (key === 'showFight') data[key] = stripFightSecret(state[key]);
    else data[key] = state[key];
  }
  return data;
}

/**
 * Reconstruit une slice de store depuis un snapshot diffusé (arrays → Sets),
 * prête pour useGameStore.setState(...). Marque le store comme miroir.
 */
export function hydrateSnapshot(data) {
  if (!data || typeof data !== 'object') return null;
  const slice = { _mirror: true };
  for (const key of SNAPSHOT_FIELDS) {
    if (!(key in data)) continue;
    if (key === 'askedQuestions') slice[key] = askedToSets(data[key]);
    else slice[key] = data[key];
  }
  return slice;
}
