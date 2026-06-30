// ============================================================
//  FORGE DE DÉS — modèle de données (extension « forge »)
//
//  Chaque équipe possède un dé de 6 faces personnalisables. Un dé a DEUX
//  couches (cf. spec §2) :
//    - identité (immuable) : un numéro de base 1→6 = l'ADRESSE du slot. Sert à
//      cibler une face (et un futur pouvoir Bénédiction/Malédiction). Ne fait
//      PAS avancer le pion par lui-même.
//    - forge (modifiable)  : une FACE = { value 0→6, effect: null | {...} }.
//      Par défaut value = base (dé standard 1→6) et aucun effet.
//
//  Au lancer (Phase 1c), on résout la couche forge du slot tiré : le pion
//  avance de `value`, l'effet se déclenche selon son timing. `recul = value`
//  (une face à value 0 ⇒ pas de recul).
//
//  Ce module ne contient QUE le modèle + helpers (pas de résolution ni de
//  catalogue d'effets — voir Phases 1c / 2). Tout est sérialisable tel quel
//  (persistance save + publication mobile).
// ============================================================

export const DIE_SLOTS = 6;
// Nombre maximum d'effets cumulables sur une même face.
export const MAX_FACE_EFFECTS = 3;

// Une offre de troc (ligne quete_trades) est-elle une PRESTATION DE FORGEAGE ?
// Le marqueur `forge` peut être sur l'un OU l'autre côté (proposition dans les
// deux sens) : le forgeron PROPOSE (give.forge, want = paiement) OU le client
// DEMANDE à un forgeron (give = paiement, want.forge). Le côté forge = le forgeron.
// À l'acceptation, le TBI ouvre une session collaborative (cf. startForgeService).
export const isForgeServiceTrade = (trade) => !!(trade && ((trade.give && trade.give.forge) || (trade.want && trade.want.forge)));

// Liste NORMALISÉE des effets d'une face (0→3). Rétro-compatible : lit la forme
// MODERNE `effects: [{type,tier}, …]` OU l'ancienne `effect: {type,tier}|null`
// (saves/catalogue d'avant le multi-effets). Source unique pour tout le moteur.
export function faceEffects(face) {
  if (!face) return [];
  if (Array.isArray(face.effects)) return face.effects.filter((e) => e && e.type).slice(0, MAX_FACE_EFFECTS);
  if (face.effect && face.effect.type) return [face.effect];
  return [];
}

// Signature de contenu d'une face (valeur + effets) : sert aux comparaisons et à
// la synchro optimiste mobile, indépendamment de la forme (effect/effects).
export function faceSig(face) {
  return `${clampFaceValue(face?.value)}|${faceEffects(face).map((e) => `${e.type}:${e.tier ?? 0}`).join(',')}`;
}

// Dé standard d'une équipe neuve : value === base, aucun effet.
export function defaultDieFaces() {
  return Array.from({ length: DIE_SLOTS }, (_, i) => ({ base: i + 1, value: i + 1, effects: [] }));
}

// Une face est-elle « forgée » (≠ face standard) ? Sert à demander confirmation
// avant écrasement (une face vierge s'écrase sans confirmation, cf. spec §7).
export function isFaceForged(face) {
  if (!face) return false;
  return face.value !== face.base || faceEffects(face).length > 0;
}

// Valeur de déplacement maximale d'une face (le dé garde ses 6 slots ; seule la
// valeur peut monter plus haut).
export const MAX_FACE_VALUE = 12;

// Borne une valeur de déplacement de face à [0, MAX_FACE_VALUE] (entier).
export function clampFaceValue(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_FACE_VALUE, n));
}

// Normalise / migre un dé (saves anciennes, données partielles, payload mobile)
// vers exactement 6 faces valides. Les slots manquants reprennent le standard.
export function normalizeDieFaces(faces) {
  const out = defaultDieFaces();
  if (Array.isArray(faces)) {
    for (let i = 0; i < DIE_SLOTS; i++) {
      const f = faces[i];
      if (f && typeof f === 'object') {
        out[i] = {
          base: i + 1, // l'adresse est TOUJOURS la position du slot (immuable)
          value: Number.isFinite(f.value) ? clampFaceValue(f.value) : out[i].value,
          effects: faceEffects(f), // normalise effect|effects → tableau (0→3)
        };
      }
    }
  }
  return out;
}

// Dé d'une équipe, toujours normalisé à 6 faces (défaut standard si absent).
// Point d'accès unique : résolution au lancer, UI forge, publication mobile.
export function getDieFaces(team) {
  return normalizeDieFaces(team?.dieFaces);
}
