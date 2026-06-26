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

// Dé standard d'une équipe neuve : value === base, aucun effet.
export function defaultDieFaces() {
  return Array.from({ length: DIE_SLOTS }, (_, i) => ({ base: i + 1, value: i + 1, effect: null }));
}

// Une face est-elle « forgée » (≠ face standard) ? Sert à demander confirmation
// avant écrasement (une face vierge s'écrase sans confirmation, cf. spec §7).
export function isFaceForged(face) {
  if (!face) return false;
  return face.value !== face.base || face.effect != null;
}

// Borne une valeur de déplacement de face à [0, 6] (entier).
export function clampFaceValue(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(6, n));
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
          effect: f.effect ?? null,
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
