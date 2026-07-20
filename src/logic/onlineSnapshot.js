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
  // showShop reste diffusé pour le MARCHÉ NOIR (boutique louche d'événement,
  // spectacle partagé piloté par le joueur actif) — la boutique NORMALE, elle,
  // est privée par joueur (dock local, acceptShopPrompt n'ouvre plus en ligne).
  'showShop', 'showShopPrompt', 'lootReveal',
  // Le joueur actif joue son tour SUR SON ÉCRAN (UX souris) : toutes les
  // modales de tour doivent être diffusées, sinon il resterait bloqué devant
  // un plateau muet pendant que l'hôte affiche l'interrupt.
  'showStarterChest', 'lastStarterReward', 'showInvestPicker', 'investResult',
  'showSubjectPicker', 'showTilePicker', 'showMetierPicker',
  'indiceHidden', 'indiceUsed', 'rerollUsed', 'weatherCeremony', 'spellCeremony',
  // NB : showInventory n'est PLUS diffusé — l'inventaire est une interface
  // PRIVÉE par joueur en ligne (dock local).
];

// Champs JAMAIS diffusés (Disk IO) : volumineux et inutiles au miroir. En tête,
// `questions` = TOUT le pool chargé (~3 Mo) — c'était 96 % du snapshot, réécrit
// dans Supabase à chaque changement d'état + heartbeat 15 s. Le miroir n'en a pas
// besoin : il ne tire jamais de question (l'hôte est l'autorité et pousse la
// question courante via `showQuestion`, déjà nettoyée par l'anti-triche), et il
// charge lui-même son catalogue au démarrage. `hydrateSnapshot` ignore les clés
// absentes, donc ne pas l'envoyer n'écrase pas le pool local du client.
// `curioSeen`/`curioSeq` (anti-répétition Curioscope, persistés en sauvegarde) :
// le spot COURANT du duel s'en déduit (dernier id vu) → jamais diffusés. Ils
// restent dans SAVE_FIELDS (sauvegarde locale de l'hôte uniquement).
const BROADCAST_EXCLUDE = new Set(['questions', 'curioSeen', 'curioSeq']);

// Union des champs diffusés (socle de jeu + rendu transitoire), dédupliquée,
// moins les champs exclus de diffusion.
export const SNAPSHOT_FIELDS = [...new Set([...SAVE_FIELDS, ...RENDER_FIELDS])]
  .filter((key) => !BROADCAST_EXCLUDE.has(key));

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
// diffusée (l'hôte arbitre). Duel Curioscope : avant révélation, la CIBLE
// (x/y + label sauf mode « Place : X ») et les MARQUES restent sur l'hôte —
// le miroir n'a besoin que de la photo et des statuts (spectacle partagé).
function stripFightSecret(showFight) {
  if (!showFight) return showFight;
  let out = showFight;
  // Défense en profondeur : les duels Memory / Pokémon ne tournent JAMAIS en
  // ligne (fightBegin les exclut de cette surface) — leur état (texte/pairId
  // des cartes, choix secrets A/B) ne doit donc jamais partir dans le snapshot.
  if (out.memory || out.pkmn) {
    const { memory, pkmn, ...rest } = out;
    out = rest;
  }
  if (out.race?.q) {
    const { c, e, e_en, ...safeQ } = out.race.q;
    out = {
      ...out,
      race: {
        ...out.race,
        q: safeQ,
        // Les réponses adverses ({index}) fuiraient avant la fin de manche →
        // réduites aux booléens (même discipline que le payload manette).
        answers: { attacker: !!out.race.answers?.attacker, defender: !!out.race.answers?.defender },
      },
    };
  }
  if (out.curio) {
    // usedIds : le DERNIER id EST la réponse (monde réel : id = nom du lieu).
    // Le miroir n'en a pas besoin (anti-répétition = affaire de l'hôte) → jamais
    // diffusé, révélation comprise.
    const { usedIds, ...c } = out.curio;
    out = {
      ...out,
      curio: c.reveal ? c : {
        ...c,
        target: c.target ? {
          id: null,
          label: c.target.showName ? c.target.label : null,
          x: null, y: null,
          universe: c.target.universe, image: c.target.image, showName: c.target.showName,
        } : null,
        marks: { attacker: null, defender: null },
      },
    };
  }
  return out;
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
